import type { DocumentStatus, DocumentSummary } from '../api/types'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** "Today, 14:05", "Yesterday, 09:30", otherwise "12 Mar 2026". */
export function formatUploaded(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (dayDiff === 0) return `Today, ${timeFmt.format(date)}`
  if (dayDiff === 1) return `Yesterday, ${timeFmt.format(date)}`
  return dateFmt.format(date)
}

export type StatusTone = 'neutral' | 'busy' | 'good' | 'bad'

export interface StatusInfo {
  label: string
  tone: StatusTone
  /** Indexed and searchable. */
  ready: boolean
}

export function statusInfo(status: DocumentStatus): StatusInfo {
  switch (status) {
    case 'processed':
    case 'ready':
      return { label: 'Ready', tone: 'good', ready: true }
    case 'processing':
      return { label: 'Processing', tone: 'busy', ready: false }
    case 'failed':
      return { label: 'Failed', tone: 'bad', ready: false }
    case 'uploaded':
      return { label: 'Not processed', tone: 'neutral', ready: false }
  }
}

export function isReady(doc: Pick<DocumentSummary, 'status'>): boolean {
  return statusInfo(doc.status).ready
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
