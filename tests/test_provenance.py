"""Page numbers and citation numbers: both come from retrieval metadata, never from the model."""
from datetime import datetime

import pytest

from app.models.models.chunk import Chunk
from app.models.models.document import Document, DocumentStatus, DocumentType
from app.models.models.embeddingclass import EmbeddedChunk
from app.models.models.processed_document import ProcessedDocument
from app.models.models.search_result import SearchResult
from app.services.chunking_service import ChunkingService
from app.services.document_processor import DocumentProcessor
from app.services.prompt_builder import PromptBuilder
from tests.helpers import make_multipage_pdf, make_docx, upload


def words(prefix: str, n: int) -> str:
    return " ".join(f"{prefix}{i}" for i in range(n))


def doc_for(storage, name: str, content: bytes, file_type: DocumentType) -> Document:
    path = storage.upload_dir / name
    path.write_bytes(content)
    return Document(
        id="d", stored_filename=name, original_filename=name, file_type=file_type,
        status=DocumentStatus.UPLOADED, file_size=len(content), uploaded_at=datetime(2026, 1, 1),
    )


# ---- page offsets ----

def test_pdf_page_word_starts_are_cumulative(storage):
    pdf = make_multipage_pdf([words("a", 30), words("b", 20), words("c", 10)])
    processed = DocumentProcessor(storage).process(doc_for(storage, "x.pdf", pdf, DocumentType.PDF))
    assert processed.page_word_starts == [0, 30, 50]
    assert processed.page_count == 3
    assert processed.word_count == 60


def test_blank_pdf_page_shares_its_start_with_the_next(storage):
    pdf = make_multipage_pdf([words("a", 10), "", words("c", 10)])
    processed = DocumentProcessor(storage).process(doc_for(storage, "x.pdf", pdf, DocumentType.PDF))
    assert processed.page_word_starts == [0, 10, 10]


@pytest.mark.parametrize("name,content,kind", [
    ("x.txt", words("w", 50).encode(), DocumentType.TXT),
    ("x.md", words("w", 50).encode(), DocumentType.MD),
    ("x.docx", make_docx(words("w", 50)), DocumentType.DOCX),
])
def test_reflowed_formats_have_no_page_numbers(storage, name, content, kind):
    processed = DocumentProcessor(storage).process(doc_for(storage, name, content, kind))
    assert processed.page_word_starts == []


# ---- chunk -> page mapping ----

def processed_with_pages(page_word_counts: list[int]) -> ProcessedDocument:
    starts, total = [], 0
    for count in page_word_counts:
        starts.append(total)
        total += count
    return ProcessedDocument(
        document_id="d", text=words("w", total), word_count=total,
        processed_at=datetime.now(), page_count=len(starts), page_word_starts=starts,
    )


def test_chunks_report_the_pages_they_span():
    # pages hold words 0-19, 20-39, 40-59; chunks of 25 words (0-24, 25-49, 50-59), no overlap
    chunks = ChunkingService(chunk_size=25, overlap=0).chunk_document(processed_with_pages([20, 20, 20]))
    spans = [(c.page_start, c.page_end) for c in chunks]
    assert spans == [(1, 2), (2, 3), (3, 3)]


def test_a_chunk_inside_one_page_has_equal_start_and_end():
    chunks = ChunkingService(chunk_size=10, overlap=0).chunk_document(processed_with_pages([100]))
    assert all(c.page_start == c.page_end == 1 for c in chunks)


def test_chunk_page_skips_blank_pages():
    # page 2 is blank: words 10.. belong to page 3
    chunks = ChunkingService(chunk_size=10, overlap=0).chunk_document(processed_with_pages([10, 0, 10]))
    assert [(c.page_start, c.page_end) for c in chunks] == [(1, 1), (3, 3)]


def test_no_page_info_means_none():
    doc = processed_with_pages([20])
    doc.page_word_starts = []
    chunks = ChunkingService(chunk_size=10, overlap=0).chunk_document(doc)
    assert all(c.page_start is None and c.page_end is None for c in chunks)


# ---- prompt numbering ----

def search_result(text: str, idx: int) -> SearchResult:
    chunk = Chunk(id=str(idx), document_id="internal-doc-id", chunk_index=idx, text=text,
                  word_count=1, start_offset=0, end_offset=1)
    return SearchResult(chunk=EmbeddedChunk(chunk=chunk, embeddings=[0.0]), distance=0.5)


def test_prompt_numbers_passages_in_retrieval_order_and_asks_for_citations():
    prompt = PromptBuilder().build_prompt("What?", [search_result("alpha text", 7), search_result("beta text", 2)])
    assert prompt.index("[1]\nalpha text") < prompt.index("[2]\nbeta text")
    assert "cite" in prompt.lower()
    assert "Never invent a number" in prompt
    assert "internal-doc-id" not in prompt, "internal ids are meaningless to the model and shouldn't leak into the prompt"
    assert prompt.rstrip().endswith("Answer:")


# ---- end to end through the API ----

def test_chat_sources_carry_citation_numbers_and_pdf_pages(client):
    pdf = make_multipage_pdf([
        "Penguins live in Antarctica. " * 10,
        "Camels cross the Sahara desert. " * 10,
    ])
    doc_id = upload(client, "animals.pdf", pdf).json()["document_id"]
    assert client.post(f"/documents/{doc_id}/process").status_code == 200

    body = client.post("/documents/chat", json={"question": "penguins antarctica", "document_id": doc_id}).json()

    assert [s["number"] for s in body["sources"]] == list(range(1, len(body["sources"]) + 1))
    first = body["sources"][0]
    assert first["page_start"] == 1
    assert first["page_end"] in (1, 2)  # a chunk may straddle the page break


def test_chat_sources_for_text_files_have_no_pages(client):
    doc_id = upload(client, "notes.txt", words("w", 80).encode()).json()["document_id"]
    client.post(f"/documents/{doc_id}/process")
    body = client.post("/documents/chat", json={"question": "w1", "document_id": doc_id}).json()
    assert body["sources"] and all(s["page_start"] is None for s in body["sources"])
