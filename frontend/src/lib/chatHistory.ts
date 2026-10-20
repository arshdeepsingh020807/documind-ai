import type { ChatSource } from '../api/types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  /** Set on an assistant message that represents a failed request; `error.question` is what a retry re-asks. */
  error?: { message: string; question: string }
}

const MAX_MESSAGES = 100
const key = (documentId: string) => `documind:chat:${documentId}`

function isMessage(value: unknown): value is ChatMessage {
  const m = value as ChatMessage
  return (
    typeof m === 'object' && m !== null &&
    typeof m.id === 'string' &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.content === 'string'
  )
}

/** Conversations saved before citations existed lack `number` and page fields. */
function withSourceDefaults(message: ChatMessage): ChatMessage {
  if (!message.sources) return message
  return {
    ...message,
    sources: message.sources.map((s, i) => ({ ...s, number: s.number ?? i + 1, page_start: s.page_start ?? null, page_end: s.page_end ?? null })),
  }
}

export function loadHistory(documentId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(key(documentId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isMessage).map(withSourceDefaults) : []
  } catch {
    return []
  }
}

/** Failed turns are transient, so they are not persisted. */
export function saveHistory(documentId: string, messages: ChatMessage[]): void {
  try {
    const kept = messages.filter((m) => !m.error).slice(-MAX_MESSAGES)
    if (kept.length) localStorage.setItem(key(documentId), JSON.stringify(kept))
    else localStorage.removeItem(key(documentId))
  } catch {
    /* storage full or unavailable: history just won't persist */
  }
}

export function clearHistory(documentId: string): void {
  try {
    localStorage.removeItem(key(documentId))
  } catch {
    /* nothing to do */
  }
}
