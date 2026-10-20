import mimetypes

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from fastapi.responses import FileResponse

from app.dependencies.services import (
    get_chat_service,
    get_document_service,
    get_indexing_service,
    get_page_preview_service,
    get_upload_service,
)
from app.models.models.chatresponse import ChatResponse
from app.models.models.ChatRequest import ChatRequest
from app.models.models.document import DocumentStatus
from app.schemas.document_response import DocumentResponse
from app.schemas.processing_response import ProcessingResponse
from app.schemas.upload_response import UploadResponse
from app.services.chatService import ChatService
from app.services.document_service import DocumentService
from app.services.IndexingService import IndexingService
from app.services.page_preview import PagePreviewService
from app.services.upload_service import UploadService

router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)

# These are plain `def` routes on purpose: FastAPI runs them in a worker thread, so slow
# embedding / LLM calls and file I/O don't block the event loop.


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    document_service: DocumentService = Depends(get_document_service),
) -> list[DocumentResponse]:
    return [DocumentResponse.from_document(d) for d in document_service.list_documents()]


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=201,
)
def upload_document(
    file: UploadFile = File(...),
    upload_service: UploadService = Depends(get_upload_service),
):
    document = upload_service.upload_document(file)

    return UploadResponse(
        document_id=document.id,
        filename=document.original_filename,
        status=document.status,
        message="Document uploaded successfully."
    )


@router.post(
    "/chat",
    response_model=ChatResponse,
)
def chat(
    request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    return chat_service.chat(
        question=request.question,
        document_id=request.document_id,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    return DocumentResponse.from_document(document_service.get_document(document_id))


@router.get("/{document_id}/file")
def download_document(
    document_id: str,
    document_service: DocumentService = Depends(get_document_service),
) -> FileResponse:
    document, path = document_service.get_file_path(document_id)
    media_type = mimetypes.guess_type(document.original_filename)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type, filename=document.original_filename)


@router.get("/{document_id}/passages/{chunk_index}/preview")
def preview_passage(
    document_id: str,
    chunk_index: int,
    page: int = Query(ge=1),
    previews: PagePreviewService = Depends(get_page_preview_service),
) -> Response:
    """The cited PDF page as an image, with the passage highlighted. The passage text comes from our own
    index (never from the URL), and a given passage's page never changes, so browsers may cache it."""
    png = previews.preview(document_id, chunk_index, page)
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "private, max-age=86400"})


@router.post(
    "/{document_id}/process",
    response_model=ProcessingResponse
)
def process_document(
    document_id: str,
    indexing_service: IndexingService = Depends(get_indexing_service),
) -> ProcessingResponse:
    processed = indexing_service.index_document(document_id)

    return ProcessingResponse(
        document_id=document_id,
        status=DocumentStatus.PROCESSED,
        page_count=processed.page_count,
        word_count=processed.word_count,
        message="Document processed successfully."
    )


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    document_service: DocumentService = Depends(get_document_service),
) -> Response:
    document_service.delete_document(document_id)
    return Response(status_code=204)
