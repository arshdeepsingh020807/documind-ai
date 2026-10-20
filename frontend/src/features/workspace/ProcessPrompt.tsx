import { Cpu } from 'lucide-react'
import type { DocumentSummary } from '../../api/types'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'

interface ProcessPromptProps {
  doc: DocumentSummary
  busy: boolean
  onProcess: () => void
}

/** Shown in place of the chat until the document has been indexed. */
export function ProcessPrompt({ doc, busy, onProcess }: ProcessPromptProps) {
  if (busy) {
    return (
      <div className="state" role="status">
        <Spinner />
        <h2 className="state__title">Reading “{doc.filename}”</h2>
        <p className="state__text">Extracting the text and building the search index. Large documents can take a minute.</p>
      </div>
    )
  }
  const failed = doc.status === 'failed'
  return (
    <div className={`state ${failed ? 'state--error' : ''}`}>
      <Cpu size={28} aria-hidden />
      <h2 className="state__title">{failed ? 'Processing failed' : 'This document isn’t processed yet'}</h2>
      <p className="state__text">
        {failed
          ? doc.error ?? 'Something went wrong while reading the document.'
          : 'DocuMind needs to read and index it once before you can ask questions.'}
      </p>
      <div className="state__action">
        <Button variant="primary" onClick={onProcess}>{failed ? 'Try again' : 'Process document'}</Button>
      </div>
    </div>
  )
}
