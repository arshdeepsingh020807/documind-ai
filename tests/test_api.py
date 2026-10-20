import pytest

from tests.helpers import TEXT, make_blank_pdf, make_docx, make_pdf, upload

SAMPLES = {
    "notes.txt": TEXT.encode(),
    "notes.md": ("# Aurora\n\n" + TEXT).encode(),
    "report.pdf": make_pdf(),
    "report.docx": make_docx(),
}


def uploaded_id(client, name="notes.txt", content=None) -> str:
    response = upload(client, name, content if content is not None else SAMPLES[name])
    assert response.status_code == 201, response.text
    return response.json()["document_id"]


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_list_is_empty_initially(client):
    assert client.get("/documents").json() == []


def test_upload_returns_contract_and_lists_document(client):
    response = upload(client, "notes.txt", TEXT.encode())
    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"document_id", "filename", "status", "message"}
    assert body["filename"] == "notes.txt"
    assert body["status"] == "uploaded"

    listed = client.get("/documents").json()
    assert [d["id"] for d in listed] == [body["document_id"]]
    assert listed[0]["filename"] == "notes.txt"
    assert "stored_filename" not in listed[0]


def test_list_is_newest_first(client):
    first = uploaded_id(client)
    second = uploaded_id(client)
    assert [d["id"] for d in client.get("/documents").json()] == [second, first]


def test_upload_rejects_unsupported_type(client):
    response = upload(client, "malware.exe", b"x")
    assert response.status_code == 400
    assert ".exe" in response.json()["detail"]
    assert client.get("/documents").json() == []


def test_upload_rejects_empty_file_and_cleans_up(client, storage):
    response = upload(client, "empty.txt", b"")
    assert response.status_code == 400
    assert list(storage.upload_dir.iterdir()) == []


