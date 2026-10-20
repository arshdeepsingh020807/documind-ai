import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { useToast } from '../../components/Toast'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { UploadLayer } from '../upload/UploadLayer'
import { useUploadFlow } from '../upload/useUploadFlow'
import { NAV, SAMPLE_URL } from './content'
import { Features } from './Features'
import { Hero } from './Hero'
import { LiveDemo } from './LiveDemo'
import { Closing, Examples, Faq, Footer, GoodToKnow, Steps } from './Sections'

export function LandingPage() {
  useDocumentTitle('')
  const upload = useUploadFlow()
  const toast = useToast()
  const [samplePending, setSamplePending] = useState(false)

  // The sample is an ordinary PDF served with the site; it goes through the same upload path as any file.
  const trySample = async () => {
    setSamplePending(true)
    try {
      const response = await fetch(SAMPLE_URL)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      upload.addAndOpen([new File([blob], 'glacier-field-notes.pdf', { type: 'application/pdf' })])
    } catch {
      toast.error('Couldn’t load the sample document. Check your connection and try again.')
    } finally {
      setSamplePending(false)
    }
  }

  return (
    <>
      <AppHeader>
        <div className="landing-nav">
          <nav aria-label="Page sections">
            {NAV.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
          </nav>
          <Link to="/library" className="btn btn--secondary btn--sm">Open app</Link>
        </div>
      </AppHeader>

      <main id="main" className="landing">
        <Hero onFiles={upload.addAndOpen} onSample={() => void trySample()} samplePending={samplePending} />
        <section className="section section--demo" aria-label="Example conversation">
          <LiveDemo />
        </section>
        <Steps />
        <Features />
        <Examples />
        <GoodToKnow />
        <Faq />
        <Closing onUpload={() => upload.setOpen(true)} />
      </main>
      <Footer />
      <UploadLayer flow={upload} />
    </>
  )
}
