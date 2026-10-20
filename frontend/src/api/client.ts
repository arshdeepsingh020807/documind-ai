import type { ChatResponse, DocumentSummary, ProcessingResponse, UploadResponse } from './types'

export type ApiErrorKind = 'network' | 'timeout' | 'aborted' | 'http'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

const MESSAGES = {
  network: "Can't reach the server. Check your connection and that the backend is running.",
  timeout: 'The request took too long. Try again.',
  aborted: 'The request was cancelled.',
  server: 'The server ran into a problem. Try again in a moment.',
  unexpected: 'The server sent a response this app could not read.',
  invalid: "Some of the information sent isn't valid.",
}

const SECOND = 1000
export const TIMEOUTS = {
  default: 30 * SECOND,
  chat: 120 * SECOND,
  process: 10 * 60 * SECOND,
  upload: 5 * 60 * SECOND,
}

/** Turns a FastAPI error body (`{detail: string | [...]}`) into a sentence a person can act on. */
export function messageFromBody(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined
    return typeof first?.msg === 'string' ? `${MESSAGES.invalid} (${first.msg})` : MESSAGES.invalid
  }
  return status >= 500 ? MESSAGES.server : `Request failed (${status}).`
}

interface RequestOptions {
  method?: string
  body?: BodyInit | null
  json?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', json, signal, timeoutMs = TIMEOUTS.default } = options
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onExternalAbort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', onExternalAbort)

  try {
    const headers: Record<string, string> = {}
    let body = options.body
    if (json !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(json)
    }

    let response: Response
    try {
      response = await fetch(path, { method, headers, body, signal: controller.signal })
    } catch {
      if (timedOut) throw new ApiError('timeout', MESSAGES.timeout)
      if (controller.signal.aborted) throw new ApiError('aborted', MESSAGES.aborted)
      throw new ApiError('network', MESSAGES.network)
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new ApiError('http', messageFromBody(response.status, body), response.status)
    }
    if (response.status === 204) return undefined as T
    try {
      return (await response.json()) as T
    } catch {
      throw new ApiError('http', MESSAGES.unexpected, response.status)
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

const enc = encodeURIComponent

export const api = {
  listDocuments: (signal?: AbortSignal) => request<DocumentSummary[]>('/documents', { signal }),

  getDocument: (id: string, signal?: AbortSignal) =>
    request<DocumentSummary>(`/documents/${enc(id)}`, { signal }),

  processDocument: (id: string) =>
    request<ProcessingResponse>(`/documents/${enc(id)}/process`, {
      method: 'POST',
      timeoutMs: TIMEOUTS.process,
    }),

  deleteDocument: (id: string) => request<void>(`/documents/${enc(id)}`, { method: 'DELETE' }),

  chat: (documentId: string, question: string, signal?: AbortSignal) =>
    request<ChatResponse>('/documents/chat', {
      method: 'POST',
      json: { document_id: documentId, question },
      signal,
      timeoutMs: TIMEOUTS.chat,
    }),

  fileUrl: (id: string) => `/documents/${enc(id)}/file`,
}

/** Upload uses XHR because fetch cannot report upload progress. */
export function uploadDocument(
  file: File,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/documents/upload')
    xhr.timeout = TIMEOUTS.upload
    xhr.responseType = 'text'

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        /* non-JSON body: fall through to the status handling below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body as UploadResponse)
      else if (xhr.status >= 200 && xhr.status < 300) reject(new ApiError('http', MESSAGES.unexpected, xhr.status))
      else reject(new ApiError('http', messageFromBody(xhr.status, body), xhr.status))
    }
    xhr.onerror = () => reject(new ApiError('network', MESSAGES.network))
    xhr.ontimeout = () => reject(new ApiError('timeout', MESSAGES.timeout))
    xhr.onabort = () => reject(new ApiError('aborted', MESSAGES.aborted))

    if (options.signal?.aborted) return reject(new ApiError('aborted', MESSAGES.aborted))
    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true })

    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}
