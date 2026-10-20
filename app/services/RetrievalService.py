from app.services.EmbeddingService import EmbeddingService
from app.vectorStores.vector_store import VectorStore
from app.models.models.search_result import SearchResult

class RetriverService:
  def __init__(self,embedding_service:EmbeddingService,vectorStore:VectorStore):
    self._embeddibing_service = embedding_service
    self._vector_store = vectorStore

  def retrieve(self,question:str,document_id:str,k:int = 5)-> list[SearchResult]:
    queryembediing = self._embeddibing_service.embed_query(
      question
    )
    result = self._vector_store.search(
      query_embedding=queryembediing,
      document_id=document_id,
      k=k
    )
    return result