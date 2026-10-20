from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.errors import register_exception_handlers
from app.api.routes.document_routes import router as document_router
from app.core.config import settings
from app.dependencies.repository import get_document_repository

# URL prefixes that belong to the API and must 404 rather than fall back to the SPA.
_API_PREFIXES = ("documents", "health", "docs", "redoc", "openapi.json", "assets")


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_document_repository().fail_interrupted()
    yield


app = FastAPI(
    title="DocuMind AI",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(document_router)


@app.get("/health", tags=["Health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


def _mount_frontend(dist: Path) -> None:
    index_file = dist / "index.html"
    if not index_file.is_file():
        return

    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.split("/")[0] in _API_PREFIXES:
            raise HTTPException(status_code=404, detail="Not found.")
        candidate = (dist / path).resolve()
        if path and candidate.is_file() and dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index_file)


_mount_frontend(Path(settings.FRONTEND_DIST))
