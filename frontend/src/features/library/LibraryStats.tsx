import type { DocumentSummary } from '../../api/types'
import { formatBytes, isReady } from '../../lib/format'

/** Three numbers that describe the whole library at a glance. */
export function LibraryStats({ documents }: { documents: DocumentSummary[] }) {
  const ready = documents.filter(isReady).length
  const pages = documents.reduce((sum, d) => sum + (d.pages ?? 0), 0)
  const bytes = documents.reduce((sum, d) => sum + d.file_size, 0)
  const stats = [
    { value: documents.length, label: documents.length === 1 ? 'document' : 'documents' },
    { value: ready, label: 'ready to chat' },
    { value: pages, label: pages === 1 ? 'page read' : 'pages read' },
  ]
  return (
    <dl className="stats" aria-label="Library summary">
      {stats.map((s) => (
        <div key={s.label} className="stat">
          <dt className="stat__label">{s.label}</dt>
          <dd className="stat__value">{s.value.toLocaleString()}</dd>
        </div>
      ))}
      <div className="stat stat--aside">
        <dt className="stat__label">stored</dt>
        <dd className="stat__aside-value">{formatBytes(bytes)}</dd>
      </div>
    </dl>
  )
}
