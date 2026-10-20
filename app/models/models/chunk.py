from pydantic import BaseModel

class Chunk(BaseModel):
  id:str
  document_id:str
  chunk_index:int
  text:str
  word_count:int
  start_offset:int
  end_offset:int
  # 1-based page range, only set for PDFs (the one format with real pages).
  page_start:int | None = None
  page_end:int | None = None
