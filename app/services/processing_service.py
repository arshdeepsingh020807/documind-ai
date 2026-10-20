import threading

from app.core.exceptions import DocumentAlreadyProcessed, DocumentBusy, DocumentNotFound
from app.models.models.document import Document, DocumentStatus
from app.models.models.processed_document import ProcessedDocument
from app.repositories.document_repo import DocumentRepository
from app.services.document_processor import DocumentProcessor


class ProcessingService:
    def __init__(self, repository: DocumentRepository, processor: DocumentProcessor):
        self._repository = repository
        self._processor = processor
        self._start_lock = threading.Lock()

    def start(self, document_id: str) -> Document:
        """Validate the document and mark it PROCESSING. The lock makes the check-and-set atomic,
        so a double click can't start the same document twice."""
        with self._start_lock:
            document = self._repository.get_by_id(document_id)
            if document is None:
                raise DocumentNotFound(document_id)
            if document.status == DocumentStatus.PROCESSED:
                raise DocumentAlreadyProcessed(document_id)
            if document.status == DocumentStatus.PROCESSING:
                raise DocumentBusy(document_id)
            document.status = DocumentStatus.PROCESSING
            document.error = None
            self._repository.update(document)
            return document

    def extract(self, document: Document) -> ProcessedDocument:
        return self._processor.process(document)
