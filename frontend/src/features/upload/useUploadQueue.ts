import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadDocument } from '../../api/client'
import { documentsKey, useProcessDocument } from '../../api/hooks'
import { validateFile } from '../../lib/files'
import { uid } from '../../lib/id'

export type ItemState = 'uploading' | 'processing' | 'done' | 'error'

export interface QueueItem {
  id: string
  name: string
  size: number
  state: ItemState
  progress: number
  message?: string
  /** Set once the file is on the server, so a finished row can link to its chat. */
  documentId?: string
  ready?: boolean
}

/** Uploads files one at a time, optionally processing each as soon as it lands. */
export function useUploadQueue() {
  const queryClient = useQueryClient()
  const { mutateAsync: processDocument } = useProcessDocument({ notify: false })
  const [items, setItems] = useState<QueueItem[]>([])
  const [autoProcess, setAutoProcess] = useState(true)

  const autoProcessRef = useRef(autoProcess)
  useEffect(() => {
    autoProcessRef.current = autoProcess
  })
  const waiting = useRef<{ id: string; file: File }[]>([])
  const running = useRef(false)
  const abort = useRef(new AbortController())

  // Cancel in-flight uploads when the page goes away.
  useEffect(() => {
    const controller = (abort.current = new AbortController())
    return () => controller.abort()
  }, [])

  const patch = useCallback((id: string, changes: Partial<QueueItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)))
  }, [])

  const handleOne = useCallback(async (id: string, file: File) => {
    try {
      const uploaded = await uploadDocument(file, {
        signal: abort.current.signal,
        onProgress: (progress) => patch(id, { progress }),
      })
      void queryClient.invalidateQueries({ queryKey: documentsKey })
      patch(id, { documentId: uploaded.document_id })
      if (!autoProcessRef.current) {
        patch(id, { state: 'done', progress: 1, message: 'Uploaded. Process it when you’re ready.' })
        return
      }
      patch(id, { state: 'processing', progress: 1 })
      try {
        await processDocument({ id: uploaded.document_id, filename: uploaded.filename })
        patch(id, { state: 'done', ready: true, message: 'Ready to chat.' })
      } catch (error) {
        patch(id, { state: 'error', message: `Uploaded, but processing failed. ${(error as Error).message}` })
      }
    } catch (error) {
      patch(id, { state: 'error', message: (error as Error).message })
    }
  }, [patch, processDocument, queryClient])

  const drain = useCallback(async () => {
    if (running.current) return
    running.current = true
    while (waiting.current.length) {
      const next = waiting.current.shift()
      if (next) await handleOne(next.id, next.file)
    }
    running.current = false
  }, [handleOne])

  const addFiles = useCallback((files: File[]) => {
    const added: QueueItem[] = []
    for (const file of files) {
      const id = uid()
      const problem = validateFile(file)
      added.push({
        id, name: file.name, size: file.size, progress: 0,
        state: problem ? 'error' : 'uploading',
        message: problem ?? undefined,
      })
      if (!problem) waiting.current.push({ id, file })
    }
    setItems((current) => [...current, ...added])
    void drain()
  }, [drain])

  const remove = useCallback((id: string) => setItems((current) => current.filter((i) => i.id !== id)), [])
  const reset = useCallback(() => setItems([]), [])
  const busy = items.some((i) => i.state === 'uploading' || i.state === 'processing')

  return { items, busy, autoProcess, setAutoProcess, addFiles, remove, reset }
}

export type UploadQueue = ReturnType<typeof useUploadQueue>
