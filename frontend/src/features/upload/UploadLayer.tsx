import { Upload } from 'lucide-react'
import { UploadDialog } from './UploadDialog'
import type { UploadFlow } from './useUploadFlow'

/** The dialog plus the full-page "drop to upload" overlay, for any page that uses useUploadFlow. */
export function UploadLayer({ flow }: { flow: UploadFlow }) {
  return (
    <>
      {flow.dragging && (
        <div className="drop-overlay" aria-hidden>
          <div className="drop-overlay__card">
            <Upload size={32} />
            <p>Drop to upload</p>
          </div>
        </div>
      )}
      <UploadDialog open={flow.open} onClose={() => flow.setOpen(false)} queue={flow.queue} />
    </>
  )
}
