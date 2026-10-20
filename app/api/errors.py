import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core import exceptions as exc

logger = logging.getLogger(__name__)

# Most specific classes first; the first isinstance match wins.
_STATUS_BY_ERROR: list[tuple[type[exc.DocuMindError], int]] = [
    (exc.DocumentNotFound, 404),
    (exc.UnsupportedFileType, 400),
    (exc.EmptyFile, 400),
    (exc.FileTooLarge, 413),
    (exc.DocumentAlreadyProcessed, 409),
    (exc.DocumentBusy, 409),
    (exc.DocumentNotProcessed, 409),
    (exc.DocumentProcessingError, 422),
    (exc.AIProviderError, 502),
]

_MESSAGES = {
    exc.DocumentNotFound: "Document not found.",
    exc.DocumentAlreadyProcessed: "This document has already been processed.",
    exc.DocumentBusy: "This document is currently being processed.",
    exc.DocumentNotProcessed: "Process this document before asking questions about it.",
}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(exc.DocuMindError)
    async def handle_domain_error(request: Request, error: exc.DocuMindError) -> JSONResponse:
        for error_type, status_code in _STATUS_BY_ERROR:
            if isinstance(error, error_type):
                detail = _MESSAGES.get(error_type) or str(error) or error_type.__name__
                return JSONResponse(status_code=status_code, content={"detail": detail})
        logger.exception("Unhandled application error", exc_info=error)
        return JSONResponse(status_code=500, content={"detail": "Internal server error."})
