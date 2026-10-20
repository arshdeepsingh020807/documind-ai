import json
import os
import tempfile
import threading
from pathlib import Path

from app.core.exceptions import DocumentNotFound, RepositoryError
from app.models.models.document import Document, DocumentStatus


class DocumentRepository:
    """JSON-file document store. A lock serialises read-modify-write cycles and
    writes go through a temp file + os.replace, so a crash can't leave a torn file."""

    def __init__(self, data_file: str = "data/document.json"):
        self.data_file = Path(data_file)
        self._lock = threading.RLock()

        self.data_file.parent.mkdir(parents=True, exist_ok=True)

        if not self.data_file.exists():
            self.data_file.write_text("[]", encoding="utf-8")

    def save(self, document: Document) -> None:
        with self._lock:
            records = self._read()
            records.append(document.model_dump(mode="json"))
            self._write(records)

    def get_by_id(self, document_id: str) -> Document | None:
        with self._lock:
            for record in self._read():
                if record["id"] == document_id:
                    return Document.model_validate(record)
        return None

    def list_all(self) -> list[Document]:
        with self._lock:
            documents = [Document.model_validate(r) for r in self._read()]
        return sorted(documents, key=lambda d: d.uploaded_at, reverse=True)

    def update(self, document: Document) -> None:
        with self._lock:
            records = self._read()
            for i, record in enumerate(records):
                if record["id"] == document.id:
                    records[i] = document.model_dump(mode="json")
                    self._write(records)
                    return
        raise DocumentNotFound(document.id)

    def delete(self, document_id: str) -> None:
        with self._lock:
            records = self._read()
            remaining = [r for r in records if r["id"] != document_id]
            if len(remaining) == len(records):
                raise DocumentNotFound(document_id)
            self._write(remaining)

    def fail_interrupted(self) -> int:
        """Documents left in PROCESSING by a crash or restart can never finish; mark them failed."""
        with self._lock:
            records = self._read()
            count = 0
            for record in records:
                if record["status"] == DocumentStatus.PROCESSING.value:
                    record["status"] = DocumentStatus.FAILED.value
                    record["error"] = "Processing was interrupted. Try again."
                    count += 1
            if count:
                self._write(records)
        return count

    def _read(self) -> list[dict]:
        try:
            with self.data_file.open("r", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            raise RepositoryError(f"Document metadata cannot be read: {e}") from e

    def _write(self, records: list[dict]) -> None:
        tmp_path = None
        try:
            fd, tmp_path = tempfile.mkstemp(
                dir=self.data_file.parent, prefix=".document-", suffix=".tmp"
            )
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=4)
            os.replace(tmp_path, self.data_file)
        except OSError as e:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise RepositoryError(f"Document metadata cannot be saved: {e}") from e
