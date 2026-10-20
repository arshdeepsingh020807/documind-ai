"""Drives the real OpenAI SDK against a local stand-in for an OpenAI-compatible provider (e.g. OpenRouter),
to check what actually goes over the wire: paths, auth header and request bodies."""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
from openai import OpenAI

from app.dependencies.services import get_openai_client
from main import app
from tests.fakes import DIMENSION, _vector
from tests.helpers import upload

KEY = "sk-or-v1-test-key"


class _Provider(BaseHTTPRequestHandler):
    requests: list[dict] = []
    mode = "ok"

    def log_message(self, *args):  # silence
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        type(self).requests.append({"path": self.path, "auth": self.headers.get("Authorization"), "body": body})
        if type(self).mode == "unauthorized":
            return self._send(401, {"error": {"message": "No auth credentials found", "code": 401}})
        if self.path.endswith("/embeddings"):
            inputs = [body["input"]] if isinstance(body["input"], str) else body["input"]
            data = [{"object": "embedding", "index": i, "embedding": _vector(t)} for i, t in enumerate(inputs)]
            return self._send(200, {"object": "list", "data": data, "model": body["model"], "usage": {"prompt_tokens": 1, "total_tokens": 1}})
        if self.path.endswith("/chat/completions"):
            return self._send(200, {
                "id": "gen-1", "object": "chat.completion", "created": 1, "model": body["model"],
                "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": "The answer is 42 [1]."}}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            })
        self._send(404, {"error": {"message": f"no route {self.path}"}})

    def _send(self, status, payload):
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


@pytest.fixture
def provider():
    _Provider.requests = []
    _Provider.mode = "ok"
    server = HTTPServer(("127.0.0.1", 0), _Provider)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}/api/v1", _Provider
    server.shutdown()
    server.server_close()


@pytest.fixture
def compat_client(client, provider):
    base_url, _ = provider
    real_sdk = OpenAI(api_key=KEY, base_url=base_url, max_retries=0)
    app.dependency_overrides[get_openai_client] = lambda: real_sdk
    return client


def test_pipeline_uses_the_providers_address_key_and_float_embeddings(compat_client, provider):
    _, handler = provider
    doc_id = upload(compat_client, "notes.txt", b"The answer to everything is forty two. " * 40).json()["document_id"]
    assert compat_client.post(f"/documents/{doc_id}/process").status_code == 200
    chat = compat_client.post("/documents/chat", json={"question": "What is the answer?", "document_id": doc_id})

    assert chat.status_code == 200, chat.text
    assert chat.json()["answer"] == "The answer is 42 [1]."
    assert chat.json()["sources"][0]["number"] == 1

    paths = [r["path"] for r in handler.requests]
    assert paths.count("/api/v1/embeddings") == 2 and paths.count("/api/v1/chat/completions") == 1
    assert {r["auth"] for r in handler.requests} == {f"Bearer {KEY}"}

    embeddings = [r["body"] for r in handler.requests if r["path"].endswith("/embeddings")]
    assert all(b["encoding_format"] == "float" and b["model"] == "text-embedding-3-small" for b in embeddings)
    assert len(embeddings[0]["input"]) >= 1 and isinstance(embeddings[0]["input"], list)

    completion = next(r["body"] for r in handler.requests if r["path"].endswith("/chat/completions"))
    assert [m["role"] for m in completion["messages"]] == ["user"]
    prompt = completion["messages"][0]["content"]
    assert "[1]" in prompt and "What is the answer?" in prompt


def test_embedding_vectors_have_the_configured_size(compat_client, provider, vector_store):
    doc_id = upload(compat_client, "notes.txt", b"hello world " * 50).json()["document_id"]
    compat_client.post(f"/documents/{doc_id}/process")
    results = vector_store.search(_vector("hello"), doc_id, k=1)
    assert len(results[0].chunk.embeddings) == DIMENSION


def test_a_rejected_key_becomes_a_helpful_message_without_leaking_it(compat_client, provider):
    _, handler = provider
    doc_id = upload(compat_client, "notes.txt", b"some text " * 30).json()["document_id"]
    handler.mode = "unauthorized"
    response = compat_client.post(f"/documents/{doc_id}/process")
    assert response.status_code == 502
    assert "rejected the API key" in response.json()["detail"]
    assert KEY not in response.text
    assert compat_client.get(f"/documents/{doc_id}").json()["status"] == "failed"
