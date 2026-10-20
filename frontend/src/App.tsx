import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { LibraryPage } from './features/library/LibraryPage'
import { NotFoundPage } from './features/NotFoundPage'
import { WorkspacePage } from './features/workspace/WorkspacePage'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5_000, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  })
}

export function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <a href="#main" className="skip-link">Skip to content</a>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<LibraryPage />} />
            <Route path="/d/:id" element={<WorkspacePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  )
}
