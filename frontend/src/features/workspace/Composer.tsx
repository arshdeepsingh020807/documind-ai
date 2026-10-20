import { ArrowUp, Square } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

const MAX_LENGTH = 2000
const COUNTER_FROM = 1700

interface ComposerProps {
  pending: boolean
  onSend: (question: string) => boolean
  onStop: () => void
}

export function Composer({ pending, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  // Grow with the content up to the CSS max-height, then scroll.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  const submit = () => {
    if (onSend(value)) setValue('')
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline. Ignore Enter while an IME is composing text.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const canSend = value.trim().length > 0 && !pending
  return (
    <form className="composer" onSubmit={onSubmit}>
      <label htmlFor="composer-input" className="sr-only">Ask a question about this document</label>
      <div className="composer__box">
      <textarea
        id="composer-input"
        ref={ref}
        className="composer__input"
        rows={1}
        maxLength={MAX_LENGTH}
        placeholder="Ask about this document…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {pending ? (
        <button type="button" className="composer__btn composer__btn--stop" onClick={onStop} aria-label="Stop generating">
          <Square size={14} fill="currentColor" />
        </button>
      ) : (
        <button type="submit" className="composer__btn" disabled={!canSend} aria-label="Send question">
          <ArrowUp size={18} />
        </button>
      )}
      </div>
      <p className="composer__hint">
        Enter to send · Shift+Enter for a new line
        {value.length >= COUNTER_FROM && <span className="composer__count" role="status"> · {value.length}/{MAX_LENGTH}</span>}
      </p>
    </form>
  )
}
