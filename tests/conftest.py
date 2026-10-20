import os
import tempfile
from pathlib import Path

# Must run before `main` is imported: settings are read at import time and the real
# stores must never point at the project's own data/ and uploads/ folders.
_SESSION_DIR = Path(tempfile.mkdtemp(prefix="documind-tests-"))
os.environ["OPENAI_API_KEY"] = "test-key"
os.environ["UPLOAD_DIRECTORY"] = str(_SESSION_DIR / "uploads")
os.environ["DOCUMENT_STORE_FILE"] = str(_SESSION_DIR / "document.json")
os.environ["VECTOR_STORE_DIRECTORY"] = str(_SESSION_DIR / "vector_store")
os.environ["FRONTEND_DIST"] = str(_SESSION_DIR / "no-frontend")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.dependencies.repository import get_document_repository  # noqa: E402
from app.dependencies.services import get_openai_client  # noqa: E402
from app.dependencies.storage import get_storage_service  # noqa: E402
from app.dependencies.vector_store import get_vector_store  # noqa: E402
from app.repositories.document_repo import DocumentRepository  # noqa: E402
from app.services.storage_service import StorageService  # noqa: E402
from app.vectorStores.faiss_vector_store import FaissVectorStore  # noqa: E402
from main import app  # noqa: E402
from tests.fakes import DIMENSION, FakeOpenAI  # noqa: E402


@pytest.fixture
def fake_openai() -> FakeOpenAI:
    return FakeOpenAI()


@pytest.fixture
def repository(tmp_path) -> DocumentRepository:
    return DocumentRepository(str(tmp_path / "document.json"))


@pytest.fixture
def storage(tmp_path) -> StorageService:
    return StorageService(str(tmp_path / "uploads"))


@pytest.fixture
def vector_store(tmp_path) -> FaissVectorStore:
    return FaissVectorStore(DIMENSION, str(tmp_path / "vector_store"))


@pytest.fixture
def client(repository, storage, vector_store, fake_openai):
    app.dependency_overrides[get_document_repository] = lambda: repository
    app.dependency_overrides[get_storage_service] = lambda: storage
    app.dependency_overrides[get_vector_store] = lambda: vector_store
    app.dependency_overrides[get_openai_client] = lambda: fake_openai
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
