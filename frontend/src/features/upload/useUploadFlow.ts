import { useCallback, useState } from 'react'
import { useFileDrop } from './useFileDrop'
import { useUploadQueue } from './useUploadQueue'

/** Everything a page needs to accept uploads: the queue, the dialog's open state, and drop-anywhere. */
export function useUploadFlow() {
  const queue = useUploadQueue()
  const [open, setOpen] = useState(false)
  const { addFiles } = queue
  const addAndOpen = useCallback((files: File[]) => {
    addFiles(files)
    setOpen(true)
  }, [addFiles])
  const dragging = useFileDrop(addAndOpen)
  return { queue, open, setOpen, addAndOpen, dragging }
}

export type UploadFlow = ReturnType<typeof useUploadFlow>
