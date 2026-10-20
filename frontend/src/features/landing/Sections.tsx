import { AlertTriangle, ChevronDown, FileUp, Files, MessageSquare, MessageSquareQuote, ScanLine, ScanText, Send, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EXAMPLES, FAQ, GOOD_TO_KNOW, REPO_URL, STEPS } from './content'
import { Reveal } from './Reveal'

const STEP_ICONS = [FileUp, ScanText, MessageSquareQuote]
const KNOW_ICONS = [Files, ScanLine, Users, Send, AlertTriangle, MessageSquare]

export function Steps() {
  return (
    <section className="section" id="how" aria-labelledby="how-title">
      <Reveal>
        <p className="eyebrow">How it works</p>
        <h2 id="how-title" className="section__title">Three steps, no setup</h2>
      </Reveal>
      <ol className="steps">
        {STEPS.map((step, i) => {
          const Icon = STEP_ICONS[i]!
          return (
            <li key={step.title}>
              <Reveal className="step">
                <span className="step__num" aria-hidden>{i + 1}</span>
                <Icon size={22} aria-hidden />
                <h3 className="step__title">{step.title}</h3>
                <p>{step.text}</p>
              </Reveal>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function Examples() {
  return (
    <section className="section" aria-labelledby="examples-title">
      <Reveal>
        <p className="eyebrow">What to ask</p>
        <h2 id="examples-title" className="section__title">Questions people bring to a document</h2>
      </Reveal>
      <Reveal className="examples">
        {EXAMPLES.map((group) => (
          <div key={group.who} className="examples__group">
            <h3 className="examples__who">{group.who}</h3>
            <ul>{group.questions.map((q) => <li key={q}>{q}</li>)}</ul>
          </div>
        ))}
      </Reveal>
    </section>
  )
}

export function GoodToKnow() {
  return (
    <section className="section" aria-labelledby="know-title">
      <Reveal>
        <p className="eyebrow">Straight talk</p>
        <h2 id="know-title" className="section__title">Good to know before you upload</h2>
      </Reveal>
      <Reveal>
        <ul className="know">
          {GOOD_TO_KNOW.map((item, i) => {
            const Icon = KNOW_ICONS[i]!
            return (
              <li key={item.title}>
                <Icon size={20} aria-hidden />
                <div><h3 className="know__title">{item.title}</h3><p>{item.text}</p></div>
              </li>
            )
          })}
        </ul>
      </Reveal>
    </section>
  )
}

export function Faq() {
  return (
    <section className="section section--narrow" id="faq" aria-labelledby="faq-title">
      <Reveal>
        <p className="eyebrow">FAQ</p>
        <h2 id="faq-title" className="section__title">Questions, answered</h2>
      </Reveal>
      <Reveal className="faq">
        {FAQ.map((item) => (
          <details key={item.q} className="faq__item">
            <summary>{item.q}<ChevronDown size={18} aria-hidden /></summary>
            <p>{item.a}</p>
          </details>
        ))}
      </Reveal>
    </section>
  )
}

export function Closing({ onUpload }: { onUpload: () => void }) {
  return (
    <section className="closing" aria-labelledby="closing-title">
      <h2 id="closing-title" className="closing__title">Try it on your own document</h2>
      <div className="closing__actions">
        <button type="button" className="btn btn--primary btn--md" onClick={onUpload}>Upload a document</button>
        <Link to="/library" className="btn btn--secondary btn--md">Open your library</Link>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <p>DocuMind is a student project built with FastAPI, React and FAISS.</p>
      <a href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub<span className="sr-only"> (opens in a new tab)</span></a>
    </footer>
  )
}
