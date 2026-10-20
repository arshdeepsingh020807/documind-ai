import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ChatResponse } from '../../api/types'
import { makeDoc, renderApp, route, stubApi } from '../../test/utils'

const DOC = makeDoc({ id: 'doc-1', filename: 'Aurora.pdf' })

const source = (over: Partial<ChatResponse['sources'][number]>) => ({
  number: 1, chunk_index: 3, page_start: 3, page_end: 3, text: 'A passage about glaciers.', relevance: 0.8, ...over,
})

function open(sources: ChatResponse['sources']) {
  stubApi([
    route('GET', /^\/documents$/, () => ({ json: [DOC] })),
    route('GET', /^\/documents\/doc-1$/, () => ({ json: DOC })),
    route('POST', /^\/documents\/chat$/, () => ({ json: { answer: 'Glaciers are melting [1].', sources } })),
  ])
  return renderApp('/d/doc-1')
}

async function ask(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: /ask a question/i }), 'q{Enter}')
  await screen.findByRole('button', { name: 'Source 1' })
}
const panel = () => screen.getByRole('complementary', { name: /sources and document details/i })

describe('page preview', () => {
  it('is collapsed until asked for, then shows the server-rendered page with a descriptive alt', async () => {
    const user = userEvent.setup()
    open([source({ number: 1 }), source({ number: 2, chunk_index: 7 })])
    await ask(user)

    expect(within(panel()).queryAllByRole('img')).toHaveLength(0)
    await user.click(within(panel()).getAllByRole('button', { name: 'Show page' })[0]!)

    const image = within(panel()).getByRole('img', { name: 'Page 3 of Aurora.pdf, with the cited passage highlighted' })
    expect(image).toHaveAttribute('src', '/documents/doc-1/passages/3/preview?page=3')
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(within(panel()).getByRole('button', { name: 'Hide page' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens the cited passage’s page straight away when its citation chip is clicked', async () => {
    const user = userEvent.setup()
    open([source({ number: 1 }), source({ number: 2, chunk_index: 7, page_start: 9, page_end: 9 })])
    await ask(user)

    await user.click(screen.getByRole('button', { name: 'Source 1' }))

    const images = within(panel()).getAllByRole('img')
    expect(images).toHaveLength(1) // only the cited passage opened
    expect(images[0]).toHaveAttribute('src', expect.stringContaining('/passages/3/preview?page=3'))
  })

  it('lets you switch between the pages a passage spans', async () => {
    const user = userEvent.setup()
    open([source({ chunk_index: 7, page_start: 4, page_end: 5 })])
    await ask(user)
    await user.click(within(panel()).getByRole('button', { name: 'Show page' }))

    const tabs = within(panel()).getByRole('group', { name: 'Pages this passage spans' })
    expect(within(tabs).getAllByRole('button').map((b) => b.textContent)).toEqual(['Page 4', 'Page 5'])
    expect(within(tabs).getByRole('button', { name: 'Page 4' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(tabs).getByRole('button', { name: 'Page 5' }))
    expect(within(panel()).getByRole('img')).toHaveAttribute('src', '/documents/doc-1/passages/7/preview?page=5')
    expect(within(tabs).getByRole('button', { name: 'Page 5' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers no preview for files without real pages', async () => {
    const user = userEvent.setup()
    open([source({ page_start: null, page_end: null })])
    await ask(user)
    expect(within(panel()).queryByRole('button', { name: 'Show page' })).not.toBeInTheDocument()
    expect(within(panel()).getByText('Passage 1')).toBeInTheDocument()
  })

  it('falls back to a plain note, not a broken image, when the preview fails', async () => {
    const user = userEvent.setup()
    open([source({})])
    await ask(user)
    await user.click(within(panel()).getByRole('button', { name: 'Show page' }))

    // fireEvent-style error: the browser reports the image failed to load
    within(panel()).getByRole('img').dispatchEvent(new Event('error'))

    expect(await within(panel()).findByText(/page preview isn’t available/)).toBeInTheDocument()
    expect(within(panel()).queryByRole('img')).not.toBeInTheDocument()
    expect(within(panel()).getByText('A passage about glaciers.')).toBeInTheDocument() // the text is still there
  })

  it('enlarges the page in a dialog', async () => {
    const user = userEvent.setup()
    open([source({})])
    await ask(user)
    await user.click(within(panel()).getByRole('button', { name: 'Show page' }))
    await user.click(within(panel()).getByRole('button', { name: 'Enlarge page 3' }))

    const dialog = await screen.findByRole('dialog', { name: 'Page 3' })
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/documents/doc-1/passages/3/preview?page=3')
    await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('help dialog', () => {
  it('explains the ideas on screen, in plain words, and closes', async () => {
    const user = userEvent.setup()
    open([source({})])
    await screen.findByRole('textbox', { name: /ask a question/i }) // wait for the page itself, not its loading placeholder
    await user.click(screen.getByRole('button', { name: 'How DocuMind works' }))

    const dialog = await screen.findByRole('dialog', { name: 'How DocuMind works' })
    for (const term of ['Processing', 'Numbered citations', '% match', 'Page preview', 'Your data']) {
      expect(within(dialog).getByText(term, { selector: 'dt' })).toBeInTheDocument()
    }
    expect(within(dialog).getByText(/not a score for whether the answer is right/)).toBeInTheDocument()
    expect(within(dialog).getByText(/visible to everyone who uses this site/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('status hints', () => {
  it('every status explains itself in a tooltip', async () => {
    stubApi([route('GET', /^\/documents$/, () => ({ json: [
      makeDoc({ id: 'a', filename: 'a.pdf', status: 'processed' }),
      makeDoc({ id: 'b', filename: 'b.pdf', status: 'uploaded' }),
      makeDoc({ id: 'c', filename: 'c.pdf', status: 'failed', error: 'x' }),
    ] }))])
    renderApp('/library')
    await screen.findByText('a.pdf')
    // "Ready" is also an option in the status filter, so look at badges only.
    const badge = (label: string) => screen.getAllByText(label).find((el) => el.classList.contains('badge'))
    expect(badge('Ready')).toHaveAttribute('title', expect.stringContaining('ask questions'))
    expect(badge('Not processed')).toHaveAttribute('title', expect.stringContaining('Process it'))
    expect(badge('Failed')).toHaveAttribute('title', expect.stringContaining('try again'))
  })
})

describe('one-time citation tip', () => {
  it('appears only once an answer has sources, and dismissing it is remembered', async () => {
    const user = userEvent.setup()
    open([source({})])
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    await ask(user)

    expect(screen.getByRole('note')).toHaveTextContent(/click a numbered chip/)
    await user.click(screen.getByRole('button', { name: 'Dismiss tip' }))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(localStorage.getItem('documind:coach:citations')).toBe('1')
  })

  it('goes away by itself once the user clicks a citation', async () => {
    const user = userEvent.setup()
    open([source({})])
    await ask(user)
    await user.click(screen.getByRole('button', { name: 'Source 1' }))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(localStorage.getItem('documind:coach:citations')).toBe('1')
  })

  it('stays away for someone who has already dismissed it', async () => {
    localStorage.setItem('documind:coach:citations', '1')
    const user = userEvent.setup()
    open([source({})])
    await ask(user)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
