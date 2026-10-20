"""Starts the real app in a subprocess (uvicorn, fake AI) and exercises it over HTTP.

These cover what in-process tests can't: real threads, real files on disk across a restart,
real CORS headers and static serving.
"""
import json
import os
import socket
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
import pytest

from tests.helpers import make_multipage_pdf

ROOT = Path(__file__).resolve().parent.parent


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class LiveServer:
    def __init__(self, data_dir: Path, **env: str):
        self.data_dir = data_dir
        self.port = free_port()
        self.url = f"http://127.0.0.1:{self.port}"
        self._env = {**os.environ, "E2E_DATA_DIR": str(data_dir), **env}
        self.proc: subprocess.Popen | None = None

    def start(self) -> "LiveServer":
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "tests.e2e_server", str(self.port)],
            cwd=ROOT, env=self._env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        )
        deadline = time.time() + 30
        while time.time() < deadline:
            if self.proc.poll() is not None:
                raise RuntimeError(f"server exited early: {self.proc.stderr.read().decode()[-2000:]}")
            try:
                if httpx.get(f"{self.url}/health", timeout=1).status_code == 200:
                    return self
            except httpx.HTTPError:
                time.sleep(0.2)
        raise RuntimeError("server did not become healthy")

    def stop(self) -> None:
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        if self.proc and self.proc.stderr:
            self.proc.stderr.close()

    def client(self, **kw) -> httpx.Client:
        return httpx.Client(base_url=self.url, timeout=30, **kw)


@pytest.fixture
def make_server(tmp_path):
    servers: list[LiveServer] = []

    def factory(data_dir: Path | None = None, **env: str) -> LiveServer:
        server = LiveServer(data_dir or tmp_path / f"data{len(servers)}", **env).start()
        servers.append(server)
        return server

    yield factory
    for server in servers:
        server.stop()


TEXT = ("The Aurora project studies glacier melt in Iceland. The lead scientist is Dr Helga Sigurdsson. " * 20).encode()


def upload(c: httpx.Client, name="notes.txt", content=TEXT) -> str:
    r = c.post("/documents/upload", files={"file": (name, content)})
    assert r.status_code == 201, r.text
    return r.json()["document_id"]


def test_full_lifecycle_over_real_http(make_server):
    server = make_server()
    with server.client() as c:
        doc_id = upload(c, "aurora.pdf", make_multipage_pdf(["Aurora studies glacier melt. " * 40, "Penguins in Antarctica. " * 40]))
        assert c.post(f"/documents/{doc_id}/process").status_code == 200

        listed = c.get("/documents").json()
        assert [(d["id"], d["status"], d["pages"]) for d in listed] == [(doc_id, "processed", 2)]

        chat = c.post("/documents/chat", json={"document_id": doc_id, "question": "glacier melt"}).json()
        assert chat["answer"].endswith("[1]")
        assert chat["sources"][0]["number"] == 1 and chat["sources"][0]["page_start"] == 1

        download = c.get(f"/documents/{doc_id}/file")
        assert download.headers["content-type"] == "application/pdf"
        assert download.content.startswith(b"%PDF")

        assert c.delete(f"/documents/{doc_id}").status_code == 204
        assert c.get(f"/documents/{doc_id}").status_code == 404
    assert list((server.data_dir / "uploads").iterdir()) == []
    assert list((server.data_dir / "vector_store").iterdir()) == []


def test_concurrent_process_requests_run_exactly_once(make_server):
    """The double-click guard: many simultaneous requests, one winner, the rest told 409."""
    server = make_server()
    with server.client() as c:
        doc_id = upload(c, "big.txt", (b"word " * 8000))  # ~16 chunks so processing takes a moment

        workers = 16
        barrier = threading.Barrier(workers)

        def fire(_):
            with server.client() as own:
                barrier.wait()  # release every request at the same instant to maximise the race
                return own.post(f"/documents/{doc_id}/process").status_code

        with ThreadPoolExecutor(max_workers=workers) as pool:
            codes = list(pool.map(fire, range(workers)))

        assert codes.count(200) == 1, codes
        assert set(codes) <= {200, 409}, codes
        assert c.get(f"/documents/{doc_id}").json()["status"] == "processed"


