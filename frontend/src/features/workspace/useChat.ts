import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../../api/client'
import { clearHistory, loadHistory, saveHistory, type ChatMessage } from '../../lib/chatHistory'
import { uid } from '../../lib/id'

export function useChat(documentId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory(documentId))
  const [pending, setPending] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  // True when we abort for our own reasons (clearing, leaving the page) rather than because the user pressed Stop.
  const silentAbort = useRef(false)

  useEffect(() => {
    saveHistory(documentId, messages)
  }, [documentId, messages])

  useEffect(() => () => {
    silentAbort.current = true
    controller.current?.abort()
  }, [])

  const run = useCallback(async (question: string) => {
    inFlight.current = true
    silentAbort.current = false
    setPending(true)
    const abort = (controller.current = new AbortController())
    try {
      const response = await api.chat(documentId, question, abort.signal)
      setMessages((current) => [
        ...current,
        { id: uid(), role: 'assistant', content: response.answer, sources: response.sources },
      ])
    } catch (error) {
      const stopped = error instanceof ApiError && error.kind === 'aborted'
      if (stopped && silentAbort.current) return
      const message = stopped ? 'Stopped before an answer arrived.' : (error as Error).message
      setMessages((current) => [
        ...current,
        { id: uid(), role: 'assistant', content: '', error: { message, question } },
      ])
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }, [documentId])

  const send = useCallback((raw: string) => {
    const question = raw.trim()
    if (!question || inFlight.current) return false
    setMessages((current) => [...current, { id: uid(), role: 'user', content: question }])
    void run(question)
    return true
  }, [run])

  /** Re-asks a failed question. Its user message is still on screen, so it isn't added again. */
  const retry = useCallback((failed: ChatMessage) => {
    if (inFlight.current || !failed.error) return
    setMessages((current) => current.filter((m) => m.id !== failed.id))
    void run(failed.error.question)
  }, [run])

  const stop = useCallback(() => controller.current?.abort(), [])

  const clear = useCallback(() => {
    silentAbort.current = true
    controller.current?.abort()
    clearHistory(documentId)
    setMessages([])
  }, [documentId])

  return { messages, pending, send, retry, stop, clear }
}
