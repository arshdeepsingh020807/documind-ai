import openai
from openai import OpenAI

from app.core.exceptions import AIProviderError
from app.llm.openai_llm_service import describe_openai_error
from app.models.models.chunk import Chunk
from app.models.models.embeddingclass import EmbeddedChunk


class EmbeddingService():
  def __init__(self, model_name: str, client: OpenAI, batch_size: int = 64):
    self._model_name = model_name
    self._client = client
    self._batch_size = batch_size

  def embed_chunks(self, chunks: list[Chunk]) -> list[EmbeddedChunk]:
    embedded_chunks = []
    for start in range(0, len(chunks), self._batch_size):
      batch = chunks[start:start + self._batch_size]
      vectors = self._embed_texts([chunk.text for chunk in batch])
      embedded_chunks.extend(
        EmbeddedChunk(chunk=chunk, embeddings=vector)
        for chunk, vector in zip(batch, vectors)
      )
    return embedded_chunks

  def embed_query(self, query: str) -> list[float]:
    return self._embed_texts([query])[0]

  def _embed_texts(self, texts: list[str]) -> list[list[float]]:
    try:
      response = self._client.embeddings.create(
        model=self._model_name,
        input=texts,
        # Explicit: the SDK would otherwise request base64, which not every compatible provider supports.
        encoding_format="float",
      )
    except openai.OpenAIError as e:
      raise AIProviderError(describe_openai_error(e)) from e
    # The API may return items out of order; `index` is the position in `texts`.
    ordered = sorted(response.data, key=lambda item: item.index)
    return [item.embedding for item in ordered]
