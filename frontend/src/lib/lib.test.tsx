import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { applyView, DEFAULT_VIEW } from '../features/library/libraryView'
import { makeDoc } from '../test/utils'
import { renderAnswer } from './answer'
import { clearHistory, loadHistory, saveHistory, type ChatMessage } from './chatHistory'
import { validateFile } from './files'
import { formatBytes, formatUploaded, isReady, statusInfo } from './format'

describe('format', () => {
  it('formats byte sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB')
  })

  it('describes upload time relative to now', () => {
    const now = new Date('2026-03-10T15:00:00')
    expect(formatUploaded('2026-03-10T09:05:00', now)).toMatch(/^Today, /)
    expect(formatUploaded('2026-03-09T23:59:00', now)).toMatch(/^Yesterday, /)
    expect(formatUploaded('2025-12-01T10:00:00', now)).toMatch(/2025/)
    expect(formatUploaded('garbage', now)).toBe('—')
  })

  it('treats both processed and ready as ready', () => {
    expect(isReady({ status: 'processed' })).toBe(true)
    expect(isReady({ status: 'ready' })).toBe(true)
    expect(isReady({ status: 'uploaded' })).toBe(false)
    expect(statusInfo('failed').tone).toBe('bad')
  })
})

describe('validateFile', () => {
  it.each(['a.pdf', 'A.DOCX', 'notes.txt', 'readme.md'])('accepts %s', (name) => {
    expect(validateFile({ name, size: 10 })).toBeNull()
  })
  it('rejects unsupported, empty and oversize files with a reason', () => {
    expect(validateFile({ name: 'a.exe', size: 10 })).toMatch(/Unsupported file type “\.exe”/)
    expect(validateFile({ name: 'noextension', size: 10 })).toMatch(/Unsupported/)
    expect(validateFile({ name: 'a.pdf', size: 0 })).toMatch(/empty/i)
    expect(validateFile({ name: 'a.pdf', size: 26 * 1024 * 1024 })).toMatch(/25 MB/)
  })
})

describe('renderAnswer', () => {
  it('renders paragraphs, lists and inline formatting', () => {
    const { container } = render(<div>{renderAnswer('Intro **bold** and `code`.\n\n- one\n- two\n\n1. first\n2. second')}</div>)
    expect(container.querySelectorAll('p')).toHaveLength(1)
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('code')?.textContent).toBe('code')
    expect(container.querySelectorAll('ul > li')).toHaveLength(2)
    expect(container.querySelectorAll('ol > li')).toHaveLength(2)
  })

  it('never turns model output into HTML', () => {
    const { container } = render(<div>{renderAnswer('<img src=x onerror=alert(1)> <script>boom()</script>')}</div>)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText(/<script>boom\(\)<\/script>/)).toBeInTheDocument()
  })

  it('keeps line breaks inside a paragraph', () => {
    const { container } = render(<div>{renderAnswer('line one\nline two')}</div>)
    expect(container.querySelectorAll('br')).toHaveLength(1)
  })
})

describe('chat history', () => {
  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'hi' },
    { id: '2', role: 'assistant', content: 'hello', sources: [{ number: 1, chunk_index: 1, page_start: null, page_end: null, text: 't', relevance: 0.5 }] },
    { id: '3', role: 'assistant', content: '', error: { message: 'boom', question: 'hi' } },
  ]

  it('round-trips messages but drops failed turns', () => {
    saveHistory('d', messages)
    expect(loadHistory('d').map((m) => m.id)).toEqual(['1', '2'])
  })
  it('is scoped per document and clearable', () => {
    saveHistory('a', messages)
    expect(loadHistory('b')).toEqual([])
    clearHistory('a')
    expect(loadHistory('a')).toEqual([])
  })
  it('ignores corrupted storage', () => {
    localStorage.setItem('documind:chat:d', '{not json')
    expect(loadHistory('d')).toEqual([])
    localStorage.setItem('documind:chat:d', JSON.stringify([{ nope: 1 }, { id: '1', role: 'user', content: 'ok' }]))
    expect(loadHistory('d')).toHaveLength(1)
  })
})

describe('applyView', () => {
  const docs = [
    makeDoc({ id: '1', filename: 'Alpha.pdf', file_size: 300, uploaded_at: '2026-01-01T00:00:00', status: 'processed' }),
    makeDoc({ id: '2', filename: 'beta notes.txt', file_size: 900, uploaded_at: '2026-03-01T00:00:00', status: 'uploaded' }),
    makeDoc({ id: '3', filename: 'Gamma.docx', file_size: 100, uploaded_at: '2026-02-01T00:00:00', status: 'failed' }),
    makeDoc({ id: '4', filename: 'delta.md', file_size: 500, uploaded_at: '2026-04-01T00:00:00', status: 'processing' }),
  ]
  const ids = (view: Partial<typeof DEFAULT_VIEW>) => applyView(docs, { ...DEFAULT_VIEW, ...view }).map((d) => d.id)

  it('sorts', () => {
    expect(ids({ sort: 'newest' })).toEqual(['4', '2', '3', '1'])
    expect(ids({ sort: 'oldest' })).toEqual(['1', '3', '2', '4'])
    expect(ids({ sort: 'name' })).toEqual(['1', '2', '4', '3'])
    expect(ids({ sort: 'size' })).toEqual(['2', '4', '1', '3'])
  })
  it('searches case-insensitively and ignores surrounding spaces', () => {
    expect(ids({ query: '  ALPHA ' })).toEqual(['1'])
    expect(ids({ query: 'zzz' })).toEqual([])
  })
  it('filters by status groups', () => {
    expect(ids({ status: 'ready' })).toEqual(['1'])
    expect(ids({ status: 'processing' })).toEqual(['4'])
    expect(ids({ status: 'attention' })).toEqual(['2', '3'])
  })
  it('does not mutate the input', () => {
    const copy = [...docs]
    applyView(docs, { ...DEFAULT_VIEW, sort: 'size' })
    expect(docs).toEqual(copy)
  })
})
