"""PDF page previews: the cited page as a PNG with the passage highlighted."""
import fitz
import numpy as np
import pytest

from app.services.page_preview import MAX_PIXEL_WIDTH, render_page
from tests.helpers import make_multipage_pdf, upload

PAGE_1 = "Penguins live in Antarctica and feed on krill during the long southern summer season. " * 6
PAGE_2 = "Camels cross the Sahara desert carrying water and salt between distant oasis towns. " * 6


def yellow_pixels(png: bytes) -> int:
    """Counts highlighter-yellow pixels (the highlight tints white paper to roughly 255, 230, 115)."""
    pix = fitz.Pixmap(png)
    px = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    return int(((px[..., 0] > 230) & (px[..., 1] > 180) & (px[..., 2] < 150)).sum())


@pytest.fixture
def pdf_path(tmp_path):
    path = tmp_path / "two-pages.pdf"
    path.write_bytes(make_multipage_pdf([PAGE_1, PAGE_2]))
    return path


# ---- render_page ----

def test_highlights_the_passage_on_its_own_page(pdf_path):
    png = render_page(pdf_path, 1, PAGE_1)
    assert png.startswith(b"\x89PNG")
    assert yellow_pixels(png) > 500


def test_does_not_highlight_text_that_is_on_another_page(pdf_path):
    # Page 2's text asked for on page 1: nothing to mark, so the plain page comes back.
    assert yellow_pixels(render_page(pdf_path, 1, PAGE_2)) == 0
    assert yellow_pixels(render_page(pdf_path, 2, PAGE_2)) > 500


def test_a_chunk_spanning_two_pages_highlights_each_page_separately(pdf_path):
    both = PAGE_1 + " " + PAGE_2
    p1, p2 = render_page(pdf_path, 1, both), render_page(pdf_path, 2, both)
    assert yellow_pixels(p1) > 500 and yellow_pixels(p2) > 500


@pytest.mark.parametrize("passage", ["", "words that appear nowhere in this document at all ever"])
def test_no_match_returns_the_plain_page_not_an_error(pdf_path, passage):
    plain = render_page(pdf_path, 1, "")
    assert render_page(pdf_path, 1, passage) == plain
    assert yellow_pixels(plain) == 0


def test_very_large_pages_are_scaled_down(tmp_path):
    doc = fitz.open()
    doc.new_page(width=3000, height=4000).insert_text((100, 200), "poster sized page " * 5, fontsize=60)
    path = tmp_path / "poster.pdf"
    doc.save(path)
    pix = fitz.Pixmap(render_page(path, 1, ""))
    assert pix.width <= MAX_PIXEL_WIDTH


def test_a_short_trailing_window_is_ignored_instead_of_matching_everywhere(pdf_path):
    # 9 words = one 8-word window + a 1-word remainder; "the" must not be highlighted all over the page.
    passage = "Penguins live in Antarctica and feed on krill the"
    with_remainder = yellow_pixels(render_page(pdf_path, 1, passage))
    without = yellow_pixels(render_page(pdf_path, 1, "Penguins live in Antarctica and feed on krill"))
    assert with_remainder == without


# ---- vector store lookup ----

def test_get_chunk_finds_by_index_and_returns_none_otherwise(client, vector_store):
    doc_id = upload(client, "a.pdf", make_multipage_pdf([PAGE_1])).json()["document_id"]
    client.post(f"/documents/{doc_id}/process")
    assert vector_store.get_chunk(doc_id, 1).chunk.chunk_index == 1
    assert vector_store.get_chunk(doc_id, 999) is None
    assert vector_store.get_chunk("never-indexed", 1) is None


# ---- endpoint ----

@pytest.fixture
def processed_pdf(client):
    doc_id = upload(client, "animals.pdf", make_multipage_pdf([PAGE_1, PAGE_2])).json()["document_id"]
    assert client.post(f"/documents/{doc_id}/process").status_code == 200
    return doc_id


def url(doc_id, chunk=1, page=1):
    return f"/documents/{doc_id}/passages/{chunk}/preview?page={page}"


def test_preview_returns_a_highlighted_png_that_browsers_may_cache(client, processed_pdf):
    response = client.get(url(processed_pdf, 1, 1))
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert "max-age" in response.headers["cache-control"] and "private" in response.headers["cache-control"]
    assert yellow_pixels(response.content) > 500


def test_preview_works_for_every_page_the_passage_spans(client, processed_pdf):
    source = client.post("/documents/chat", json={"question": "penguins", "document_id": processed_pdf}).json()["sources"][0]
    for page in range(source["page_start"], source["page_end"] + 1):
        assert client.get(url(processed_pdf, source["chunk_index"], page)).status_code == 200


@pytest.mark.parametrize("chunk,page,detail", [
    (1, 3, "not on this page"),     # outside the chunk's page range
    (99, 1, "no longer exists"),    # unknown chunk
])
def test_preview_404s_with_a_reason(client, processed_pdf, chunk, page, detail):
    response = client.get(url(processed_pdf, chunk, page))
    assert response.status_code == 404 and detail in response.json()["detail"]


def test_preview_is_pdf_only(client):
    doc_id = upload(client, "notes.txt", (PAGE_1 * 3).encode()).json()["document_id"]
    client.post(f"/documents/{doc_id}/process")
    response = client.get(url(doc_id))
    assert response.status_code == 404 and "only available for PDF" in response.json()["detail"]


def test_preview_before_processing_is_409(client):
    doc_id = upload(client, "a.pdf", make_multipage_pdf([PAGE_1])).json()["document_id"]
    assert client.get(url(doc_id)).status_code == 409


def test_preview_unknown_document_is_404(client):
    assert client.get(url("nope")).status_code == 404


def test_preview_after_delete_is_404(client, processed_pdf):
    client.delete(f"/documents/{processed_pdf}")
    assert client.get(url(processed_pdf)).status_code == 404


@pytest.mark.parametrize("query", ["", "?page=0", "?page=-1", "?page=abc"])
def test_preview_validates_the_page_parameter(client, processed_pdf, query):
    assert client.get(f"/documents/{processed_pdf}/passages/1/preview{query}").status_code == 422
