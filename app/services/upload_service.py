from pathlib import Path
from app.services.storage_service import StorageService
import uuid
from app.models.models.document import( Document,DocumentStatus,DocumentType)
from fastapi import UploadFile
from datetime import datetime
from app.core.exceptions import(
    UnsupportedFileType
)
from app.repositories.document_repo import DocumentRepository
class UploadService:
    SUPPORTED_EXTENSIONS = {
        ".pdf",
        ".docx",
        ".txt",
        ".md"
    }

    def __init__(
        self,
        storage_service: StorageService,
        document_repository: DocumentRepository,
        max_upload_bytes: int | None = None,
    ):
        self.storage = storage_service
        self.repository = document_repository
        self.max_upload_bytes = max_upload_bytes

    def upload_document(self, file:UploadFile)->Document:
        """
        Main entry point.
        Coordinates the upload workflow.
        """
        self._validate_file(file)
        document_id = self._generate_document_id()
        storage_filename = self._create_storage_filename(
            document_id,file.filename
        )
        stored_path = self.storage.save(
            file, storage_filename, self.max_upload_bytes
        )
        try:
            document = self._create_document_metadata(
                document_id=document_id,
                file=file,
                storage_filename=storage_filename,
                stored_path=stored_path
            )
            self.repository.save(document)
            return document
        except Exception:
            self.storage.delete(stored_path)
            raise

    def _validate_file(self, file)->None:
        if not file.filename:
            raise UnsupportedFileType("The uploaded file has no filename.")

        extension = Path(file.filename).suffix.lower()
        if extension not in self.SUPPORTED_EXTENSIONS:
            raise UnsupportedFileType(
                f"Unsupported file type '{extension}'. "
                f"Supported types are "
                f"{', '.join(sorted(self.SUPPORTED_EXTENSIONS))}"
            )

    def _generate_document_id(self):
        """
        Generate UUID.
        """
        return str(uuid.uuid4())


    def _create_storage_filename(self, document_id:str, original_filename:str)->str:
        """
        Example:
        3f5c2a.pdf
        """
        extension = Path(original_filename).suffix.lower()
        return f"{document_id}{extension}"

    def _create_document_metadata(self,document_id:str,file:UploadFile,storage_filename:str,stored_path:Path)->Document:
        """
        Build Document object.
        """
        extension = Path(file.filename).suffix.lower()[1:]
        return Document (
            id = document_id,
            stored_filename=storage_filename,
            original_filename=file.filename,
            file_type=DocumentType(extension),
            status = DocumentStatus.UPLOADED,
            file_size=stored_path.stat().st_size,
            uploaded_at=datetime.now(),
            pages=None,

        )