import logging

from app.core.exceptions import DocuMindError, DocumentProcessingError
from app.models.models.document import Document, DocumentStatus
from app.models.models.processed_document import ProcessedDocument
from app.repositories.document_repo import DocumentRepository
from app.services.chunking_service import ChunkingService
from app.services.EmbeddingService import EmbeddingService
from app.services.processing_service import ProcessingService
from app.vectorStores.vector_store import VectorStore

logger = logging.getLogger(__name__)


class IndexingService:

    def __init__(
        self,
        document_repository: DocumentRepository,
        processing_service: ProcessingService,
        chunking_service: ChunkingService,
        embedding_service: EmbeddingService,
        vector_store: VectorStore,
    ):
        self._document_repository = document_repository
        self._processing_service = processing_service
        self._chunking_service = chunking_service
        self._embedding_service = embedding_service
        self._vector_store = vector_store

    def index_document(self, document_id: str) -> ProcessedDocument:
        document = self._processing_service.start(document_id)
        try:
            processed = self._processing_service.extract(document)
            chunks = self._chunking_service.chunk_document(processed)
            if not chunks:
                raise DocumentProcessingError("The document produced no text to index.")
            embedded_chunks = self._embedding_service.embed_chunks(chunks)
            self._vector_store.add(embedded_chunks)
        except Exception as e:
            self._mark_failed(document, e)
            raise

        # Only now is the document searchable, so only now is it PROCESSED.
        document.pages = processed.page_count
        document.status = DocumentStatus.PROCESSED
        document.error = None
        self._document_repository.update(document)
        return processed

    def _mark_failed(self, document: Document, error: Exception) -> None:
        if not isinstance(error, DocuMindError):
            logger.exception("Unexpected error while indexing %s", document.id)
        document.status = DocumentStatus.FAILED
        document.error = str(error) if isinstance(error, DocuMindError) else "Unexpected error while processing."
        self._document_repository.update(document)
