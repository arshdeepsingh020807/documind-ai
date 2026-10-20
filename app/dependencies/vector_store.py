from functools import lru_cache

from app.core.config import settings
from app.vectorStores.faiss_vector_store import FaissVectorStore
from app.vectorStores.vector_store import VectorStore


@lru_cache
def get_vector_store() -> VectorStore:
    return FaissVectorStore(
        embedding_dimension=settings.EMBEDDING_DIMENSION,
        storage_directory=settings.VECTOR_STORE_DIRECTORY,
    )
