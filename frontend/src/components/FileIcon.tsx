import type { DocumentType } from '../api/types'

/** A page with a folded corner, labelled with the file type. Purely decorative: the file name is always next to it. */
export function FileIcon({ type, size = 'md' }: { type: DocumentType; size?: 'md' | 'lg' }) {
  return (
    <span className={`file-icon file-icon--${size}`} aria-hidden>
      <span className="file-icon__ext">{type}</span>
    </span>
  )
}
