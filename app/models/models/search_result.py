from pydantic import BaseModel
from app.models.models.embeddingclass import EmbeddedChunk


class SearchResult(BaseModel):
  chunk:EmbeddedChunk
  distance:float