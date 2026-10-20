import { CircleHelp } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton } from './Button'
import { Dialog } from './Dialog'

const TERMS = [
  ['Processing', 'DocuMind reads the document’s text, cuts it into passages and builds a search index. It happens once per document and usually takes seconds. A document must be processed before you can ask it questions.'],
  ['Numbered citations', 'Each claim in an answer ends with a numbered chip. Click it to open the passage it came from. Chips only point at passages that were actually retrieved.'],
  ['% match', 'How closely a passage resembles your question. It is not a score for whether the answer is right: a high match means the passage is relevant.'],
  ['Page preview', 'For PDFs, the cited page is shown with the passage highlighted. Highlighting is best effort: unusual hyphenation or fonts can leave part of a passage unmarked. Word, text and Markdown files have no fixed pages.'],
  ['Your data', 'There are no accounts, so every document is visible to everyone who uses this site. The text is sent to an AI provider to build the index and write answers. Your conversations are stored only in this browser.'],
]

/** The "?" in the header: a short glossary for the ideas people meet while using the app. */
export function HelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton label="How DocuMind works" onClick={() => setOpen(true)}>
        <CircleHelp size={18} />
      </IconButton>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="How DocuMind works"
        description="Everything on screen, in plain words."
        wide
        footer={<Button variant="primary" onClick={() => setOpen(false)}>Got it</Button>}
      >
        <dl className="glossary">
          {TERMS.map(([term, text]) => (
            <div key={term}><dt>{term}</dt><dd>{text}</dd></div>
          ))}
        </dl>
      </Dialog>
    </>
  )
}
