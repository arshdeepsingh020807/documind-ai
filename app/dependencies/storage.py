from functools import lru_cache

from app.core.config import settings
from app.services.storage_service import StorageService


@lru_cache
def get_storage_service() -> StorageService:
    return StorageService(settings.UPLOAD_DIRECTORY)
