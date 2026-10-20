// All landing-page copy lives here. It describes only what the app really does.

export const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#faq', label: 'FAQ' },
]

export const STEPS = [
  { title: 'Upload', text: 'Drop in a PDF, Word, text or Markdown file, up to 25 MB. No account needed.' },
  { title: 'Process', text: 'DocuMind reads the text, splits it into passages and builds a search index. It happens once per document and usually takes seconds.' },
  { title: 'Ask and verify', text: 'Ask in plain language. Each answer carries numbered citations that open the exact passage, so you can check it yourself.' },
]

export const FEATURES = [
  { id: 'cited', title: 'Every claim, one click from its source', text: 'A numbered chip sits beside each claim. Click it and the matching passage lights up, with a match score showing how closely it fits your question.' },
  { id: 'page', title: 'See the page, not just the paragraph', text: 'For PDFs, DocuMind shows the cited page with the passage highlighted, and tells you which page it is on.' },
  { id: 'library', title: 'A library that stays out of your way', text: 'Search, sort and filter your documents. Download the original or delete a document and its index in one step. Status badges show what is ready to chat.' },
  { id: 'anywhere', title: 'Comfortable on any screen', text: 'Light and dark themes, a phone layout with slide-out panels, keyboard shortcuts and screen-reader labels throughout.' },
]

export const EXAMPLES = [
  { who: 'Studying', questions: ['Summarise this chapter in five bullet points.', 'What does the author mean by “opportunity cost”?', 'List every date mentioned.'] },
  { who: 'Research', questions: ['What sample size did the study use?', 'Which limitations do the authors acknowledge?', 'How were the results measured?'] },
  { who: 'Work', questions: ['What are the payment terms?', 'What is the notice period for cancelling?', 'Who owns each action item?'] },
]

export const GOOD_TO_KNOW = [
  { title: 'One document at a time', text: 'Questions search the document you have open, not your whole library.' },
  { title: 'No scanned PDFs', text: 'A scan is a picture of text, not text. Those files fail with a clear message instead of guessing.' },
  { title: 'No accounts, shared library', text: 'Everyone who uses this site sees the same documents. Do not upload anything sensitive.' },
  { title: 'Your text goes to an AI provider', text: 'To build the index and write answers, the document’s text is sent to the AI provider the site is set up with.' },
  { title: 'Answers can be wrong', text: 'That is why sources are shown. Check anything important against the highlighted passage.' },
  { title: 'Each question stands alone', text: 'The assistant does not remember earlier questions. Your conversation is saved in your browser for reference.' },
]

export const FAQ = [
  { q: 'What can I upload?', a: 'PDF, DOCX, TXT and Markdown files, up to 25 MB each. Questions can be up to 2,000 characters.' },
  { q: 'Why does a document need processing?', a: 'Processing reads the text, cuts it into passages and indexes them so the right ones can be found for each question. It runs once per document; large files take longer.' },
  { q: 'How do I know an answer is right?', a: 'You do not have to take its word for it. Each claim links to the passage it came from, and for PDFs you can see the page with that passage highlighted. The model can still misread a passage, so check what matters.' },
  { q: 'What does “% match” mean?', a: 'How closely a passage resembles your question, not whether the answer is correct. A high match means the passage is relevant.' },
  { q: 'What happens if a PDF is a scan?', a: 'DocuMind cannot read text that is only a picture, so processing fails with a message saying so. Use a version that has selectable text.' },
  { q: 'Does it remember what I asked before?', a: 'No. Each question is answered on its own from the document. Your questions and answers are kept in this browser so you can look back at them, and you can clear them anytime.' },
  { q: 'Who built this?', a: 'DocuMind is a student project built with FastAPI, React and FAISS. The source is on GitHub.' },
]

export const REPO_URL = 'https://github.com/arshdeepsingh020807/documind-ai'
export const SAMPLE_URL = '/samples/glacier-field-notes.pdf'
