from pydantic import BaseModel
from app.models.models.document import DocumentStatus


class ProcessingResponse(BaseModel):

    document_id: str

    status: DocumentStatus

    page_count: int

    word_count: int

    message: str