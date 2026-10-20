import json
import threading
from datetime import datetime

import pytest

from app.core.exceptions import DocumentNotFound, DocumentProcessingError, RepositoryError
from app.models.models.chunk import Chunk
from app.models.models.document import Document, DocumentStatus, DocumentType
from app.models.models.embeddingclass import EmbeddedChunk
from app.models.models.processed_document import ProcessedDocument
from app.services.chunking_service import ChunkingService
from tests.fakes import DIMENSION, _vector


def make_document(doc_id="d1", status=DocumentStatus.UPLOADED, uploaded_at=None) -> Document:
    return Document(
        id=doc_id,
        stored_filename=f"{doc_id}.txt",
        original_filename="a.txt",
        file_type=DocumentType.TXT,
        status=status,
        file_size=1,
        uploaded_at=uploaded_at or datetime(2026, 1, 1),
    )


# ---- repository ----

def test_repository_roundtrip_update_delete(repository):
    repository.save(make_document("a"))
    assert repository.get_by_id("a").status == DocumentStatus.UPLOADED
    assert repository.get_by_id("zzz") is None

    doc = repository.get_by_id("a")
    doc.status = DocumentStatus.PROCESSED
    repository.update(doc)
    assert repository.get_by_id("a").status == DocumentStatus.PROCESSED

    repository.delete("a")
    assert repository.list_all() == []


def test_repository_update_and_delete_missing_raise_not_found(repository):
    with pytest.raises(DocumentNotFound):
        repository.update(make_document("ghost"))
    with pytest.raises(DocumentNotFound):
        repository.delete("ghost")


def test_repository_list_sorted_newest_first(repository):
    repository.save(make_document("old", uploaded_at=datetime(2026, 1, 1)))
    repository.save(make_document("new", uploaded_at=datetime(2026, 6, 1)))
    assert [d.id for d in repository.list_all()] == ["new", "old"]


def test_repository_corrupt_file_raises_repository_error(repository):
    repository.data_file.write_text("{not json")
    with pytest.raises(RepositoryError):
        repository.list_all()


def test_repository_concurrent_saves_lose_nothing(repository):
    def save(i):
        repository.save(make_document(f"doc-{i}"))

    threads = [threading.Thread(target=save, args=(i,)) for i in range(40)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert len(repository.list_all()) == 40
    json.loads(repository.data_file.read_text())  # file is still valid JSON
    assert not list(repository.data_file.parent.glob(".document-*.tmp"))


def test_fail_interrupted_only_touches_processing(repository):
    repository.save(make_document("p", status=DocumentStatus.PROCESSING))
    repository.save(make_document("ok", status=DocumentStatus.PROCESSED))
    assert repository.fail_interrupted() == 1
    assert repository.get_by_id("p").status == DocumentStatus.FAILED
    assert "interrupted" in repository.get_by_id("p").error
    assert repository.get_by_id("ok").status == DocumentStatus.PROCESSED


# ---- chunking ----

def processed(text: str) -> ProcessedDocument:
    return ProcessedDocument(
        document_id="d", text=text, word_count=len(text.split()),
        processed_at=datetime.now(), page_count=1,
    )


def test_chunking_overlaps_and_covers_all_words():
    words = [f"w{i}" for i in range(250)]
    chunks = ChunkingService(chunk_size=100, overlap=20).chunk_document(processed(" ".join(words)))
    assert [c.chunk_index for c in chunks] == [1, 2, 3, 4]
    assert chunks[0].text.split()[-20:] == chunks[1].text.split()[:20]
    assert chunks[-1].text.split()[-1] == "w249"


def test_chunking_empty_text_gives_no_chunks():
    assert ChunkingService().chunk_document(processed("")) == []


def test_chunking_rejects_overlap_not_smaller_than_size():
    with pytest.raises(ValueError):
        ChunkingService(chunk_size=10, overlap=10)


# ---- vector store ----

def embedded(doc_id, idx, text) -> EmbeddedChunk:
    chunk = Chunk(id=f"{doc_id}-{idx}", document_id=doc_id, chunk_index=idx, text=text,
                  word_count=len(text.split()), start_offset=0, end_offset=1)
    return EmbeddedChunk(chunk=chunk, embeddings=_vector(text))


def test_vector_store_returns_nearest_chunk_first(vector_store):
    vector_store.add([embedded("d", 1, "glacier melt iceland"), embedded("d", 2, "banana bread recipe")])
    results = vector_store.search(_vector("glacier iceland"), "d", k=2)
    assert results[0].chunk.chunk.chunk_index == 1
    assert results[0].distance < results[1].distance


def test_vector_store_missing_index_returns_empty(vector_store):
    assert vector_store.search(_vector("x"), "never-indexed") == []


def test_vector_store_rejects_wrong_dimension(vector_store):
    bad = embedded("d", 1, "text")
    bad.embeddings = [0.1] * (DIMENSION - 1)
    with pytest.raises(DocumentProcessingError, match="EMBEDDING_DIMENSION"):
        vector_store.add([bad])


def test_vector_store_delete_is_idempotent(vector_store):
    vector_store.add([embedded("d", 1, "hello")])
    vector_store.delete("d")
    vector_store.delete("d")
    assert vector_store.search(_vector("hello"), "d") == []


# ---- frontend serving ----

def test_spa_fallback_serves_index_and_assets(tmp_path, monkeypatch):
    import importlib

    from app.core.config import settings

    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>SPA</html>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "secret.txt").write_text("TOP SECRET")
    monkeypatch.setattr(settings, "FRONTEND_DIST", str(dist))

    import main
    from fastapi.testclient import TestClient

    fresh = importlib.reload(main)
    try:
        with TestClient(fresh.app) as c:
            assert "SPA" in c.get("/").text
            assert "SPA" in c.get("/d/some-id").text
            assert c.get("/assets/app.js").text == "console.log(1)"
            assert c.get("/health").json() == {"status": "ok"}
            assert c.get("/documents/nope").status_code == 404
            assert "SECRET" not in c.get("/..%2Fsecret.txt").text
            assert "SECRET" not in c.get("/%2e%2e/secret.txt").text
    finally:
        monkeypatch.undo()
        importlib.reload(main)
