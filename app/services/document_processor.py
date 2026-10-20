import re
from datetime import datetime

import fitz

from app.core.exceptions import DocumentProcessingError
from app.models.models.document import Document, DocumentType
from app.models.models.processed_document import ProcessedDocument
from app.services.storage_service import StorageService


class DocumentProcessor:
    """Extracts text with PyMuPDF, which reads PDF, DOCX, TXT and MD."""

    def __init__(self, storage: StorageService):
        self._storage = storage

    def process(self, document: Document) -> ProcessedDocument:
        path = self._storage.get_path(document.stored_filename)
        pages = self._extract_pages(path)
        clean_text = self._clean_text("\n".join(pages))
        if not clean_text:
            raise DocumentProcessingError(
                "No readable text found. Scanned or image-only documents are not supported."
            )
        return ProcessedDocument(
            document_id=document.id,
            text=clean_text,
            word_count=len(clean_text.split()),
            processed_at=datetime.now(),
            page_count=len(pages),
            page_word_starts=self._page_word_starts(pages) if document.file_type == DocumentType.PDF else [],
        )

    def _extract_pages(self, path) -> list[str]:
        try:
            with fitz.open(path) as doc:
                return [page.get_text() for page in doc]
        except Exception as e:
            raise DocumentProcessingError(f"The file could not be opened: {e}") from e

    def _page_word_starts(self, pages: list[str]) -> list[int]:
        # Cleaning only normalises whitespace, so per-page word counts add up to the cleaned text's.
        # Only PDFs have real pages; DOCX/TXT/MD are re-flowed by PyMuPDF, so their "pages" would mislead.
        starts, total = [], 0
        for page in pages:
            starts.append(total)
            total += len(page.split())
        return starts

    def _clean_text(self, text: str) -> str:
        text = text.strip()
        text = text.replace("\t", " ")
        text = re.sub(r"[ ]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text
