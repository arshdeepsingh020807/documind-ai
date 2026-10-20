import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { EmptyState } from '../components/States'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <>
      <AppHeader />
      <main id="main" className="page page--narrow">
        <EmptyState level={1} title="Page not found" action={<Link to="/" className="btn btn--primary btn--md">Go to library</Link>}>
          There’s nothing at this address.
        </EmptyState>
      </main>
    </>
  )
}
