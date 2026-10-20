import { AlertCircle, CheckCircle2, Circle } from 'lucide-react'
import type { DocumentStatus } from '../api/types'
import { statusInfo } from '../lib/format'
import { Spinner } from './Spinner'

interface StatusBadgeProps {
  status: DocumentStatus
  /** Locally-known processing (this tab started it), which can be ahead of the server's status. */
  busy?: boolean
}

export function StatusBadge({ status, busy = false }: StatusBadgeProps) {
  const info = statusInfo(busy ? 'processing' : status)
  const icon =
    info.tone === 'busy' ? <Spinner /> :
    info.tone === 'good' ? <CheckCircle2 size={14} aria-hidden /> :
    info.tone === 'bad' ? <AlertCircle size={14} aria-hidden /> :
    <Circle size={14} aria-hidden />
  // Icon + text, never colour alone.
  return (
    <span className={`badge badge--${info.tone}`}>
      {icon}
      {info.label}
    </span>
  )
}
