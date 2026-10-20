from datetime import datetime
from pydantic import BaseModel

class ProcessedDocument(BaseModel):
  document_id:str
  text:str
  word_count:int
  processed_at:datetime
  page_count:int
  # Index of the first word on each page. Empty when page numbers aren't meaningful (non-PDF files).
  page_word_starts:list[int] = []
