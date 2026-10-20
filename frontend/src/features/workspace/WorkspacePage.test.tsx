import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ChatResponse, DocumentSummary } from '../../api/types'
import { makeDoc, renderApp, route, stubApi } from '../../test/utils'

const READY = makeDoc({ id: 'doc-1', filename: 'Aurora.pdf', status: 'processed' })

const ANSWER: ChatResponse = {
  answer: 'The lead scientist is **Dr Helga Sigurdsson** [1].',
  sources: [
    { number: 1, chunk_index: 3, page_start: 3, page_end: 3, text: 'Dr Helga Sigurdsson leads the Aurora project.', relevance: 0.82 },
    { number: 2, chunk_index: 7, page_start: 4, page_end: 5, text: 'x'.repeat(400), relevance: 0.31 },
  ],
}

function setup(doc: DocumentSummary = READY, chat: () => { status?: number; json?: unknown } | 'network-error' = () => ({ json: ANSWER })) {
  return stubApi([
    route('GET', /^\/documents$/, () => ({ json: [doc, makeDoc({ id: 'other', filename: 'Other.txt', file_type: 'txt' })] })),
    route('GET', new RegExp(`^/documents/${doc.id}$`), () => ({ json: doc })),
    route('POST', /^\/documents\/chat$/, () => chat()),
  ])
}

const ask = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  await user.type(await screen.findByRole('textbox', { name: /ask a question/i }), `${text}{Enter}`)
}

