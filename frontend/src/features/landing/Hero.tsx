import { ArrowRight, UploadCloud } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { ACCEPT_ATTRIBUTE } from '../../lib/files'

interface HeroProps {
  onFiles: (files: File[]) => void
  onSample: () => void
  samplePending: boolean
}

export function Hero({ onFiles, onSample, samplePending }: HeroProps) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation() // the page-wide drop handler would otherwise add the files a second time
    setOver(false)
    onFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <section className="hero" aria-labelledby="hero-title">
      <p className="eyebrow">Document Q&A with receipts</p>
      <h1 id="hero-title" className="hero__title">
        Ask your document anything. <em className="mark">See exactly where the answer came from.</em>
      </h1>
      <p className="hero__sub">
        Upload a PDF, Word or text file. DocuMind answers from its text alone, and every claim links to the passage
        behind it, with the page highlighted for PDFs.
      </p>

      <div
        className={`hero-drop ${over ? 'hero-drop--over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <UploadCloud size={30} aria-hidden />
        <p className="hero-drop__title">Drop a document here</p>
        <div className="hero-drop__actions">
          <Button variant="primary" onClick={() => input.current?.click()}>Choose a file</Button>
          <Button onClick={onSample} loading={samplePending}>Try a sample document</Button>
        </div>
        <input ref={input} type="file" multiple accept={ACCEPT_ATTRIBUTE} onChange={onPick} className="sr-only" tabIndex={-1} aria-label="Choose files to upload" />
        <p className="hero-drop__fine">PDF, DOCX, TXT or MD · up to 25 MB · no account</p>
      </div>

      <Link to="/library" className="hero__link">Already have documents? Open your library <ArrowRight size={16} aria-hidden /></Link>
    </section>
  )
}
