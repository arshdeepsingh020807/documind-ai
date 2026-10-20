export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'] as const
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(',')
// Mirrors the backend default (MAX_UPLOAD_MB). The server stays the authority and answers 413 if it differs.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/** Returns a user-facing reason the file can't be uploaded, or null if it looks fine. */
export function validateFile(file: Pick<File, 'name' | 'size'>): string | null {
  const dot = file.name.lastIndexOf('.')
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : ''
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Unsupported file type${ext ? ` “${ext}”` : ''}. Use PDF, DOCX, TXT or MD.`
  }
  if (file.size === 0) return 'This file is empty.'
  if (file.size > MAX_UPLOAD_BYTES) return `Too large. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`
  return null
}
