"""Runs the real app (built frontend included) against an offline fake OpenAI client.

    python -m tests.e2e_server [port]

Data goes to a throwaway directory, never the project's own data/ or uploads/.
"""
import os
import sys
import tempfile
from pathlib import Path

_DATA_DIR = Path(os.environ.get("E2E_DATA_DIR") or tempfile.mkdtemp(prefix="documind-e2e-"))
os.environ.setdefault("OPENAI_API_KEY", "e2e-key")
os.environ["UPLOAD_DIRECTORY"] = str(_DATA_DIR / "uploads")
os.environ["DOCUMENT_STORE_FILE"] = str(_DATA_DIR / "document.json")
os.environ["VECTOR_STORE_DIRECTORY"] = str(_DATA_DIR / "vector_store")

import uvicorn  # noqa: E402

from app.dependencies.services import get_openai_client  # noqa: E402
from main import app  # noqa: E402
from tests.fakes import FakeOpenAI  # noqa: E402

_FAKE = FakeOpenAI()
app.dependency_overrides[get_openai_client] = lambda: _FAKE

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"e2e data dir: {_DATA_DIR}", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
