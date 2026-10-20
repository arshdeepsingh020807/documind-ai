from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    OPENAI_API_KEY: str

    OPENAI_MODEL: str = "gpt-5-mini"

    EMBEDDING_MODEL: str = "text-embedding-3-small"

    UPLOAD_DIRECTORY: str = "uploads"

    DOCUMENT_STORE_FILE: str = "data/document.json"

    VECTOR_STORE_DIRECTORY: str = "data/vector_store"

    CHUNK_SIZE: int = 500

    CHUNK_OVERLAP: int = 100

    EMBEDDING_DIMENSION: int = 1536

    EMBEDDING_BATCH_SIZE: int = 64

    OPENAI_TIMEOUT_SECONDS: float = 60.0

    MAX_UPLOAD_MB: int = 25

    # Comma-separated list; only needed when the frontend is served from another origin (Vite dev server).
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    FRONTEND_DIST: str = "frontend/dist"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
