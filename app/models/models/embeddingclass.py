from pydantic import BaseModel
from app.models.models.chunk import Chunk

class EmbeddedChunk(BaseModel):
  chunk:Chunk
  embeddings:list[float]