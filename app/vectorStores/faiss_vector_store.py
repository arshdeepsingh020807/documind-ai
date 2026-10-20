from app.vectorStores.vector_store import VectorStore
from app.models.models.embeddingclass import EmbeddedChunk
from app.models.models.search_result import SearchResult
import faiss
import numpy as np
from pathlib import Path
import pickle
from app.core.exceptions import DocumentProcessingError
class FaissVectorStore(VectorStore):
  def __init__(self,embedding_dimension:int,storage_directory: str,):
    self._embedding_dimension = embedding_dimension
    self._storage_directory = Path(storage_directory)
   
    self._storage_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

  def add(
    self,
    embedded_chunks: list[EmbeddedChunk],
) -> None:

    if not embedded_chunks:
        return

    document_id = embedded_chunks[0].chunk.document_id

    index = faiss.IndexFlatL2(
        self._embedding_dimension
    )

    vectors = np.array(
        [
            embedded_chunk.embeddings
            for embedded_chunk in embedded_chunks
        ],
        dtype=np.float32,
    )

    if vectors.shape[1] != self._embedding_dimension:
        raise DocumentProcessingError(
            f"Embedding size {vectors.shape[1]} does not match EMBEDDING_DIMENSION "
            f"{self._embedding_dimension}. Check EMBEDDING_MODEL."
        )

    index.add(vectors)

    self._save_index(
        document_id,
        index,
    )

    self._save_metadata(
        document_id,
        embedded_chunks,
    )
    
  def search(self,query_embedding: list[float],document_id: str,k=5)->list[SearchResult]:
    query = np.array(
      [query_embedding],
      dtype=np.float32,
    )
    index_f = self._load_index(document_id)
    if index_f is None or index_f.ntotal == 0:
      return []
    metadata = self._load_metadata(document_id)
    distances,indices = index_f.search(
      query,k
    )
    results = [];
    for distance,index in zip(distances[0],indices[0]):
      if index == -1:
        continue
      chunk = metadata[index]
    
      result = SearchResult(
        chunk=chunk,
        distance=float(distance)
      )
      results.append(result)
    return results


  def get_chunk(self, document_id: str, chunk_index: int) -> EmbeddedChunk | None:
    for embedded in self._load_metadata(document_id):
      if embedded.chunk.chunk_index == chunk_index:
        return embedded
    return None

  def delete(self, document_id: str) -> None:
    self._index_path(document_id).unlink(missing_ok=True)
    self._metadata_path(document_id).unlink(missing_ok=True)

  def _index_path(
    self,
    document_id: str,
) -> Path:
    return self._storage_directory / f"{document_id}.faiss"
  
  

  def _metadata_path(
    self,
    document_id: str,
) -> Path:
    return self._storage_directory / f"{document_id}.pkl"

  
  def _load_metadata(self,document_id:str)->list[EmbeddedChunk]:
    metaData_path = self._metadata_path(document_id=document_id)
    if metaData_path.exists():
      with open(metaData_path,"rb") as file:
        return pickle.load(file)
    return []

  def _save_index(self,document_id:str,index:faiss.Index)->None:
    index_path = self._index_path(document_id=document_id)
    faiss.write_index(
      index,
      str(index_path),
    )

  def _save_metadata(
      self,document_id:str,embedded_chunks:list[EmbeddedChunk]
  )->None:
    metadata_path = self._metadata_path(document_id=document_id)
    with open(metadata_path,"wb") as file:
      pickle.dump(
        embedded_chunks,file
      )

  def _load_index(
    self,
    document_id: str,
) -> faiss.Index | None:

    index_path = self._index_path(document_id)

    if not index_path.exists():
        return None

    return faiss.read_index(
        str(index_path)
    )