def test_concurrent_uploads_lose_nothing(make_server):
    server = make_server()

    def send(i):
        with server.client() as c:
            return c.post("/documents/upload", files={"file": (f"doc-{i}.txt", TEXT)}).status_code

    with ThreadPoolExecutor(max_workers=12) as pool:
        codes = list(pool.map(send, range(30)))
    assert codes == [201] * 30

    with server.client() as c:
        assert len(c.get("/documents").json()) == 30
    json.loads((server.data_dir / "document.json").read_text())  # still valid JSON
    assert len(list((server.data_dir / "uploads").iterdir())) == 30


def test_data_survives_a_restart(make_server):
    first = make_server()
    with first.client() as c:
        doc_id = upload(c)
        c.post(f"/documents/{doc_id}/process")
    first.stop()

    second = make_server(data_dir=first.data_dir)
    with second.client() as c:
        assert [d["status"] for d in c.get("/documents").json()] == ["processed"]
        chat = c.post("/documents/chat", json={"document_id": doc_id, "question": "who is the lead scientist"})
        assert chat.status_code == 200 and chat.json()["sources"], "the FAISS index must load from disk after a restart"


def test_interrupted_processing_is_recovered_on_startup(make_server, tmp_path):
    data_dir = tmp_path / "crashed"
    data_dir.mkdir()
    (data_dir / "uploads").mkdir()
    (data_dir / "uploads" / "x.txt").write_text("hello")
    (data_dir / "document.json").write_text(json.dumps([{
        "id": "stuck", "stored_filename": "x.txt", "original_filename": "x.txt", "file_type": "txt",
        "status": "processing", "file_size": 5, "uploaded_at": "2026-01-01T00:00:00", "pages": None, "error": None,
    }]))
    server = make_server(data_dir=data_dir)
    with server.client() as c:
        doc = c.get("/documents/stuck").json()
        assert doc["status"] == "failed" and "interrupted" in doc["error"]
        # and it is retryable, not stuck forever
        assert c.post("/documents/stuck/process").status_code == 200


def test_upload_size_limit_is_enforced_by_the_real_server(make_server):
    server = make_server(MAX_UPLOAD_MB="1")
    with server.client() as c:
        too_big = c.post("/documents/upload", files={"file": ("big.txt", b"a" * (1024 * 1024 + 10))})
        assert too_big.status_code == 413
        assert "1 MB" in too_big.json()["detail"]
        assert c.post("/documents/upload", files={"file": ("ok.txt", b"a" * 1000)}).status_code == 201
    assert len(list((server.data_dir / "uploads").iterdir())) == 1, "the rejected upload must not be left on disk"


def test_cors_allows_the_dev_origin_and_nobody_else(make_server):
    server = make_server()
    with server.client() as c:
        ok = c.options("/documents", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
        assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
        bad = c.options("/documents", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
        assert "access-control-allow-origin" not in bad.headers


def test_frontend_is_served_with_spa_fallback_and_honest_api_404s(make_server, tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>spa</title>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    server = make_server(FRONTEND_DIST=str(dist))
    with server.client() as c:
        assert "<title>spa</title>" in c.get("/").text
        assert "<title>spa</title>" in c.get("/d/some-document-id").text
        assert c.get("/assets/app.js").text == "console.log(1)"
        assert c.get("/assets/missing.js").status_code == 404
        api_404 = c.get("/documents/nope")
        assert api_404.status_code == 404 and api_404.headers["content-type"].startswith("application/json")
        assert c.get("/health").json() == {"status": "ok"}
        # Traversal must fall back to the SPA shell, never read outside the dist folder.
        traversal = c.get("/%2e%2e/%2e%2e/%2e%2e/etc/passwd")
        assert "root:" not in traversal.text and "<title>spa</title>" in traversal.text
