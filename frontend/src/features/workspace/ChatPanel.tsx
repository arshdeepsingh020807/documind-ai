import { Hash, ListChecks, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DocumentSummary } from '../../api/types'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FileIcon } from '../../components/FileIcon'
import { LogoMark } from '../../components/Logo'
import type { ChatMessage } from '../../lib/chatHistory'
import { formatBytes, pluralize } from '../../lib/format'
import { Composer } from './Composer'
import { MessageItem } from './MessageItem'

const STARTERS: { icon: ReactNode; text: string }[] = [
  { icon: <Sparkles size={16} />, text: 'Summarize this document in a few sentences.' },
  { icon: <ListChecks size={16} />, text: 'What are the key points?' },
  { icon: <Hash size={16} />, text: 'List any important names, dates or numbers.' },
]

interface ChatPanelProps {
  doc: DocumentSummary
  messages: ChatMessage[]
  pending: boolean
  selectedId: string | null
  onSend: (question: string) => boolean
  onStop: () => void
  onRetry: (message: ChatMessage) => void
  onClear: () => void
  onShowSources: (message: ChatMessage) => void
  onCite: (message: ChatMessage, number: number) => void
}

export function ChatPanel({ doc, messages, pending, selectedId, onSend, onStop, onRetry, onClear, onShowSources, onCite }: ChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    endRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'end' })
  }, [messages, pending])

  return (
    <section className="chat" aria-label={`Conversation about ${doc.filename}`}>
      <div className="chat__scroll">
        <div className="chat__inner">
          {messages.length === 0 && !pending ? (
            <div className="chat__empty">
              <FileIcon type={doc.file_type} size="lg" />
              <h2 className="chat__empty-title">Ask anything about this document</h2>
              <p className="chat__empty-meta">
                {doc.pages ? `${pluralize(doc.pages, 'page')} · ` : ''}{formatBytes(doc.file_size)}
              </p>
              <p className="state__text">Answers come only from its text. Each claim links to the passage it came from, so you can check it.</p>
              <ul className="starters" aria-label="Suggested questions">
                {STARTERS.map((q) => (
                  <li key={q.text}>
                    <button type="button" className="starter" onClick={() => onSend(q.text)}>
                      <span className="starter__icon" aria-hidden>{q.icon}</span>
                      {q.text}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="chat__log" role="log" aria-live="polite" aria-relevant="additions">
              {messages.map((m) => (
                <MessageItem key={m.id} message={m} selected={m.id === selectedId} onShowSources={onShowSources} onCite={onCite} onRetry={onRetry} retryDisabled={pending} />
              ))}
              {pending && (
                <article className="msg msg--assistant" aria-label="DocuMind is answering">
                  <span className="msg__avatar"><LogoMark size={26} /></span>
                  <div className="msg__body">
                    <p className="msg__role">DocuMind</p>
                    <div className="thinking" role="status">
                      <span className="sr-only">Searching the document</span>
                      <span className="thinking__label" aria-hidden>Searching the document<span className="thinking__dots"><i /><i /><i /></span></span>
                      <span className="skel-lines" aria-hidden><i /><i /><i /></span>
                    </div>
                  </div>
                </article>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <div className="chat__footer">
        <div className="chat__inner">
          {messages.length > 0 && (
            <div className="chat__tools">
              <Button size="sm" variant="quiet" icon={<Trash2 size={14} />} onClick={() => setConfirmClear(true)}>Clear conversation</Button>
            </div>
          )}
          <Composer pending={pending} onSend={onSend} onStop={onStop} />
        </div>
      </div>
      <ConfirmDialog
        open={confirmClear}
        title="Clear this conversation?"
        description="The questions and answers for this document will be removed from this browser."
        confirmLabel="Clear"
        danger
        onConfirm={() => { onClear(); setConfirmClear(false) }}
        onCancel={() => setConfirmClear(false)}
      />
    </section>
  )
}
