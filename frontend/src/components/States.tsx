import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

type Level = 1 | 2

/** Page-level states are the only heading on their page, so they pass level={1}. */
function Heading({ level, className, children }: { level: Level; className: string; children: ReactNode }) {
  return level === 1 ? <h1 className={className}>{children}</h1> : <h2 className={className}>{children}</h2>
}

export function EmptyState({ title, children, action, level = 2 }: { title: string; children?: ReactNode; action?: ReactNode; level?: Level }) {
  return (
    <div className="state">
      <Heading level={level} className="state__title">{title}</Heading>
      {children && <p className="state__text">{children}</p>}
      {action && <div className="state__action">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, retrying = false, level = 2 }: { title?: string; message: string; onRetry?: () => void; retrying?: boolean; level?: Level }) {
  return (
    <div className="state state--error" role="alert">
      <AlertTriangle size={28} aria-hidden />
      <Heading level={level} className="state__title">{title}</Heading>
      <p className="state__text">{message}</p>
      {onRetry && (
        <div className="state__action">
          <Button onClick={onRetry} loading={retrying}>Try again</Button>
        </div>
      )}
    </div>
  )
}
