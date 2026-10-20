import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { App } from '../../App'
import { MemoryRouter } from 'react-router-dom'
import { renderApp, route, stubApi } from '../../test/utils'
import { FAQ, GOOD_TO_KNOW, SAMPLE_URL } from './content'
import { LandingPage } from './LandingPage'
import { useSeen } from './Reveal'

const renderLanding = () => renderApp('/', <LandingPage />)

/** Reduced motion makes the scripted answer appear instantly instead of typing out. */
const reduceMotion = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }))

beforeEach(() => reduceMotion())
afterEach(() => vi.unstubAllGlobals())

describe('landing page structure', () => {
  it('has one h1 and a heading for every section', () => {
    renderLanding()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    for (const name of ['Three steps, no setup', 'Built around checking the answer', 'Questions people bring to a document', 'Good to know before you upload', 'Questions, answered', 'Try it on your own document']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })

  it('links the header to the sections and to the app', () => {
    renderLanding()
    const nav = screen.getByRole('navigation', { name: 'Page sections' })
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['#how', '#features', '#faq'])
    for (const href of ['#how', '#features', '#faq']) expect(document.querySelector(href)).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Open app' })).toHaveAttribute('href', '/library')
    expect(screen.getByRole('link', { name: /DocuMind, go to the home page/ })).toHaveAttribute('href', '/')
  })

  it('says plainly what the site does not do, and where documents go', () => {
    renderLanding()
    for (const item of GOOD_TO_KNOW) expect(screen.getByText(item.title)).toBeInTheDocument()
    expect(screen.getByText(/Everyone who uses this site sees the same documents/)).toBeInTheDocument()
    expect(screen.getByText(/text is sent to the AI provider/)).toBeInTheDocument()
  })

  it('makes no claims it cannot back up (no user counts, ratings, logos or prices)', () => {
    renderLanding()
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/\d[\d,.]*\+?\s*(users|customers|students|teams|researchers)/i)
    expect(text).not.toMatch(/trusted by|rated|★|stars|testimonial|\$\d|€\d|per month|free trial|enterprise|soc ?2|encrypt/i)
  })
})

describe('FAQ', () => {
  it('lists every question collapsed and opens one on click', async () => {
    const user = userEvent.setup()
    renderLanding()
    const items = document.querySelectorAll('details.faq__item')
    expect(items).toHaveLength(FAQ.length)
    expect([...items].every((d) => !(d as HTMLDetailsElement).open)).toBe(true)

    await user.click(screen.getByText('What can I upload?'))
    expect((items[0] as HTMLDetailsElement).open).toBe(true)
    expect(screen.getByText(/up to 25 MB each/)).toBeVisible()
  })
})

describe('interactive example', () => {
  it('is labelled as an example, not a live model', () => {
    renderLanding()
    expect(screen.getByText(/Example · scripted, not a live model/)).toBeInTheDocument()
  })

  it('highlights exactly the cited lines on the page when a chip is clicked', async () => {
    const user = userEvent.setup()
    renderLanding()
    const page = screen.getByRole('figure')
    const highlighted = () => [...page.querySelectorAll('.demo__line--hl')].map((l) => l.textContent)

    // Passage 1 is selected by default
    expect(highlighted().join(' ')).toContain('average of 1.8 metres per year')
    expect(highlighted().join(' ')).not.toContain('southern margin')
    expect(page).toHaveAccessibleName(/Page 2 of the sample document/)

    await user.click(screen.getByRole('button', { name: 'Source 2' }))
    expect(highlighted()).toHaveLength(3)
    expect(highlighted().join(' ')).toContain('southern margin')
    expect(screen.getByText(/The southern margin lost the most, at 2.6 metres per year, while/)).toBeInTheDocument()
  })

  it('switching question changes the answer, the page and resets the selected citation', async () => {
    const user = userEvent.setup()
    renderLanding()
    await user.click(screen.getByRole('button', { name: 'Source 2' }))
    await user.click(screen.getByRole('button', { name: 'Who led the survey, and how big was the team?' }))

    expect(screen.getByRole('button', { name: 'Who led the survey, and how big was the team?' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Dr Maren Holt led the survey/)).toBeInTheDocument()
    expect(screen.getByRole('figure')).toHaveAccessibleName(/Page 1 of the sample document/)
    expect(screen.getAllByRole('button', { name: /^Source \d$/ })).toHaveLength(2) // both sentences cite [1]
  })

  it('every citation in every scripted answer points at a passage that exists on its page', async () => {
    const { DEMO_QUESTIONS, DEMO_PAGES } = await import('./demoData')
    for (const q of DEMO_QUESTIONS) {
      const cited = [...q.answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))
      for (const n of cited) expect(q.passages.some((p) => p.number === n)).toBe(true)
      for (const p of q.passages) {
        const lines = DEMO_PAGES[p.page]!
        expect(p.lines.every((i) => i >= 0 && i < lines.length)).toBe(true)
        // the highlighted lines really contain the passage's words, in order
        const onPage = p.lines.map((i) => lines[i]).join(' ')
        expect(onPage.replace(/\s+/g, ' ')).toBe(p.text.replace(/\s+/g, ' '))
      }
    }
  })
})

