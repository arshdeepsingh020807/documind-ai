from pydantic import BaseModel

from app.models.models.document import DocumentStatus


class UploadResponse(BaseModel):

    document_id: str

    filename: str

    status: DocumentStatus

    message: str