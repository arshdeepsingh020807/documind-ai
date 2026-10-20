import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import type { DocumentSummary } from '../api/types'
import { ToastProvider } from '../components/Toast'
import { LibraryPage } from '../features/library/LibraryPage'
import { WorkspacePage } from '../features/workspace/WorkspacePage'

export function makeDoc(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: 'doc-1',
    filename: 'report.pdf',
    file_type: 'pdf',
    status: 'processed',
    file_size: 2048,
    uploaded_at: '2026-01-15T10:30:00',
    pages: 4,
    error: null,
    ...overrides,
  }
}

interface FakeRequest {
  method: string
  path: string
  body: unknown
}
type Reply = { status?: number; json?: unknown } | 'network-error'
type Handler = (request: FakeRequest) => Reply | Promise<Reply>
interface Route_ {
  method: string
  pattern: RegExp
  handler: Handler
}

/** Replaces global fetch with an in-memory router; unmatched requests fail the test loudly. */
export function stubApi(routes: Route_[]) {
  const calls: FakeRequest[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    const request = { method, path, body }
    calls.push(request)
    const route = routes.find((r) => r.method === method && r.pattern.test(path))
    if (!route) throw new Error(`Unexpected request: ${method} ${path}`)
    const reply = await route.handler(request)
    if (reply === 'network-error') throw new TypeError('Failed to fetch')
    const status = reply.status ?? 200
    return new Response(status === 204 ? null : JSON.stringify(reply.json ?? {}), { status })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock }
}

/** Reads a library stat by its label, e.g. stat(summary, 'pages read') -> '10'. */
export function stat(summary: HTMLElement, label: string): string | undefined {
  const term = [...summary.querySelectorAll('dt')].find((dt) => dt.textContent === label)
  return term?.parentElement?.querySelector('dd')?.textContent ?? undefined
}

export const route = (method: string, pattern: RegExp, handler: Handler): Route_ => ({ method, pattern, handler })

export function renderApp(initialPath: string, ui?: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, staleTime: 0 }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          {ui ?? (
            <Routes>
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/d/:id" element={<WorkspacePage />} />
            </Routes>
          )}
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}
