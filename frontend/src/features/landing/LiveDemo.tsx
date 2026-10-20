import { useEffect, useMemo, useState } from 'react'
import { LogoMark } from '../../components/Logo'
import { renderAnswer } from '../../lib/answer'
import { DEMO_PAGES, DEMO_QUESTIONS, type DemoQuestion } from './demoData'
import { useSeen } from './Reveal'

const WORD_DELAY_MS = 45

// A short line that doesn't end a sentence is a heading on the mock page.
const isHeading = (line: string) => line.length < 32 && !/[.,]$/.test(line)

/** Types the answer out word by word, like a model streaming, once `play` is true. */
function StreamedAnswer({ question, play, onCite }: { question: DemoQuestion; play: boolean; onCite: (n: number) => void }) {
  const words = useMemo(() => question.answer.split(' '), [question])
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [count, setCount] = useState(reduced ? words.length : 0)

  useEffect(() => {
    if (!play || count >= words.length) return
    const timer = setTimeout(() => setCount((c) => c + 1), WORD_DELAY_MS)
    return () => clearTimeout(timer)
  }, [play, count, words.length])

  return (
    <div className="msg__answer" aria-label="Example answer">
      {renderAnswer(words.slice(0, count).join(' '), {
        count: question.passages.length,
        onCite,
        describe: (n) => question.passages[n - 1]?.text ?? '',
      })}
    </div>
  )
}

/** A scripted example (no model runs here) showing the product's central idea: click a citation, see the source. */
export function LiveDemo() {
  const [ref, seen] = useSeen<HTMLDivElement>()
  const [questionId, setQuestionId] = useState(DEMO_QUESTIONS[0]!.id)
  const [cite, setCite] = useState(1)
  const question = DEMO_QUESTIONS.find((q) => q.id === questionId)!
  const passage = question.passages.find((p) => p.number === cite) ?? question.passages[0]!
  const lines = DEMO_PAGES[passage.page] ?? []

  const choose = (id: string) => { setQuestionId(id); setCite(1) }

  return (
    <div className="demo" ref={ref}>
      <div className="demo__bar">
        <span className="demo__tag">Example · scripted, not a live model</span>
        <div className="demo__questions" role="group" aria-label="Choose an example question">
          {DEMO_QUESTIONS.map((q) => (
            <button key={q.id} type="button" className="demo__pill" aria-pressed={q.id === questionId} onClick={() => choose(q.id)}>
              {q.question}
            </button>
          ))}
        </div>
      </div>

      <div className="demo__body">
        <figure className="demo__page" aria-label={`Page ${passage.page} of the sample document, with the cited passage highlighted`}>
          <figcaption>glacier-field-notes.pdf · Page {passage.page}</figcaption>
          {lines.map((line, i) => (
            <p key={i} className={`demo__line ${isHeading(line) ? 'demo__line--head' : ''} ${passage.lines.includes(i) ? 'demo__line--hl' : ''}`}>{line}</p>
          ))}
        </figure>

        <div className="demo__chat" key={question.id}>
          <p className="msg__role">You</p>
          <p className="msg__question">{question.question}</p>
          <div className="demo__reply">
            <span className="msg__avatar"><LogoMark size={26} /></span>
            <div>
              <p className="msg__role">DocuMind</p>
              <StreamedAnswer question={question} play={seen} onCite={setCite} />
              <div className="passage passage--active demo__passage">
                <div className="passage__head">
                  <span className="passage__label"><span className="passage__num">{passage.number}</span>Page {passage.page}</span>
                </div>
                <p className="passage__text">{passage.text}</p>
              </div>
              <p className="demo__hint">Click a numbered chip to see its passage on the page.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
