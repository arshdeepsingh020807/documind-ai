import type { DocumentSummary } from '../../api/types'
import { isReady } from '../../lib/format'

export type StatusFilter = 'all' | 'ready' | 'processing' | 'attention'
export type SortKey = 'newest' | 'oldest' | 'name' | 'size'

export interface LibraryView {
  query: string
  status: StatusFilter
  sort: SortKey
}

export const DEFAULT_VIEW: LibraryView = { query: '', status: 'all', sort: 'newest' }

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'ready', label: 'Ready' },
  { value: 'processing', label: 'Processing' },
  { value: 'attention', label: 'Needs attention' },
]

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'size', label: 'Largest first' },
]

function matchesStatus(doc: DocumentSummary, status: StatusFilter): boolean {
  switch (status) {
    case 'all': return true
    case 'ready': return isReady(doc)
    case 'processing': return doc.status === 'processing'
    case 'attention': return doc.status === 'uploaded' || doc.status === 'failed'
  }
}

export function isViewActive(view: LibraryView): boolean {
  return view.query.trim() !== '' || view.status !== 'all'
}

export function applyView(docs: DocumentSummary[], view: LibraryView): DocumentSummary[] {
  const query = view.query.trim().toLowerCase()
  const filtered = docs.filter(
    (doc) => matchesStatus(doc, view.status) && (!query || doc.filename.toLowerCase().includes(query)),
  )
  const time = (d: DocumentSummary) => new Date(d.uploaded_at).getTime()
  return filtered.sort((a, b) => {
    switch (view.sort) {
      case 'newest': return time(b) - time(a)
      case 'oldest': return time(a) - time(b)
      case 'name': return a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base', numeric: true })
      case 'size': return b.file_size - a.file_size
    }
  })
}
