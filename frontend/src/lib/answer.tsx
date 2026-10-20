import type { ReactNode } from 'react'

// Answers come from a language model and often use light markdown. This renders the common subset
// (paragraphs, bullet/numbered lists, **bold**, `code`, and [n] citations) as React elements.
// Nothing is injected as HTML.

export interface CitationOptions {
  /** Passages available to cite; a [n] outside 1..count is the model's mistake and stays plain text. */
  count: number
  onCite: (number: number) => void
  /** Short description of passage n, used as the chip's tooltip. */
  describe?: (number: number) => string
}

// Matches **bold**, `code`, and citations like [1], [2][3] or [1, 2].
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[\d{1,2}(?:\s*,\s*\d{1,2})*\])/g

function renderInline(text: string, keyPrefix: string, cite?: CitationOptions): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={key}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={key}>{part.slice(1, -1)}</code>
    if (cite && part.startsWith('[') && part.endsWith(']')) {
      const numbers = part.slice(1, -1).split(',').map((n) => Number(n.trim()))
      if (numbers.every((n) => n >= 1 && n <= cite.count)) {
        return numbers.map((n) => (
          <button key={`${key}-${n}`} type="button" className="cite" onClick={() => cite.onCite(n)} title={cite.describe?.(n)} aria-label={`Source ${n}`}>
            {n}
          </button>
        ))
      }
    }
    return part
  })
}

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/

export function renderAnswer(text: string, cite?: CitationOptions): ReactNode {
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    const key = `p${blocks.length}`
    blocks.push(
      <p key={key}>
        {paragraph.flatMap((line, i) => (i ? [<br key={`br${i}`} />, ...renderInline(line, `${key}-${i}`, cite)] : renderInline(line, `${key}-${i}`, cite)))}
      </p>,
    )
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    const key = `l${blocks.length}`
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={key}>
        {list.items.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-${i}`, cite)}</li>
        ))}
      </Tag>,
    )
    list = null
  }

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    const item = bullet ?? numbered
    if (item) {
      flushParagraph()
      const ordered = Boolean(numbered)
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push(item[1] ?? '')
    } else if (!line.trim()) {
      flushParagraph()
      flushList()
    } else {
      flushList()
      paragraph.push(line.trim())
    }
  }
  flushParagraph()
  flushList()
  return blocks
}
