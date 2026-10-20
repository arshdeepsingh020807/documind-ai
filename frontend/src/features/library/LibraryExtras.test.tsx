import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeDoc, renderApp, route, stat, stubApi } from '../../test/utils'
import { NotFoundPage } from '../NotFoundPage'

const DOCS = [
  makeDoc({ id: 'a', filename: 'One.pdf', pages: 10, file_size: 1024 * 1024 }),
  makeDoc({ id: 'b', filename: 'Two.txt', file_type: 'txt', pages: null, status: 'uploaded', file_size: 1024 * 1024 }),
]

describe('keyboard and summary', () => {
  it('"/" focuses the search box, but not while typing elsewhere', async () => {
    const user = userEvent.setup()
    stubApi([route('GET', /^\/documents$/, () => ({ json: DOCS }))])
    renderApp('/')
    const search = await screen.findByRole('searchbox')

    await user.keyboard('/')
    expect(search).toHaveFocus()
    expect(search).toHaveValue('')

    await user.type(search, 'a/b')
    expect(search).toHaveValue('a/b')
  })

  it('Escape clears the search first, then leaves the box', async () => {
    const user = userEvent.setup()
    stubApi([route('GET', /^\/documents$/, () => ({ json: DOCS }))])
    renderApp('/')
    const search = await screen.findByRole('searchbox')

    await user.type(search, 'one')
    await user.keyboard('{Escape}')
    expect(search).toHaveValue('')
    expect(search).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(search).not.toHaveFocus()
  })

  it('summarises documents, ready count, pages and storage', async () => {
    stubApi([route('GET', /^\/documents$/, () => ({ json: DOCS }))])
    renderApp('/')
    const summary = await screen.findByLabelText('Library summary')
    expect(stat(summary, 'documents')).toBe('2')
    expect(stat(summary, 'ready to chat')).toBe('1')
    expect(stat(summary, 'pages read')).toBe('10')
    expect(stat(summary, 'stored')).toBe('2.0 MB')
  })

  it('uses singular wording for a single document', async () => {
    stubApi([route('GET', /^\/documents$/, () => ({ json: [makeDoc({ pages: 1 })] }))])
    renderApp('/')
    const summary = await screen.findByLabelText('Library summary')
    expect(stat(summary, 'document')).toBe('1')
    expect(stat(summary, 'documents')).toBeUndefined()
    expect(stat(summary, 'page read')).toBe('1')
  })
})

describe('page structure', () => {
  it('every page-level state has exactly one h1', async () => {
    stubApi([])
    renderApp('/nowhere', <NotFoundPage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found')
  })

  it('library has an h1 and the empty state does not add a second', async () => {
    stubApi([route('GET', /^\/documents$/, () => ({ json: [] }))])
    renderApp('/')
    await screen.findByRole('heading', { name: 'Ask your documents questions' })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('a missing document is announced with an h1', async () => {
    stubApi([
      route('GET', /^\/documents$/, () => ({ json: [] })),
      route('GET', /^\/documents\/nope$/, () => ({ status: 404, json: { detail: 'Document not found.' } })),
    ])
    renderApp('/d/nope')
    expect(await screen.findByRole('heading', { level: 1, name: 'Document not found' })).toBeInTheDocument()
  })
})
