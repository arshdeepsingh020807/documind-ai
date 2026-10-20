import { FileSearch } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../api/client'
import type { ChatSource, DocumentSummary } from '../../api/types'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'

const MAX_PAGE_TABS = 4

interface PagePreviewProps {
  doc: DocumentSummary
  source: ChatSource
  /** Open straight away, e.g. because the user just clicked this passage's citation. */
  startOpen: boolean
}

/** The cited PDF page as an image with the passage highlighted (rendered by the server). */
export function PagePreview({ doc, source, startOpen }: PagePreviewProps) {
  const first = source.page_start ?? 1
  const last = Math.min(source.page_end ?? first, first + MAX_PAGE_TABS - 1)
  const pages = Array.from({ length: last - first + 1 }, (_, i) => first + i)

  const [open, setOpen] = useState(startOpen)
  const [page, setPage] = useState(first)
  const [failedPage, setFailedPage] = useState<number | null>(null)
  const [enlarged, setEnlarged] = useState(false)

  const src = api.previewUrl(doc.id, source.chunk_index, page)
  const alt = `Page ${page} of ${doc.filename}, with the cited passage highlighted`

  return (
    <div className="preview">
      <Button size="sm" variant="quiet" icon={<FileSearch size={14} />} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide page' : 'Show page'}
      </Button>
      {open && (
        <>
          {pages.length > 1 && (
            <div className="preview__tabs" role="group" aria-label="Pages this passage spans">
              {pages.map((p) => (
                <button key={p} type="button" aria-pressed={p === page} onClick={() => setPage(p)}>Page {p}</button>
              ))}
            </div>
          )}
          {failedPage === page ? (
            <p className="preview__note">The page preview isn’t available right now. The passage text above is unaffected.</p>
          ) : (
            <button type="button" className="preview__frame" onClick={() => setEnlarged(true)} aria-label={`Enlarge page ${page}`}>
              <img src={src} alt={alt} loading="lazy" onError={() => setFailedPage(page)} />
            </button>
          )}
        </>
      )}
      <Dialog open={enlarged} onClose={() => setEnlarged(false)} title={`Page ${page}`} description={doc.filename} xl>
        <img className="preview__large" src={src} alt={alt} />
      </Dialog>
    </div>
  )
}
