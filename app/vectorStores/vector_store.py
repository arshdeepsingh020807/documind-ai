from abc import ABC,abstractmethod
from app.models.models.embeddingclass import EmbeddedChunk
from app.models.models.search_result import SearchResult

class VectorStore(ABC):

    @abstractmethod
    def add(
        self,
        embedded_chunks: list[EmbeddedChunk],
    ) -> None:
        pass

    @abstractmethod
    def search(
        self,
        query_embedding: list[float],
        document_id: str,
        k: int = 5,
    ) -> list[SearchResult]:
        pass
    @abstractmethod
    def delete(self, document_id: str) -> None:
        pass
