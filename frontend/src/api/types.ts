export type DocumentStatus = 'uploaded' | 'processing' | 'processed' | 'ready' | 'failed'
export type DocumentType = 'pdf' | 'docx' | 'txt' | 'md'

export interface DocumentSummary {
  id: string
  filename: string
  file_type: DocumentType
  status: DocumentStatus
  file_size: number
  uploaded_at: string
  pages: number | null
  error: string | null
}

export interface UploadResponse {
  document_id: string
  filename: string
  status: DocumentStatus
  message: string
}

export interface ProcessingResponse {
  document_id: string
  status: DocumentStatus
  page_count: number
  word_count: number
  message: string
}

export interface ChatSource {
  /** 1-based citation number; the [n] in the answer text refers to this passage. */
  number: number
  chunk_index: number
  /** Only PDFs have real pages. */
  page_start: number | null
  page_end: number | null
  text: string
  relevance: number
}

export interface ChatResponse {
  answer: string
  sources: ChatSource[]
}
