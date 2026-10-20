from datetime import datetime
from enum import Enum
from pydantic import BaseModel
from typing import Optional

class DocumentType(str,Enum):
  PDF = "pdf"
  DOCX = "docx"
  TXT = "txt"
  MD = "md"

class DocumentStatus(str, Enum):

    UPLOADED = "uploaded"

    PROCESSING = "processing"

    READY = "ready"

    FAILED = "failed"

    PROCESSED = "processed"

class Document(BaseModel):

    id: str

    stored_filename: str

    original_filename: str

    file_type: DocumentType

    status: DocumentStatus

    file_size: int

    uploaded_at: datetime

    pages: Optional[int] = None

    error: Optional[str] = None
