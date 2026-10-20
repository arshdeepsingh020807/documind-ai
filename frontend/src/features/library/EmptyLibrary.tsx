import { Upload } from 'lucide-react'
import { Button } from '../../components/Button'

/** First-run state: says what the app does and makes the next step obvious. */
export function EmptyLibrary({ onUpload }: { onUpload: () => void }) {
  return (
    <section className="empty-library" aria-labelledby="empty-title">
      <svg className="empty-library__art" viewBox="0 0 240 160" aria-hidden focusable="false">
        <rect x="52" y="22" width="108" height="130" rx="8" className="art-page art-page--back" />
        <rect x="70" y="12" width="108" height="130" rx="8" className="art-page" />
        <rect x="86" y="32" width="48" height="6" rx="3" className="art-line art-line--strong" />
        <rect x="86" y="50" width="76" height="5" rx="2.5" className="art-line" />
        <rect x="86" y="64" width="76" height="14" rx="3" className="art-mark" />
        <rect x="86" y="68" width="62" height="5" rx="2.5" className="art-line art-line--on-mark" />
        <rect x="86" y="88" width="70" height="5" rx="2.5" className="art-line" />
        <rect x="86" y="102" width="52" height="5" rx="2.5" className="art-line" />
        <g transform="translate(150 96)">
          <rect width="72" height="38" rx="10" className="art-bubble" />
          <path d="M14 38 L8 50 L28 38 Z" className="art-bubble" />
          <rect x="12" y="11" width="34" height="5" rx="2.5" className="art-bubble-line" />
          <rect x="12" y="21" width="22" height="5" rx="2.5" className="art-bubble-line" />
          <rect x="50" y="9" width="14" height="14" rx="4" className="art-cite" />
        </g>
      </svg>
      <h2 id="empty-title" className="empty-library__title">Ask your documents questions</h2>
      <p className="empty-library__text">
        Add a PDF, Word file or text document. DocuMind reads it once, then answers from its text and shows the
        passage behind every answer, so you can check it yourself.
      </p>
      <Button variant="primary" icon={<Upload size={18} />} onClick={onUpload}>Upload your first document</Button>
      <p className="empty-library__hint">or drop a file anywhere on this page · PDF, DOCX, TXT, MD · up to 25 MB</p>
    </section>
  )
}
