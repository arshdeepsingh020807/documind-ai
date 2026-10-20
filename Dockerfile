# Stage 1: build the React frontend.
FROM node:22-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: the API, which also serves the built frontend.
FROM python:3.13-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py ./
COPY app ./app
COPY --from=frontend /frontend/dist ./frontend/dist

# Documents, metadata and vector indexes live here; mount volumes to keep them.
RUN mkdir -p uploads data/vector_store
VOLUME ["/app/uploads", "/app/data"]

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