describe('WorkspacePage', () => {
  it('answers a question and shows the passages behind it', async () => {
    const user = userEvent.setup()
    const api = setup()
    renderApp('/d/doc-1')

    await ask(user, 'Who leads Aurora?')

    expect(await screen.findByText('Dr Helga Sigurdsson', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('Who leads Aurora?')).toBeInTheDocument()
    const chatCall = api.calls.find((c) => c.path === '/documents/chat')
    expect(chatCall?.body).toEqual({ document_id: 'doc-1', question: 'Who leads Aurora?' })

    const sources = screen.getByRole('complementary', { name: /sources and document details/i })
    expect(within(sources).getByText('Page 3')).toBeInTheDocument()
    expect(within(sources).getByText('Pages 4–5')).toBeInTheDocument()
    expect(within(sources).getByText('82% match')).toBeInTheDocument()
    expect(within(sources).getByText('Dr Helga Sigurdsson leads the Aurora project.')).toBeInTheDocument()
  })

  it('clears the composer after sending and ignores blank questions', async () => {
    const user = userEvent.setup()
    const api = setup()
    renderApp('/d/doc-1')
    const box = await screen.findByRole('textbox', { name: /ask a question/i })

    expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled()
    await user.type(box, '   {Enter}')
    expect(api.calls.some((c) => c.path === '/documents/chat')).toBe(false)

    await ask(user, 'hello')
    await screen.findByText(/lead scientist/)
    expect(box).toHaveValue('')
  })

  it('Shift+Enter adds a newline instead of sending', async () => {
    const user = userEvent.setup()
    const api = setup()
    renderApp('/d/doc-1')
    const box = await screen.findByRole('textbox', { name: /ask a question/i })

    await user.type(box, 'line one{Shift>}{Enter}{/Shift}line two')

    expect(box).toHaveValue('line one\nline two')
    expect(api.calls.some((c) => c.path === '/documents/chat')).toBe(false)
  })

  it('sends a suggested question when clicked', async () => {
    const user = userEvent.setup()
    const api = setup()
    renderApp('/d/doc-1')

    await user.click(await screen.findByRole('button', { name: 'What are the key points?' }))

    await screen.findByText(/lead scientist/)
    expect(api.calls.find((c) => c.path === '/documents/chat')?.body).toMatchObject({ question: 'What are the key points?' })
  })

  it('collapses long passages behind Show more', async () => {
    const user = userEvent.setup()
    setup()
    renderApp('/d/doc-1')
    await ask(user, 'q')
    await screen.findByText(/lead scientist/)

    const toggle = screen.getByRole('button', { name: 'Show more' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('x'.repeat(400))).toBeInTheDocument()
  })

  it('shows the error in the conversation and retries without duplicating the question', async () => {
    const user = userEvent.setup()
    let fail = true
    const api = setup(READY, () => (fail ? { status: 502, json: { detail: 'The AI provider could not be reached.' } } : { json: ANSWER }))
    renderApp('/d/doc-1')

    await ask(user, 'Who leads Aurora?')
    expect(await screen.findByRole('alert')).toHaveTextContent('The AI provider could not be reached.')

    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText(/lead scientist/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByText('Who leads Aurora?')).toHaveLength(1)
    expect(api.calls.filter((c) => c.path === '/documents/chat')).toHaveLength(2)
  })

  it('explains a dropped connection', async () => {
    const user = userEvent.setup()
    setup(READY, () => 'network-error')
    renderApp('/d/doc-1')
    await ask(user, 'hi')
    expect(await screen.findByRole('alert')).toHaveTextContent(/can't reach the server/i)
  })

  it('lets the user stop a pending answer', async () => {
    const user = userEvent.setup()
    stubApi([
      route('GET', /^\/documents$/, () => ({ json: [READY] })),
      route('GET', /^\/documents\/doc-1$/, () => ({ json: READY })),
    ])
    // A chat request that never answers and rejects when aborted, like a slow real server.
    const hang = (_url: string, init?: RequestInit) => new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
    })
    const base = globalThis.fetch
    globalThis.fetch = ((url: string, init?: RequestInit) => (url === '/documents/chat' ? hang(url, init) : base(url, init))) as typeof fetch
    renderApp('/d/doc-1')

    await ask(user, 'slow question')
    // One copy is for screen readers, one is visual.
    expect(await screen.findAllByText(/Searching the document/)).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Send question' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Stop generating' }))

    expect(await screen.findByText('Stopped before an answer arrived.')).toBeInTheDocument()
    expect(screen.queryAllByText(/Searching the document/)).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
  })

  it('remembers the conversation after a reload, per document', async () => {
    const user = userEvent.setup()
    setup()
    const first = renderApp('/d/doc-1')
    await ask(user, 'Who leads Aurora?')
    await screen.findByText(/lead scientist/)
    first.unmount()

    renderApp('/d/doc-1')
    expect(await screen.findByText('Who leads Aurora?')).toBeInTheDocument()
    expect(screen.getByText('Dr Helga Sigurdsson', { selector: 'strong' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('documind:chat:doc-1') ?? '[]')).toHaveLength(2)
    expect(localStorage.getItem('documind:chat:other')).toBeNull()
  })

  it('clears the conversation only after confirmation', async () => {
    const user = userEvent.setup()
    setup()
    renderApp('/d/doc-1')
    await ask(user, 'Who leads Aurora?')
    await screen.findByText(/lead scientist/)

    await user.click(screen.getByRole('button', { name: 'Clear conversation' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Who leads Aurora?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear conversation' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clear' }))

    await waitFor(() => expect(screen.queryByText('Who leads Aurora?')).not.toBeInTheDocument())
    expect(localStorage.getItem('documind:chat:doc-1')).toBeNull()
    expect(screen.getByText('Ask anything about this document')).toBeInTheDocument()
  })

  it('offers to process a document that has not been processed', async () => {
    const user = userEvent.setup()
    let doc = makeDoc({ id: 'doc-2', filename: 'Draft.txt', file_type: 'txt', status: 'uploaded', pages: null })
    const api = stubApi([
      route('GET', /^\/documents$/, () => ({ json: [doc] })),
      route('GET', /^\/documents\/doc-2$/, () => ({ json: doc })),
      route('POST', /^\/documents\/doc-2\/process$/, () => {
        doc = { ...doc, status: 'processed', pages: 1 }
        return { json: { document_id: 'doc-2', status: 'processed', page_count: 1, word_count: 10, message: 'ok' } }
      }),
    ])
    renderApp('/d/doc-2')

    expect(await screen.findByText('This document isn’t processed yet')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Process document' }))

    expect(await screen.findByRole('textbox', { name: /ask a question/i })).toBeInTheDocument()
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })

  it('shows why processing failed and lets the user retry', async () => {
    const doc = makeDoc({ id: 'doc-3', filename: 'Scan.pdf', status: 'failed', error: 'No readable text found.' })
    stubApi([route('GET', /^\/documents$/, () => ({ json: [doc] })), route('GET', /^\/documents\/doc-3$/, () => ({ json: doc }))])
    renderApp('/d/doc-3')

    expect(await screen.findByText('Processing failed')).toBeInTheDocument()
    expect(screen.getByText('No readable text found.', { selector: 'p.state__text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows progress for a document that is processing elsewhere', async () => {
    const doc = makeDoc({ id: 'doc-4', filename: 'Big.pdf', status: 'processing' })
    stubApi([route('GET', /^\/documents$/, () => ({ json: [doc] })), route('GET', /^\/documents\/doc-4$/, () => ({ json: doc }))])
    renderApp('/d/doc-4')
    expect(await screen.findByText('Reading “Big.pdf”')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('says so when the document does not exist', async () => {
    stubApi([
      route('GET', /^\/documents$/, () => ({ json: [] })),
      route('GET', /^\/documents\/nope$/, () => ({ status: 404, json: { detail: 'Document not found.' } })),
    ])
    renderApp('/d/nope')
    expect(await screen.findByText('Document not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to library' })).toHaveAttribute('href', '/library')
  })

  it('lists other documents in the rail and marks the current one', async () => {
    setup()
    renderApp('/d/doc-1')
    const rail = await screen.findByRole('navigation', { name: 'Documents' })
    expect(await within(rail).findByRole('link', { name: /Other\.txt/ })).toHaveAttribute('href', '/d/other')
    expect(within(rail).getByRole('link', { name: /Aurora\.pdf/ })).toHaveAttribute('aria-current', 'page')
  })
})

describe('citations in the workspace', () => {
  it('renders [1] in the answer as a chip, and clicking it highlights that passage', async () => {
    const user = userEvent.setup()
    setup()
    renderApp('/d/doc-1')
    await ask(user, 'Who leads Aurora?')

    const chip = await screen.findByRole('button', { name: 'Source 1' })
    expect(chip).toHaveAttribute('title', expect.stringContaining('Page 3'))
    expect(chip).toHaveAttribute('title', expect.stringContaining('Dr Helga Sigurdsson leads'))

    const sources = screen.getByRole('complementary', { name: /sources and document details/i })
    expect(sources.querySelector('.passage--active')).toBeNull()

    await user.click(chip)

    const active = sources.querySelector('.passage--active')
    expect(active).not.toBeNull()
    expect(active).toHaveTextContent('Dr Helga Sigurdsson leads the Aurora project.')
  })

  it('shows the same passage numbers the citations use', async () => {
    const user = userEvent.setup()
    setup()
    renderApp('/d/doc-1')
    await ask(user, 'q')
    await screen.findByRole('button', { name: 'Source 1' })
    const sources = screen.getByRole('complementary', { name: /sources and document details/i })
    const numbers = [...sources.querySelectorAll('.passage__num')].map((n) => n.textContent)
    expect(numbers).toEqual(['1', '2'])
  })

  it('clicking a different message’s citation switches the sources panel to that answer', async () => {
    const user = userEvent.setup()
    let n = 0
    setup(READY, () => ({
      json: {
        answer: `Answer ${++n} [1].`,
        sources: [{ number: 1, chunk_index: n, page_start: null, page_end: null, text: `Text of answer ${n}`, relevance: 0.5 }],
      },
    }))
    renderApp('/d/doc-1')
    await ask(user, 'first')
    await screen.findByText(/Answer 1/)
    await ask(user, 'second')
    await screen.findByText(/Answer 2/)

    const sources = screen.getByRole('complementary', { name: /sources and document details/i })
    expect(sources).toHaveTextContent('Text of answer 2')

    await user.click(screen.getAllByRole('button', { name: 'Source 1' })[0]!)
    expect(sources).toHaveTextContent('Text of answer 1')
    expect(sources).not.toHaveTextContent('Text of answer 2')
  })

  it('does not chip a citation the model invented', async () => {
    const user = userEvent.setup()
    setup(READY, () => ({ json: { answer: 'Bogus [9] but real [1].', sources: ANSWER.sources } }))
    renderApp('/d/doc-1')
    await ask(user, 'q')
    await screen.findByText(/Bogus \[9\] but real/)
    expect(screen.getAllByRole('button', { name: /^Source \d$/ }).map((b) => b.textContent)).toEqual(['1'])
  })

  it('introduces the document before the first question', async () => {
    setup()
    renderApp('/d/doc-1')
    expect(await screen.findByText('4 pages · 2.0 KB')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /key points|summarize|important names/i })).toHaveLength(3)
  })
})
