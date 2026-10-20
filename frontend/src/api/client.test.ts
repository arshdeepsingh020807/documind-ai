import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, messageFromBody, TIMEOUTS } from './client'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('messageFromBody', () => {
  it('uses a string detail', () => {
    expect(messageFromBody(404, { detail: 'Document not found.' })).toBe('Document not found.')
  })
  it('summarises FastAPI validation arrays', () => {
    expect(messageFromBody(422, { detail: [{ msg: 'String should have at least 1 character' }] })).toContain('at least 1 character')
  })
  it('falls back by status class when there is no detail', () => {
    expect(messageFromBody(500, null)).toMatch(/server ran into a problem/i)
    expect(messageFromBody(418, {})).toBe('Request failed (418).')
  })
})

describe('request errors', () => {
  it('maps a failed fetch to a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api.listDocuments()).rejects.toMatchObject({ kind: 'network', message: expect.stringMatching(/can't reach the server/i) })
  })

  it('maps HTTP errors, keeping the server message and status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'Document not found.' }, 404)))
    const error = await api.getDocument('x').catch((e: ApiError) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'http', status: 404, message: 'Document not found.' })
  })

  it('survives an error body that is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })))
    await expect(api.listDocuments()).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/server ran into a problem/i) })
  })

  it('rejects a 200 whose body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })))
    await expect(api.listDocuments()).rejects.toMatchObject({ message: expect.stringMatching(/could not read/i) })
  })

  it('returns undefined for 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(api.deleteDocument('x')).resolves.toBeUndefined()
  })

  it('times out and reports it as a timeout, not a generic abort', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })))
    const pending = api.listDocuments().catch((e: ApiError) => e)
    await vi.advanceTimersByTimeAsync(TIMEOUTS.default + 1)
    expect(await pending).toMatchObject({ kind: 'timeout' })
  })

  it('reports a caller abort as aborted', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })))
    const controller = new AbortController()
    const pending = api.chat('d', 'q', controller.signal).catch((e: ApiError) => e)
    controller.abort()
    expect(await pending).toMatchObject({ kind: 'aborted' })
  })
})

describe('request shape', () => {
  it('sends chat as JSON with the documented field names', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ answer: 'a', sources: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await api.chat('doc 1', 'What?')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/documents/chat')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ document_id: 'doc 1', question: 'What?' })
  })

  it('url-encodes ids in paths', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}))
    vi.stubGlobal('fetch', fetchMock)
    await api.getDocument('a/b c')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/documents/a%2Fb%20c')
  })
})
