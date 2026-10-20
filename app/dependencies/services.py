from functools import lru_cache

from fastapi import Depends
from openai import OpenAI

from app.core.config import settings
from app.dependencies.repository import get_document_repository
from app.dependencies.storage import get_storage_service
from app.dependencies.vector_store import get_vector_store
from app.llm.llm_service import LLMService
from app.llm.openai_llm_service import OpenAILLMService
from app.repositories.document_repo import DocumentRepository
from app.services.chatService import ChatService
from app.services.chunking_service import ChunkingService
from app.services.document_processor import DocumentProcessor
from app.services.document_service import DocumentService
from app.services.EmbeddingService import EmbeddingService
from app.services.IndexingService import IndexingService
from app.services.processing_service import ProcessingService
from app.services.prompt_builder import PromptBuilder
from app.services.RetrievalService import RetriverService
from app.services.storage_service import StorageService
from app.services.upload_service import UploadService
from app.vectorStores.vector_store import VectorStore


@lru_cache
def get_openai_client() -> OpenAI:
    return OpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL or None,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
        max_retries=2,
    )


# Holds the in-flight lock, so it must be shared across requests.
@lru_cache
def _processing_service_for(
    repository: DocumentRepository, storage: StorageService
) -> ProcessingService:
    return ProcessingService(
        repository=repository, processor=DocumentProcessor(storage)
    )


def get_upload_service(
    storage: StorageService = Depends(get_storage_service),
    repository: DocumentRepository = Depends(get_document_repository),
) -> UploadService:
    return UploadService(
        storage_service=storage,
        document_repository=repository,
        max_upload_bytes=settings.max_upload_bytes,
    )


def get_document_service(
    repository: DocumentRepository = Depends(get_document_repository),
    storage: StorageService = Depends(get_storage_service),
    vector_store: VectorStore = Depends(get_vector_store),
) -> DocumentService:
    return DocumentService(
        repository=repository, storage=storage, vector_store=vector_store
    )


def get_processing_service(
    repository: DocumentRepository = Depends(get_document_repository),
    storage: StorageService = Depends(get_storage_service),
) -> ProcessingService:
    return _processing_service_for(repository, storage)


def get_embedding_service(
    client: OpenAI = Depends(get_openai_client),
) -> EmbeddingService:
    return EmbeddingService(
        client=client,
        model_name=settings.EMBEDDING_MODEL,
        batch_size=settings.EMBEDDING_BATCH_SIZE,
    )


def get_indexing_service(
    repository: DocumentRepository = Depends(get_document_repository),
    processing_service: ProcessingService = Depends(get_processing_service),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    vector_store: VectorStore = Depends(get_vector_store),
) -> IndexingService:
    return IndexingService(
        document_repository=repository,
        processing_service=processing_service,
        chunking_service=ChunkingService(
            chunk_size=settings.CHUNK_SIZE, overlap=settings.CHUNK_OVERLAP
        ),
        embedding_service=embedding_service,
        vector_store=vector_store,
    )


def get_llm_service(client: OpenAI = Depends(get_openai_client)) -> LLMService:
    return OpenAILLMService(client=client, model=settings.OPENAI_MODEL)


def get_retrieval_service(
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    vector_store: VectorStore = Depends(get_vector_store),
) -> RetriverService:
    return RetriverService(embedding_service=embedding_service, vectorStore=vector_store)


def get_chat_service(
    retrieval_service: RetriverService = Depends(get_retrieval_service),
    llm_service: LLMService = Depends(get_llm_service),
    repository: DocumentRepository = Depends(get_document_repository),
) -> ChatService:
    return ChatService(
        retrieval_service=retrieval_service,
        prompt_builder=PromptBuilder(),
        llm_service=llm_service,
        document_repository=repository,
    )
