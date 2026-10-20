class DocuMindError(Exception):
    """Base exception for the entire application."""
    pass


class UnsupportedFileType(DocuMindError):
    """Raised when an unsupported file type is uploaded."""
    pass


class EmptyFile(DocuMindError):
    """Raised when an uploaded file has no content."""
    pass


class FileTooLarge(DocuMindError):
    """Raised when an uploaded file exceeds the size limit."""
    pass


class StorageError(DocuMindError):
    """Raised when storing or deleting a file fails."""
    pass


class RepositoryError(DocuMindError):
    """Raised when reading or writing document metadata fails."""
    pass


class DocumentProcessingError(DocuMindError):
    """Raised when document processing fails."""
    pass


class DocumentNotFound(DocuMindError):
    """Raised when a document cannot be found."""
    pass


class DocumentAlreadyProcessed(DocuMindError):
    """Raised when a processed document is processed again."""
    pass


class DocumentBusy(DocuMindError):
    """Raised when a document is already being processed."""
    pass


class DocumentNotProcessed(DocuMindError):
    """Raised when a document is used for chat before it has been indexed."""
    pass


class PreviewNotAvailable(DocuMindError):
    """Raised when a page preview can't be produced (not a PDF, or the passage isn't on that page)."""
    pass


class AIProviderError(DocuMindError):
    """Raised when the embedding or language-model provider fails."""
    pass
