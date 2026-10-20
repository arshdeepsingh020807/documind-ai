import { Download, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../api/client'
import type { ChatSource, DocumentSummary } from '../../api/types'
import { Button, IconButton } from '../../components/Button'
import { FileIcon } from '../../components/FileIcon'
import type { ChatMessage } from '../../lib/chatHistory'
import { formatBytes, formatUploaded } from '../../lib/format'
import { pageLabel } from './MessageItem'

/** A citation the user just clicked. `token` changes on every click so repeat clicks re-flash the passage. */
export interface Highlight {
  messageId: string
  number: number
  token: number
}

interface SourcesPanelProps {
  doc: DocumentSummary
  message: ChatMessage | null
  highlight: Highlight | null
  onClose: () => void
}

export function SourcesPanel({ doc, message, highlight, onClose }: SourcesPanelProps) {
  const sources = message?.sources ?? []
  const active = highlight && highlight.messageId === message?.id ? highlight : null
  return (
    <div className="side">
      <header className="side__header">
        <h2 className="side__title">Sources</h2>
        <IconButton label="Close sources" className="side__close" onClick={onClose}><X size={18} /></IconButton>
      </header>
      <div className="side__scroll">
        {sources.length === 0 ? (
          <p className="side__empty">Ask a question and the passages behind the answer will appear here, numbered to match the citations.</p>
        ) : (
          <>
            <p className="side__note">
              {sources.length === 1
                ? 'The passage the answer was based on.'
                : `The ${sources.length} passages the answer was based on, closest match first.`}
            </p>
            <ol className="passages">
              {sources.map((source) => (
                <Passage
                  key={`${source.number}-${active?.number === source.number ? active.token : 0}`}
                  source={source}
                  active={active?.number === source.number}
                />
              ))}
            </ol>
          </>
        )}

        <section className="details" aria-label="Document details">
          <h3 className="details__title">Document</h3>
          <div className="details__file">
            <FileIcon type={doc.file_type} />
            <span className="details__name">{doc.filename}</span>
          </div>
          <dl className="details__list">
            <div><dt>Size</dt><dd>{formatBytes(doc.file_size)}</dd></div>
            <div><dt>Pages</dt><dd>{doc.pages ?? '—'}</dd></div>
            <div><dt>Uploaded</dt><dd>{formatUploaded(doc.uploaded_at)}</dd></div>
          </dl>
          <a className="btn btn--secondary btn--sm" href={api.fileUrl(doc.id)} download={doc.filename}>
            <Download size={14} aria-hidden /> Download original
          </a>
        </section>
      </div>
    </div>
  )
}

const CLAMP_CHARS = 320

function Passage({ source, active }: { source: ChatSource; active: boolean }) {
  // Stays clamped when cited: a chunk can be hundreds of words, and the highlight is what draws the eye.
  const [expanded, setExpanded] = useState(false)
  const long = source.text.length > CLAMP_CHARS
  const shown = expanded || !long ? source.text : `${source.text.slice(0, CLAMP_CHARS).trimEnd()}…`
  const percent = Math.round(source.relevance * 100)
  return (
    <li
      className={`passage ${active ? 'passage--active' : ''}`}
      id={`passage-${source.number}`}
      // The key changes on every citation click, so this runs on each one and brings the passage into view.
      ref={(el) => { if (el && active) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }}
    >
      <div className="passage__head">
        <span className="passage__label">
          <span className="passage__num">{source.number}</span>
          {source.page_start ? pageLabel(source.page_start, source.page_end) : `Passage ${source.number}`}
        </span>
        <span className="passage__match">
          <meter min={0} max={100} value={percent} aria-label={`Match ${percent} percent`} />
          {percent}% match
        </span>
      </div>
      <p className="passage__text">{shown}</p>
      {long && (
        <Button size="sm" variant="quiet" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </li>
  )
}
