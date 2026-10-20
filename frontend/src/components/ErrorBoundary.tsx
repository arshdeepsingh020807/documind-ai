import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'
import { ErrorState } from './States'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="page page--narrow">
        <ErrorState level={1} title="This page crashed" message="An unexpected error stopped the page from displaying. Reloading usually fixes it." />
        <div className="state__action state__action--center">
          <Button variant="primary" onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </main>
    )
  }
}
