import { Download, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { DocumentSummary } from '../../api/types'
import { Button, IconButton } from '../../components/Button'
import { FileIcon } from '../../components/FileIcon'
import { StatusBadge } from '../../components/StatusBadge'
import { formatBytes, formatUploaded, isReady } from '../../lib/format'

interface DocumentTableProps {
  documents: DocumentSummary[]
  processingIds: Set<string>
  onProcess: (doc: DocumentSummary) => void
  onDelete: (doc: DocumentSummary) => void
}

export function DocumentTable({ documents, processingIds, onProcess, onDelete }: DocumentTableProps) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <caption className="sr-only">Your documents</caption>
        <colgroup>
          <col />
          <col className="col-size" />
          <col className="col-pages" />
          <col className="col-uploaded" />
          <col className="col-status" />
          <col className="col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Document</th>
            <th scope="col">Size</th>
            <th scope="col" className="cell-pages">Pages</th>
            <th scope="col">Uploaded</th>
            <th scope="col">Status</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              busy={processingIds.has(doc.id) || doc.status === 'processing'}
              onProcess={onProcess}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface RowProps {
  doc: DocumentSummary
  busy: boolean
  onProcess: (doc: DocumentSummary) => void
  onDelete: (doc: DocumentSummary) => void
}

function DocumentRow({ doc, busy, onProcess, onDelete }: RowProps) {
  const ready = isReady(doc)
  return (
    <tr className="doc-row">
      <td className="doc-row__name" data-label="Document">
        <div className="doc-cell">
          <FileIcon type={doc.file_type} />
          <div className="doc-row__title">
            <Link to={`/d/${doc.id}`} className="doc-link">{doc.filename}</Link>
            {doc.status === 'failed' && doc.error && !busy && <p className="doc-row__error">{doc.error}</p>}
          </div>
        </div>
      </td>
      <td data-label="Size" className="num">{formatBytes(doc.file_size)}</td>
      <td data-label="Pages" className="num cell-pages">{doc.pages ?? '—'}</td>
      <td data-label="Uploaded">{formatUploaded(doc.uploaded_at)}</td>
      <td data-label="Status"><StatusBadge status={doc.status} busy={busy} /></td>
      <td className="doc-row__actions-cell">
        <div className="doc-row__actions">
        {ready ? (
          <Link to={`/d/${doc.id}`} className="btn btn--primary btn--sm">Chat</Link>
        ) : (
          <Button size="sm" variant="primary" loading={busy} onClick={() => onProcess(doc)}>
            {busy ? 'Processing' : doc.status === 'failed' ? 'Retry' : 'Process'}
          </Button>
        )}
        <a className="icon-btn icon-btn--default" href={api.fileUrl(doc.id)} download={doc.filename} aria-label={`Download ${doc.filename}`} title="Download">
          <Download size={18} />
        </a>
        <IconButton label={`Delete ${doc.filename}`} tone="danger" disabled={busy} onClick={() => onDelete(doc)}>
          <Trash2 size={18} />
        </IconButton>
        </div>
      </td>
    </tr>
  )
}
