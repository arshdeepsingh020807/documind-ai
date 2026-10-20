import type { ReactNode } from 'react'
import { FileIcon } from '../../components/FileIcon'
import { StatusBadge } from '../../components/StatusBadge'
import { FEATURES } from './content'
import { Reveal } from './Reveal'

// Each illustration is assembled from the app's real components and styles, so it can't drift from the product.
const SNIPPETS: Record<string, ReactNode> = {
  cited: (
    <>
      <div className="msg__answer">
        <p>The ice cap thinned by 1.8 metres a year <span className="cite">1</span> and the southern margin by 2.6 <span className="cite">2</span>.</p>
      </div>
      <div className="passage passage--active">
        <div className="passage__head"><span className="passage__label"><span className="passage__num">1</span>Page 2</span><span className="passage__match">86% match</span></div>
        <p className="passage__text">Between 2019 and 2024 the ice cap thinned by an average of 1.8 metres per year.</p>
      </div>
    </>
  ),
  page: (
    <div className="mini-page">
      <span className="mini-page__label">Page 2</span>
      <i style={{ width: '46%' }} /><i /><i className="mini-page__hl" /><i className="mini-page__hl" style={{ width: '70%' }} /><i /><i style={{ width: '58%' }} />
    </div>
  ),
  library: (
    <ul className="mini-rows">
      {[['field-notes.pdf', 'pdf', 'processed'], ['contract.docx', 'docx', 'processing'], ['reading-list.md', 'md', 'uploaded']].map(([name, type, status]) => (
        <li key={name}>
          <FileIcon type={type as 'pdf' | 'docx' | 'md'} />
          <span>{name}</span>
          <StatusBadge status={status as 'processed' | 'processing' | 'uploaded'} />
        </li>
      ))}
    </ul>
  ),
  anywhere: (
    <div className="swatches">
      <div className="swatch swatch--light"><b>Aa</b><span>Light</span></div>
      <div className="swatch swatch--dark"><b>Aa</b><span>Dark</span></div>
      <div className="swatch swatch--phone"><i /><i /><i /></div>
    </div>
  ),
}

export function Features() {
  return (
    <section className="section" id="features" aria-labelledby="features-title">
      <Reveal>
        <p className="eyebrow">Features</p>
        <h2 id="features-title" className="section__title">Built around checking the answer</h2>
      </Reveal>
      <div className="features">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.id} className={`feature ${i % 2 ? 'feature--flip' : ''}`}>
            <div className="feature__copy">
              <h3 className="feature__title">{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
            <div className="feature__art" aria-hidden>{SNIPPETS[feature.id]}</div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
