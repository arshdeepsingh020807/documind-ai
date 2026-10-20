from app.models.models.processed_document import ProcessedDocument
from app.models.models.chunk import Chunk
from uuid import uuid4
from bisect import bisect_right

class ChunkingService():
  def __init__(self,chunk_size=300,overlap=50):
    if overlap >= chunk_size:
      raise ValueError("overlap must be smaller than chunk_size")
    self._chunk_size = chunk_size
    self._overlap = overlap

  def chunk_document(self,processed_document:ProcessedDocument)->list[Chunk]:
    document_words = processed_document.text.split()
    chunks = []
    start = 0
    
    chunk_index = 1
    while (start < len(document_words)):
      
      end = min(start+self._chunk_size,len(document_words))
      chunk_words = document_words[start:end]
      chunk_text = " ".join(chunk_words)
      chunks.append(  self._build_chunk(
        processed_document,
        chunk_text,
        chunk_index,
        start,
        end,
        chunk_words,
        self._page_of(processed_document.page_word_starts, start),
        self._page_of(processed_document.page_word_starts, end - 1),
    ))
      start += self._chunk_size - self._overlap
      chunk_index = chunk_index + 1
    return chunks
  
  @staticmethod
  def _page_of(page_word_starts:list[int],word_index:int)->int | None:
    if not page_word_starts:
      return None
    # Empty pages share a start with the next page; bisect_right lands on the page that holds the word.
    return max(bisect_right(page_word_starts,word_index),1)

  def _build_chunk(self,processed_document:ProcessedDocument,chunk_text:str,chunk_index:int,start:int,end:int,chunk_words:list[str],page_start:int | None = None,page_end:int | None = None):
    uuid = uuid4()
    return Chunk(
      id=str(uuid),
      document_id=processed_document.document_id,
      chunk_index=chunk_index,
      text=chunk_text,
      word_count=len(chunk_words),
      start_offset=start,
      end_offset=end,
      page_start=page_start,
      page_end=page_end,
    )

