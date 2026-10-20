import { FileText, Plus } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import type { DocumentSummary } from '../../api/types'
import { statusInfo } from '../../lib/format'

interface DocumentRailProps {
  documents: DocumentSummary[] | undefined
  loading: boolean
  onNavigate: () => void
}

export function DocumentRail({ documents, loading, onNavigate }: DocumentRailProps) {
  return (
    <nav className="rail" aria-label="Documents">
      <div className="rail__head">
        <h2 className="rail__title">Documents</h2>
        <Link to="/" className="rail__add" onClick={onNavigate}><Plus size={14} aria-hidden /> Library</Link>
      </div>
      {loading && <div className="skeleton-list rail__skeleton">{[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton--line" />)}</div>}
      <ul className="rail__list">
        {documents?.map((doc) => {
          const info = statusInfo(doc.status)
          return (
            <li key={doc.id}>
              <NavLink to={`/d/${doc.id}`} className="rail__item" onClick={onNavigate}>
                <FileText size={16} aria-hidden />
                <span className="rail__name">{doc.filename}</span>
                <span className={`dot dot--${info.tone}`} role="img" aria-label={info.label} title={info.label} />
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
