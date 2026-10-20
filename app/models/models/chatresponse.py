from pydantic import BaseModel


class ChatSource(BaseModel):
    # 1-based citation number: the [n] the model is asked to cite in its answer.
    number: int
    chunk_index: int
    page_start: int | None = None
    page_end: int | None = None
    text: str
    relevance: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource] = []
