from pathlib import Path

from app.core.exceptions import DocumentBusy, DocumentNotFound
from app.models.models.document import Document, DocumentStatus
from app.repositories.document_repo import DocumentRepository
from app.services.storage_service import StorageService
from app.vectorStores.vector_store import VectorStore


class DocumentService:
    """Read and delete operations on stored documents."""

    def __init__(
        self,
        repository: DocumentRepository,
        storage: StorageService,
        vector_store: VectorStore,
    ):
        self._repository = repository
        self._storage = storage
        self._vector_store = vector_store

    def list_documents(self) -> list[Document]:
        return self._repository.list_all()

    def get_document(self, document_id: str) -> Document:
        document = self._repository.get_by_id(document_id)
        if document is None:
            raise DocumentNotFound(document_id)
        return document

    def get_file_path(self, document_id: str) -> tuple[Document, Path]:
        document = self.get_document(document_id)
        path = self._storage.get_path(document.stored_filename)
        if not path.exists():
            raise DocumentNotFound(document_id)
        return document, path

    def delete_document(self, document_id: str) -> None:
        document = self.get_document(document_id)
        if document.status == DocumentStatus.PROCESSING:
            raise DocumentBusy(document_id)
        self._vector_store.delete(document_id)
        self._storage.delete(self._storage.get_path(document.stored_filename))
        self._repository.delete(document_id)
