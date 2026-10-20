# DocuMind

Upload a document, then ask questions about it. DocuMind answers only from the document's own text. Each claim carries a numbered citation chip that jumps to the exact passage (with its page number, for PDFs), so you can check the answer yourself.

Supports **PDF, DOCX, TXT and Markdown** (up to 25 MB each).

The site has three pages: a landing page at `/` (with an interactive example and a one-click sample document), the document library at `/library`, and the chat workspace at `/d/<id>`.

## How it works

```
 Browser (React)  ──HTTP──▶  FastAPI
                               │
   upload ─▶ UploadService ─▶ uploads/  +  data/document.json  (metadata)
   process ─▶ extract text (PyMuPDF) ─▶ chunk (500 words, 100 overlap)
              ─▶ embed (OpenAI) ─▶ FAISS index per document (data/vector_store/)
   chat ─▶ embed question ─▶ nearest 5 chunks ─▶ numbered prompt ─▶ LLM ─▶ answer citing [1]..[5] + sources
```

Each layer sits behind a small interface (`VectorStore`, `LLMService`), so FAISS or OpenAI can be swapped without touching the rest.

## Run it

Requires **Python 3.13** (the pinned `numpy` needs 3.12 or newer; only 3.13 has been tested), **Node 22.12+**, and an OpenAI API key.

```bash
# backend
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env            # then set OPENAI_API_KEY

# frontend (builds into frontend/dist, which the API serves)
cd frontend && npm install && npm run build && cd ..

.venv/bin/uvicorn main:app --port 8000
# open http://localhost:8000
```

For frontend development with hot reload, run the API as above and `npm run dev` in `frontend/` (http://localhost:5173, proxied to the API).

Docker: `docker build -t documind . && docker run -p 8000:8000 --env-file .env -v documind-data:/app/data -v documind-uploads:/app/uploads documind`

## API

Interactive docs are at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/documents` | List documents, newest first |
| `POST` | `/documents/upload` | Upload a file (multipart `file`) → `201` |
| `GET` | `/documents/{id}` | One document's metadata and status |
| `GET` | `/documents/{id}/file` | Download the original file |
| `GET` | `/documents/{id}/passages/{chunk}/preview?page=N` | PNG of a cited PDF page with the passage highlighted (PDF only) |
| `POST` | `/documents/{id}/process` | Extract, chunk, embed and index the document |
| `POST` | `/documents/chat` | `{document_id, question}` → `{answer, sources[]}`; each source has `number` (the `[n]` cited in the answer), `page_start`/`page_end` (PDFs only), `text`, `relevance` |
| `DELETE` | `/documents/{id}` | Remove the file, metadata and index → `204` |
| `GET` | `/health` | Liveness check |

Errors are `{"detail": "..."}` with a meaningful status: `400` unsupported/empty file, `404` unknown document, `409` already processed / still processing / not processed yet, `413` too large, `422` unreadable document, `502` the AI provider failed.

A document moves `uploaded → processing → processed`, or `failed` (with a reason, and it can be retried).

## Using OpenRouter (or another OpenAI-compatible provider)

By default the app talks to OpenAI, which rejects any other provider's key. To use OpenRouter instead, set:

```
OPENAI_API_KEY=<your OpenRouter key>
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-5-mini              # any chat model id from openrouter.ai/models
EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSION=1536                    # must match the embedding model
```

The app only uses the standard `chat/completions` and `embeddings` endpoints. If you switch embedding models after documents were processed, re-process them, because their stored vectors no longer match.

## Configuration

Set in `.env` (see `.env.example`): `OPENAI_API_KEY` (required), `OPENAI_BASE_URL`, `OPENAI_MODEL`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSION` (must match the embedding model), `MAX_UPLOAD_MB`, `CHUNK_SIZE`, `CHUNK_OVERLAP`, and the storage paths.

## Tests

```bash
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest                     # backend: no network or API key needed

cd frontend
npm run lint && npm run typecheck && npm test && npm run check:contrast && npm run build
```

The backend suite includes tests that start the real server process and check concurrency, restart recovery, CORS and the upload limit over HTTP.

The backend tests replace OpenAI with an offline fake (`tests/fakes.py`). To try the whole app without a key, run `python -m tests.e2e_server` (it uses throwaway storage and the fake client; answers are placeholders).

## Citations and page numbers

Retrieved passages are numbered `[1]`, `[2]`… in the prompt and the model is told to cite them. The UI turns each `[n]` into a chip that highlights passage *n* in the Sources panel. A number outside the retrieved range is treated as a model mistake and shown as plain text. Page numbers are never asked of the model: they are computed from word offsets recorded while the PDF is read. DOCX, TXT and MD are re-flowed by the text extractor, so they have passages but no page numbers.

For PDFs the Sources panel can show the cited page as an image with the passage highlighted. The server finds the passage's words on that page with PyMuPDF, so highlighting is best effort: unusual hyphenation or fonts can leave part of a passage unmarked. Highlights are as precise as the passages are small: with the default 500-word chunks a passage can span most of a page, and a smaller `CHUNK_SIZE` (for example 200) tightens them at the cost of less context per passage.

## Design

Neutrals, accent and status colours come from the [Radix Colors](https://www.radix-ui.com/colors) scales (sand, indigo, grass, red, amber), assigned by role. `npm run check:contrast` checks every text, border and focus pair in both themes against **WCAG 2** (4.5:1 text, 3:1 UI) and the size-aware **APCA** minimums (Lc 90 for body text, 78 for small text, 75 for button labels, 60 for large headings, 30 for borders and focus rings), and fails if the two dark-theme blocks drift apart. Citation chips meet WCAG 2.2's 24 px target size. The UI also passes an axe-core audit on every page, dialog and state (an answer with citations, an open page preview) in light and dark at desktop and phone widths. The landing sample document is generated by `frontend/scripts/make-sample-pdf.py`.

## Known limits

- No authentication: anyone who can reach the server can see every document.
- Metadata is a JSON file and indexes are local FAISS files, which suits one server process, not a cluster.
- Scanned or image-only PDFs have no text to read, so they fail with a clear message (no OCR).
- Chat history is kept in the browser (`localStorage`), per document. Each question is answered independently; earlier turns are not sent to the model.

## Project layout

```
app/api/            routes and error → HTTP mapping
app/services/       upload, processing, chunking, embedding, indexing, retrieval, chat
app/repositories/   JSON document store (locked, atomic writes)
app/vectorStores/   FAISS implementation behind the VectorStore interface
app/llm/            OpenAI implementation behind the LLMService interface
frontend/src/       React app: api/, components/, features/{library,workspace}, lib/, styles/
tests/              pytest suite, offline fakes, end-to-end launcher
```
