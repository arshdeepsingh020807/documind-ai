import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DocumentSummary } from '../../api/types'
import { makeDoc, renderApp, route, stat, stubApi } from '../../test/utils'

const DOCS = [
  makeDoc({ id: 'a', filename: 'Annual report.pdf', status: 'processed', uploaded_at: '2026-02-01T09:00:00' }),
  makeDoc({ id: 'b', filename: 'Meeting notes.txt', file_type: 'txt', status: 'uploaded', pages: null, uploaded_at: '2026-03-01T09:00:00' }),
  makeDoc({ id: 'c', filename: 'Broken scan.pdf', status: 'failed', pages: null, error: 'No readable text found.', uploaded_at: '2026-01-01T09:00:00' }),
]

const list = (docs: DocumentSummary[]) => route('GET', /^\/documents$/, () => ({ json: docs }))

describe('LibraryPage', () => {
  it('lists documents newest first with status, and a clear summary', async () => {
    stubApi([list(DOCS)])
    renderApp('/')

    const rows = await screen.findAllByRole('row')
    // header + 3 documents
    expect(rows).toHaveLength(4)
    expect(within(rows[1]!).getByText('Meeting notes.txt')).toBeInTheDocument()
    const summary = screen.getByLabelText('Library summary')
    expect(stat(summary, 'documents')).toBe('3')
    expect(stat(summary, 'ready to chat')).toBe('1')
    expect(stat(summary, 'pages read')).toBe('4')
    expect(within(rows[1]!).getByText('Not processed')).toBeInTheDocument()
    expect(within(rows[3]!).getByText('No readable text found.')).toBeInTheDocument()
  })

  it('gives each row the right primary action', async () => {
    stubApi([list(DOCS)])
    renderApp('/')
    await screen.findByText('Annual report.pdf')

    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/d/a')
    expect(screen.getByRole('button', { name: 'Process' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('searches, filters and shows a no-match state that can be cleared', async () => {
    const user = userEvent.setup()
    stubApi([list(DOCS)])
    renderApp('/')
    await screen.findByText('Annual report.pdf')

    await user.type(screen.getByRole('searchbox', { name: /search documents/i }), 'meeting')
    expect(screen.queryByText('Annual report.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('Meeting notes.txt')).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox'))
    await user.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'attention')
    expect(screen.queryByText('Annual report.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('Broken scan.pdf')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText('No documents match')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Meeting notes.txt')).toBeInTheDocument()
  })

  it('sorts by name', async () => {
    const user = userEvent.setup()
    stubApi([list(DOCS)])
    renderApp('/')
    await screen.findByText('Annual report.pdf')
    await user.selectOptions(screen.getByRole('combobox', { name: /sort documents/i }), 'name')
    const names = screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('link')[0]?.textContent)
    expect(names).toEqual(['Annual report.pdf', 'Broken scan.pdf', 'Meeting notes.txt'])
  })

  it('shows an empty state with an upload call to action', async () => {
    stubApi([list([])])
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Ask your documents questions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload your first document/i })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Library summary')).not.toBeInTheDocument()
  })

  it('shows an error with retry, and recovers', async () => {
    const user = userEvent.setup()
    let fail = true
    stubApi([route('GET', /^\/documents$/, () => (fail ? { status: 400, json: { detail: 'Storage unavailable.' } } : { json: DOCS }))])
    renderApp('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable.')
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Annual report.pdf')).toBeInTheDocument()
  })

  it('explains a network failure', async () => {
    stubApi([route('GET', /^\/documents$/, () => 'network-error')])
    renderApp('/')
    expect(await screen.findByRole('alert')).toHaveTextContent(/can't reach the server/i)
  })

  it('processes a document and refreshes its status', async () => {
    const user = userEvent.setup()
    let docs = [...DOCS]
    const api = stubApi([
      route('GET', /^\/documents$/, () => ({ json: docs })),
      route('POST', /^\/documents\/b\/process$/, () => {
        docs = docs.map((d) => (d.id === 'b' ? { ...d, status: 'processed', pages: 2 } : d))
        return { json: { document_id: 'b', status: 'processed', page_count: 2, word_count: 99, message: 'ok' } }
      }),
    ])
    renderApp('/')
    await screen.findByText('Meeting notes.txt')

    await user.click(screen.getByRole('button', { name: 'Process' }))

    expect(await screen.findByText(/“Meeting notes\.txt” is ready/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Chat' })).toHaveLength(2))
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })

  it('reports a processing failure and keeps the document retryable', async () => {
    const user = userEvent.setup()
    stubApi([
      list(DOCS),
      route('POST', /\/documents\/b\/process$/, () => ({ status: 502, json: { detail: 'The AI provider rate limit or quota was reached.' } })),
    ])
    renderApp('/')
    await screen.findByText('Meeting notes.txt')

    await user.click(screen.getByRole('button', { name: 'Process' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/rate limit or quota/)
    expect(screen.getByRole('button', { name: 'Process' })).toBeEnabled()
  })

  it('asks for confirmation before deleting, and only deletes on confirm', async () => {
    const user = userEvent.setup()
    let docs = [...DOCS]
    const api = stubApi([
      route('GET', /^\/documents$/, () => ({ json: docs })),
      route('DELETE', /^\/documents\/b$/, () => {
        docs = docs.filter((d) => d.id !== 'b')
        return { status: 204 }
      }),
    ])
    renderApp('/')
    await screen.findByText('Meeting notes.txt')

    await user.click(screen.getByRole('button', { name: 'Delete Meeting notes.txt' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this document?' })
    expect(dialog).toHaveTextContent('Meeting notes.txt')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(api.calls.some((c) => c.method === 'DELETE')).toBe(false)
    expect(screen.getByText('Meeting notes.txt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Meeting notes.txt' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByText('Meeting notes.txt')).not.toBeInTheDocument())
    expect(await screen.findByText(/Deleted “Meeting notes\.txt”/)).toBeInTheDocument()
  })

  it('keeps the document and says why when delete fails', async () => {
    const user = userEvent.setup()
    stubApi([list(DOCS), route('DELETE', /\/documents\/a$/, () => ({ status: 409, json: { detail: 'This document is currently being processed.' } }))])
    renderApp('/')
    await screen.findByText('Annual report.pdf')

    await user.click(screen.getByRole('button', { name: 'Delete Annual report.pdf' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText(/currently being processed/)).toBeInTheDocument()
    expect(screen.getByText('Annual report.pdf')).toBeInTheDocument()
  })

  it('disables delete while a document is processing', async () => {
    stubApi([list([makeDoc({ id: 'p', filename: 'Busy.pdf', status: 'processing' })])])
    renderApp('/')
    await screen.findByText('Busy.pdf')
    expect(screen.getByRole('button', { name: 'Delete Busy.pdf' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Processing' })).toBeDisabled()
  })

  it('polls while something is processing and stops once it settles', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let status: DocumentSummary['status'] = 'processing'
      const api = stubApi([route('GET', /^\/documents$/, () => ({ json: [makeDoc({ id: 'p', filename: 'Slow.pdf', status })] }))])
      renderApp('/')
      await screen.findByText('Slow.pdf')
      const before = api.calls.length

      status = 'processed'
      await vi.advanceTimersByTimeAsync(2100)
      await screen.findByRole('link', { name: 'Chat' })
      const settled = api.calls.length
      expect(settled).toBeGreaterThan(before)

      await vi.advanceTimersByTimeAsync(6000)
      expect(api.calls.length).toBe(settled)
    } finally {
      vi.useRealTimers()
    }
  })
})
