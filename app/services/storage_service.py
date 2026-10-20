from pathlib import Path

from fastapi import UploadFile

from app.core.exceptions import EmptyFile, FileTooLarge, StorageError

_COPY_CHUNK_BYTES = 1024 * 1024


class StorageService:
    def __init__(self, upload_dir: str = "uploads"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def save(self, file: UploadFile, filename: str, max_bytes: int | None = None) -> Path:
        destination = self.upload_dir / filename
        written = 0
        try:
            with destination.open("wb") as buffer:
                while chunk := file.file.read(_COPY_CHUNK_BYTES):
                    written += len(chunk)
                    if max_bytes is not None and written > max_bytes:
                        raise FileTooLarge(
                            f"File exceeds the {max_bytes // (1024 * 1024)} MB limit."
                        )
                    buffer.write(chunk)
            if written == 0:
                raise EmptyFile("The uploaded file is empty.")
            return destination
        except OSError as e:
            self.delete(destination)
            raise StorageError(f"Failed to save file: {e}") from e
        except (FileTooLarge, EmptyFile):
            self.delete(destination)
            raise

    def delete(self, path: Path) -> None:
        try:
            path.unlink(missing_ok=True)
        except OSError as e:
            raise StorageError(f"File cannot be deleted: {e}") from e

    def get_path(self, stored_filename: str) -> Path:
        return self.upload_dir / stored_filename
