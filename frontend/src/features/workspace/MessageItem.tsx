import { AlertCircle, BookOpen, Check, Copy, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import type { ChatSource } from '../../api/types'
import { LogoMark } from '../../components/Logo'
import type { ChatMessage } from '../../lib/chatHistory'
import { renderAnswer } from '../../lib/answer'
import { pluralize } from '../../lib/format'

interface MessageItemProps {
  message: ChatMessage
  selected: boolean
  onShowSources: (message: ChatMessage) => void
  onCite: (message: ChatMessage, number: number) => void
  onRetry: (message: ChatMessage) => void
  retryDisabled: boolean
}

export function MessageItem({ message, selected, onShowSources, onCite, onRetry, retryDisabled }: MessageItemProps) {
  if (message.role === 'user') {
    return (
      <article className="msg msg--user" aria-label="Your question">
        <p className="msg__role">You</p>
        <p className="msg__question">{message.content}</p>
      </article>
    )
  }

  if (message.error) {
    return (
      <article className="msg msg--assistant" aria-label="Error">
        <div className="msg__error" role="alert">
          <AlertCircle size={18} aria-hidden />
          <div>
            <p className="msg__error-title">Couldn’t get an answer</p>
            <p>{message.error.message}</p>
            <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => onRetry(message)} disabled={retryDisabled}>Try again</Button>
          </div>
        </div>
      </article>
    )
  }

  const sources = message.sources ?? []
  return (
    <article className={`msg msg--assistant ${selected ? 'msg--selected' : ''}`} aria-label="Answer">
      <span className="msg__avatar"><LogoMark size={26} /></span>
      <div className="msg__body">
        <p className="msg__role">DocuMind{selected && sources.length > 0 && <span className="msg__role-note"> · sources shown</span>}</p>
        <div className="msg__answer">
          {renderAnswer(message.content, {
            count: sources.length,
            onCite: (n) => onCite(message, n),
            describe: (n) => describeSource(sources[n - 1]),
          })}
        </div>
        <div className="msg__actions">
          <CopyButton text={message.content} />
          {sources.length > 0 && (
            <Button size="sm" variant="quiet" icon={<BookOpen size={14} />} onClick={() => onShowSources(message)} aria-pressed={selected}>
              {pluralize(sources.length, 'source')}
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

/** Tooltip for a citation chip: where the passage is and how it begins. */
function describeSource(source: ChatSource | undefined): string {
  if (!source) return ''
  const where = source.page_start ? `${pageLabel(source.page_start, source.page_end)} · ` : ''
  const start = source.text.slice(0, 90).trimEnd()
  return `${where}“${start}${source.text.length > 90 ? '…' : ''}”`
}

export function pageLabel(start: number, end: number | null): string {
  return end && end !== start ? `Pages ${start}–${end}` : `Page ${start}`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be unavailable (insecure origin, denied permission); the text is still selectable.
    }
  }

  return (
    <Button size="sm" variant="quiet" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={() => void copy()}>
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </Button>
  )
}
