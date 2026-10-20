from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.models.document import Document, DocumentStatus, DocumentType


class DocumentResponse(BaseModel):
    id: str

    filename: str

    file_type: DocumentType

    status: DocumentStatus

    file_size: int

    uploaded_at: datetime

    pages: Optional[int] = None

    error: Optional[str] = None

    @classmethod
    def from_document(cls, document: Document) -> "DocumentResponse":
        return cls(
            id=document.id,
            filename=document.original_filename,
            file_type=document.file_type,
            status=document.status,
            file_size=document.file_size,
            uploaded_at=document.uploaded_at,
            pages=document.pages,
            error=document.error,
        )
