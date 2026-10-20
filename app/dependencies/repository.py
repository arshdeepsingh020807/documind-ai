from functools import lru_cache

from app.core.config import settings
from app.repositories.document_repo import DocumentRepository


@lru_cache
def get_document_repository() -> DocumentRepository:
    return DocumentRepository(settings.DOCUMENT_STORE_FILE)
