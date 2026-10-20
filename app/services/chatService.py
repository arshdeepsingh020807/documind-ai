from app.core.exceptions import DocumentNotFound, DocumentNotProcessed
from app.llm.llm_service import LLMService
from app.models.models.chatresponse import ChatResponse, ChatSource
from app.models.models.document import DocumentStatus
from app.models.models.search_result import SearchResult
from app.repositories.document_repo import DocumentRepository
from app.services.prompt_builder import PromptBuilder
from app.services.RetrievalService import RetriverService

NO_ANSWER = "I could not find any relevant information in this document."


class ChatService:

    def __init__(
        self,
        retrieval_service: RetriverService,
        prompt_builder: PromptBuilder,
        llm_service: LLMService,
        document_repository: DocumentRepository,
    ):
        self._retrieval_service = retrieval_service
        self._prompt_builder = prompt_builder
        self._llm_service = llm_service
        self._document_repository = document_repository

    def chat(
        self,
        question: str,
        document_id: str,
    ) -> ChatResponse:
        document = self._document_repository.get_by_id(document_id)
        if document is None:
            raise DocumentNotFound(document_id)
        if document.status != DocumentStatus.PROCESSED:
            raise DocumentNotProcessed(document_id)

        results = self._retrieval_service.retrieve(question, document_id=document_id)
        if not results:
            return ChatResponse(answer=NO_ANSWER)

        prompt = self._prompt_builder.build_prompt(question, results)
        answer = self._llm_service.generate(prompt)

        return ChatResponse(
            answer=answer.text,
            sources=[self._to_source(number, result) for number, result in enumerate(results, start=1)],
        )

    @staticmethod
    def _to_source(number: int, result: SearchResult) -> ChatSource:
        chunk = result.chunk.chunk
        # FAISS returns squared L2 distance. OpenAI embeddings are unit length, so
        # cosine similarity = 1 - distance / 2.
        relevance = min(1.0, max(0.0, 1.0 - result.distance / 2.0))
        return ChatSource(
            number=number,
            chunk_index=chunk.chunk_index,
            page_start=getattr(chunk, "page_start", None),
            page_end=getattr(chunk, "page_end", None),
            text=chunk.text,
            relevance=round(relevance, 4),
        )
