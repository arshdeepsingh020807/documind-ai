import { useEffect, useRef, useState } from 'react'

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

/** Page-wide file drop. Returns whether a file is currently being dragged over the window. */
export function useFileDrop(onFiles: (files: File[]) => void, enabled = true): boolean {
  const [dragging, setDragging] = useState(false)
  // dragenter/leave fire for every child element, so count them to know when the drag truly left.
  const depth = useRef(0)
  const handler = useRef(onFiles)
  useEffect(() => {
    handler.current = onFiles
  })

  useEffect(() => {
    if (!enabled) return
    const reset = () => {
      depth.current = 0
      setDragging(false)
    }
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current++
      setDragging(true)
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const onOver = (e: DragEvent) => {
      // Without this the browser would navigate to the dropped file.
      if (hasFiles(e)) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      reset()
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length) handler.current(files)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
      reset()
    }
  }, [enabled])

  return dragging
}