describe('trying a document from the hero', () => {
  const fileOf = (name: string) => new File(['%PDF-1.4 test'], name, { type: 'application/pdf' })

  it('picking a file opens the upload dialog and starts the upload', async () => {
    const upload = vi.spyOn(client, 'uploadDocument').mockResolvedValue({ document_id: 'new', filename: 'a.pdf', status: 'uploaded', message: 'ok' })
    stubApi([route('GET', /^\/documents$/, () => ({ json: [] })), route('POST', /\/process$/, () => ({ json: { document_id: 'new', status: 'processed', page_count: 1, word_count: 5, message: 'ok' } }))])
    const user = userEvent.setup({ applyAccept: false })
    renderLanding()

    await user.upload(screen.getAllByLabelText('Choose files to upload')[0]!, fileOf('a.pdf'))

    const dialog = await screen.findByRole('dialog', { name: 'Upload documents' })
    expect(await within(dialog).findByText('Ready to chat.')).toBeInTheDocument()
    expect(upload).toHaveBeenCalledTimes(1)
    expect(within(dialog).getByRole('link', { name: 'Open chat' })).toHaveAttribute('href', '/d/new')
  })

  it('"Try a sample document" fetches the bundled PDF and uploads it like any other file', async () => {
    const seen: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      seen.push(String(url))
      return String(url) === SAMPLE_URL ? new Response(new Blob(['%PDF-1.4 sample']), { status: 200 }) : new Response('[]', { status: 200 })
    }))
    const upload = vi.spyOn(client, 'uploadDocument').mockResolvedValue({ document_id: 's', filename: 'glacier-field-notes.pdf', status: 'uploaded', message: 'ok' })
    const user = userEvent.setup()
    renderLanding()

    await user.click(screen.getByRole('button', { name: 'Try a sample document' }))

    await screen.findByRole('dialog', { name: 'Upload documents' })
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    const sent = upload.mock.calls[0]![0]
    expect(sent.name).toBe('glacier-field-notes.pdf')
    expect(sent.type).toBe('application/pdf')
    expect(seen).toContain(SAMPLE_URL)
  })

  it('tells the user when the sample cannot be loaded, instead of failing silently', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })))
    const upload = vi.spyOn(client, 'uploadDocument')
    const user = userEvent.setup()
    renderLanding()

    await user.click(screen.getByRole('button', { name: 'Try a sample document' }))

    expect(await screen.findByText(/Couldn’t load the sample document/)).toBeInTheDocument()
    expect(upload).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try a sample document' })).toBeEnabled()
  })
})

describe('scroll reveal never hides content for good', () => {
  function Probe() {
    const [ref, seen] = useSeen<HTMLDivElement>()
    return <div ref={ref} data-testid="probe">{seen ? 'seen' : 'waiting'}</div>
  }

  it('shows content immediately when scroll observation is unavailable', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('seen')
  })

  it('shows content immediately when the user prefers reduced motion', () => {
    class NeverFires { observe() {} disconnect() {} }
    vi.stubGlobal('IntersectionObserver', NeverFires)
    render(<Probe />) // beforeEach set reduced motion
    expect(screen.getByTestId('probe')).toHaveTextContent('seen')
  })

  it('otherwise waits until the element scrolls into view, then stays shown', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    let fire: (entries: { isIntersecting: boolean }[]) => void = () => {}
    class FakeObserver { constructor(cb: typeof fire) { fire = cb } observe() {} disconnect() {} }
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('waiting')
    act(() => fire([{ isIntersecting: false }]))
    expect(screen.getByTestId('probe')).toHaveTextContent('waiting')
    act(() => fire([{ isIntersecting: true }]))
    expect(screen.getByTestId('probe')).toHaveTextContent('seen')
  })
})

describe('routing', () => {
  const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)

  it('/ is the landing page, /library the library, anything else a 404', async () => {
    stubApi([route('GET', /^\/documents$/, () => ({ json: [] }))])
    const first = at('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Ask your document anything/)
    first.unmount()

    const second = at('/library')
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument()
    second.unmount()

    at('/definitely/not/a/page')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to library' })).toHaveAttribute('href', '/library')
  })
})
