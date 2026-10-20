import fitz

from app.core.exceptions import DocumentNotProcessed, PreviewNotAvailable
from app.models.models.document import DocumentStatus, DocumentType
from app.services.document_service import DocumentService
from app.vectorStores.vector_store import VectorStore

HIGHLIGHT_COLOR = (1.0, 0.9, 0.45)  # keeps black text above APCA Lc 90 while staying clearly yellow
MAX_PIXEL_WIDTH = 1000
TARGET_DPI = 110
WINDOW_WORDS = 8
MAX_WINDOWS = 80


def render_page(path, page_number: int, passage_text: str) -> bytes:
    """PNG of one PDF page with the passage's text highlighted.

    The passage is searched in short word windows, because a long phrase breaks on line wraps, hyphens and
    odd spacing. Windows that aren't found on this page are skipped, so a miss yields the plain page.
    """
    with fitz.open(path) as pdf:
        page = pdf[page_number - 1]
        words = passage_text.split()
        for start in range(0, min(len(words), MAX_WINDOWS * WINDOW_WORDS), WINDOW_WORDS):
            window = words[start:start + WINDOW_WORDS]
            if len(window) < 3:
                continue
            for rect in page.search_for(" ".join(window)):
                page.add_highlight_annot(rect).set_colors(stroke=HIGHLIGHT_COLOR)
        zoom = min(TARGET_DPI / 72, MAX_PIXEL_WIDTH / page.rect.width)
        return page.get_pixmap(matrix=fitz.Matrix(zoom, zoom)).tobytes("png")


class PagePreviewService:
    def __init__(self, document_service: DocumentService, vector_store: VectorStore):
        self._documents = document_service
        self._vector_store = vector_store

    def preview(self, document_id: str, chunk_index: int, page: int) -> bytes:
        document, path = self._documents.get_file_path(document_id)
        if document.status != DocumentStatus.PROCESSED:
            raise DocumentNotProcessed(document_id)
        if document.file_type != DocumentType.PDF:
            raise PreviewNotAvailable("Page previews are only available for PDF documents.")

        embedded = self._vector_store.get_chunk(document_id, chunk_index)
        if embedded is None:
            raise PreviewNotAvailable("That passage no longer exists. Process the document again.")
        chunk = embedded.chunk
        if chunk.page_start is None or not chunk.page_start <= page <= (chunk.page_end or chunk.page_start):
            raise PreviewNotAvailable("That passage is not on this page.")

        return render_page(path, page, chunk.text)