def test_upload_rejects_oversize_file(client, storage, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
    response = upload(client, "big.txt", b"a" * (1024 * 1024 + 1))
    assert response.status_code == 413
    assert list(storage.upload_dir.iterdir()) == []


def test_upload_without_file_is_422(client):
    assert client.post("/documents/upload").status_code == 422


def test_get_document_and_404(client):
    doc_id = uploaded_id(client)
    assert client.get(f"/documents/{doc_id}").json()["id"] == doc_id
    missing = client.get("/documents/nope")
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Document not found."}


def test_download_returns_original_bytes_and_name(client):
    doc_id = uploaded_id(client)
    response = client.get(f"/documents/{doc_id}/file")
    assert response.status_code == 200
    assert response.content == TEXT.encode()
    assert "notes.txt" in response.headers["content-disposition"]
    assert client.get("/documents/nope/file").status_code == 404


@pytest.mark.parametrize("name", list(SAMPLES))
def test_process_every_supported_file_type(client, name):
    doc_id = uploaded_id(client, name)
    response = client.post(f"/documents/{doc_id}/process")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "processed"
    assert body["page_count"] >= 1
    assert body["word_count"] > 10

    document = client.get(f"/documents/{doc_id}").json()
    assert document["status"] == "processed"
    assert document["pages"] == body["page_count"]


def test_process_unknown_document_is_404(client):
    assert client.post("/documents/nope/process").status_code == 404


def test_process_twice_is_409(client):
    doc_id = uploaded_id(client)
    assert client.post(f"/documents/{doc_id}/process").status_code == 200
    again = client.post(f"/documents/{doc_id}/process")
    assert again.status_code == 409
    assert "already" in again.json()["detail"]


def test_process_blank_pdf_fails_with_reason_and_can_be_listed(client):
    doc_id = uploaded_id(client, "scan.pdf", make_blank_pdf())
    response = client.post(f"/documents/{doc_id}/process")
    assert response.status_code == 422
    document = client.get(f"/documents/{doc_id}").json()
    assert document["status"] == "failed"
    assert "No readable text" in document["error"]


def test_process_corrupt_file_marks_failed(client):
    doc_id = uploaded_id(client, "bad.pdf", b"this is not a pdf")
    assert client.post(f"/documents/{doc_id}/process").status_code == 422
    assert client.get(f"/documents/{doc_id}").json()["status"] == "failed"


def test_embedding_failure_marks_failed_not_processed_and_retry_works(client, fake_openai):
    doc_id = uploaded_id(client)
    fake_openai.fail_with = "rate_limit"
    response = client.post(f"/documents/{doc_id}/process")
    assert response.status_code == 502
    assert "rate limit" in response.json()["detail"].lower()
    document = client.get(f"/documents/{doc_id}").json()
    assert document["status"] == "failed"
    assert document["error"]

    # Chat must refuse rather than crash on the missing index.
    chat = client.post("/documents/chat", json={"question": "hi", "document_id": doc_id})
    assert chat.status_code == 409

    fake_openai.fail_with = None
    assert client.post(f"/documents/{doc_id}/process").status_code == 200
    assert client.get(f"/documents/{doc_id}").json()["status"] == "processed"
    assert client.get(f"/documents/{doc_id}").json()["error"] is None


def test_provider_error_never_leaks_api_key(client, fake_openai):
    doc_id = uploaded_id(client)
    fake_openai.fail_with = "auth"
    response = client.post(f"/documents/{doc_id}/process")
    assert response.status_code == 502
    assert "sk-secret" not in response.text


def test_embeddings_are_batched(client, fake_openai):
    doc_id = uploaded_id(client, "long.txt", ("word " * 3000).encode())
    assert client.post(f"/documents/{doc_id}/process").status_code == 200
    # 3000 words at 500/100 overlap is ~8 chunks: one batched call, not one call per chunk.
    assert len(fake_openai.embedding_calls) == 1
    assert fake_openai.embedding_calls[0] > 1


def test_chat_returns_answer_and_sources(client):
    doc_id = uploaded_id(client)
    client.post(f"/documents/{doc_id}/process")
    response = client.post(
        "/documents/chat",
        json={"question": "Who is the lead scientist?", "document_id": doc_id},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "FAKE ANSWER to: Who is the lead scientist? [1]"
    assert body["sources"]
    source = body["sources"][0]
    assert set(source) == {"number", "chunk_index", "page_start", "page_end", "text", "relevance"}
    assert source["number"] == 1
    assert "Helga" in source["text"]
    assert 0 <= source["relevance"] <= 1


def test_chat_before_processing_is_409(client):
    doc_id = uploaded_id(client)
    response = client.post("/documents/chat", json={"question": "hi", "document_id": doc_id})
    assert response.status_code == 409
    assert "Process this document" in response.json()["detail"]


def test_chat_unknown_document_is_404(client):
    response = client.post("/documents/chat", json={"question": "hi", "document_id": "nope"})
    assert response.status_code == 404


@pytest.mark.parametrize("payload", [
    {"question": "", "document_id": "x"},
    {"question": "hi", "document_id": ""},
    {"question": "x" * 2001, "document_id": "x"},
    {"document_id": "x"},
])
def test_chat_validates_input(client, payload):
    assert client.post("/documents/chat", json=payload).status_code == 422


def test_chat_llm_failure_is_502(client, fake_openai):
    doc_id = uploaded_id(client)
    client.post(f"/documents/{doc_id}/process")
    fake_openai.fail_with = "connection"
    response = client.post("/documents/chat", json={"question": "hi", "document_id": doc_id})
    assert response.status_code == 502


def test_delete_removes_file_metadata_and_index(client, storage, vector_store):
    doc_id = uploaded_id(client)
    client.post(f"/documents/{doc_id}/process")
    assert any(vector_store._storage_directory.iterdir())

    assert client.delete(f"/documents/{doc_id}").status_code == 204

    assert client.get(f"/documents/{doc_id}").status_code == 404
    assert client.get("/documents").json() == []
    assert list(storage.upload_dir.iterdir()) == []
    assert list(vector_store._storage_directory.iterdir()) == []
    assert client.delete(f"/documents/{doc_id}").status_code == 404


def test_delete_rejected_while_processing(client, repository):
    from app.models.models.document import DocumentStatus

    doc_id = uploaded_id(client)
    document = repository.get_by_id(doc_id)
    document.status = DocumentStatus.PROCESSING
    repository.update(document)
    assert client.delete(f"/documents/{doc_id}").status_code == 409
    assert client.post(f"/documents/{doc_id}/process").status_code == 409


def test_documents_are_isolated_in_search(client):
    a = uploaded_id(client, "a.txt", b"Penguins live in Antarctica and eat krill. " * 40)
    b = uploaded_id(client, "b.txt", b"Camels live in the Sahara desert and drink water. " * 40)
    client.post(f"/documents/{a}/process")
    client.post(f"/documents/{b}/process")
    body = client.post("/documents/chat", json={"question": "penguins krill", "document_id": b}).json()
    assert all("Penguins" not in s["text"] for s in body["sources"])


def test_unknown_api_path_404s_not_spa(client):
    assert client.get("/documents/x/y/z").status_code == 404
