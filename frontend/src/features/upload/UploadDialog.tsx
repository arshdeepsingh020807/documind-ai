import { AlertCircle, CheckCircle2, FileText, UploadCloud, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, IconButton } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Spinner } from '../../components/Spinner'
import { ACCEPT_ATTRIBUTE } from '../../lib/files'
import { formatBytes } from '../../lib/format'
import type { UploadQueue } from './useUploadQueue'

interface UploadDialogProps {
  open: boolean
  onClose: () => void
  queue: UploadQueue
}

export function UploadDialog({ open, onClose, queue }: UploadDialogProps) {
  const { items, busy, autoProcess, setAutoProcess, addFiles, remove, reset } = queue
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []))
    event.target.value = '' // allow picking the same file again
  }
  const onDropHere = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation() // keep the page-level drop handler from adding the files twice
    setDragOver(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Upload documents"
      description="PDF, DOCX, TXT or Markdown, up to 25 MB each."
      dismissible={!busy}
      wide
      footer={
        <>
          <label className="check">
            <input type="checkbox" checked={autoProcess} onChange={(e) => setAutoProcess(e.target.checked)} />
            Process after upload
          </label>
          <Button variant="primary" onClick={close} disabled={busy}>{busy ? 'Working…' : 'Done'}</Button>
        </>
      }
    >
      <div
        className={`dropzone ${dragOver ? 'dropzone--over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDropHere}
      >
        <UploadCloud size={28} aria-hidden />
        <p className="dropzone__text">Drag files here, or</p>
        <Button onClick={() => inputRef.current?.click()}>Choose files</Button>
        <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTRIBUTE} onChange={onPick} className="sr-only" tabIndex={-1} aria-label="Choose files to upload" />
      </div>

      <p className="dialog__note">
        This site has no accounts: every document is visible to everyone who uses it, and its text is sent to an AI
        provider to answer questions. Don’t upload anything sensitive.
      </p>

      {items.length > 0 && (
        <ul className="queue" aria-label="Upload progress" aria-live="polite">
          {items.map((item) => (
            <li key={item.id} className={`queue__item queue__item--${item.state}`}>
              <FileText size={18} aria-hidden />
              <div className="queue__main">
                <p className="queue__name">{item.name} <span className="muted">{formatBytes(item.size)}</span></p>
                {item.state === 'uploading' && (
                  <progress className="queue__bar" max={1} value={item.progress} aria-label={`Uploading ${item.name}`} />
                )}
                {item.state === 'processing' && <p className="queue__note">Reading and indexing the document. This can take a minute.</p>}
                {item.message && <p className={`queue__note ${item.state === 'error' ? 'queue__note--error' : ''}`}>{item.message}</p>}
              </div>
              <span className="queue__status" aria-hidden>
                {(item.state === 'uploading' || item.state === 'processing') && <Spinner />}
                {item.state === 'done' && <CheckCircle2 size={18} />}
                {item.state === 'error' && <AlertCircle size={18} />}
              </span>
              {item.state === 'done' && item.documentId && (
                <Link to={`/d/${item.documentId}`} className="btn btn--secondary btn--sm" onClick={close}>
                  {item.ready ? 'Open chat' : 'Open'}
                </Link>
              )}
              {item.state === 'error' && (
                <IconButton label={`Remove ${item.name} from the list`} onClick={() => remove(item.id)}>
                  <X size={16} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
