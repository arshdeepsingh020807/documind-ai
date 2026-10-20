import { BookOpen, ChevronLeft, Download, PanelLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../../api/client'
import { useDocument, useDocuments, useProcessDocument, useProcessingIds } from '../../api/hooks'
import type { DocumentSummary } from '../../api/types'
import { AppHeader } from '../../components/AppHeader'
import { IconButton } from '../../components/Button'
import { EmptyState, ErrorState } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import type { ChatMessage } from '../../lib/chatHistory'
import { isReady } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { ChatPanel } from './ChatPanel'
import { DocumentRail } from './DocumentRail'
import { ProcessPrompt } from './ProcessPrompt'
import { SourcesPanel, type Highlight } from './SourcesPanel'
import { useChat } from './useChat'

export function WorkspacePage() {
  const { id = '' } = useParams()
  const documentQuery = useDocument(id)
  useDocumentTitle(documentQuery.data?.filename ?? '')

  if (documentQuery.isPending) {
    return (
      <>
        <AppHeader />
        <main id="main" className="page page--narrow"><div className="skeleton-list" aria-busy="true" aria-label="Loading document"><div className="skeleton skeleton--row" /><div className="skeleton skeleton--row" /></div></main>
      </>
    )
  }

  if (documentQuery.isError) {
    const notFound = documentQuery.error instanceof ApiError && documentQuery.error.status === 404
    return (
      <>
        <AppHeader />
        <main id="main" className="page page--narrow">
          {notFound ? (
            <EmptyState level={1} title="Document not found" action={<Link to="/library" className="btn btn--primary btn--md">Back to library</Link>}>
              It may have been deleted, or the link is wrong.
            </EmptyState>
          ) : (
            <ErrorState level={1} title="Couldn't load this document" message={documentQuery.error.message} onRetry={() => void documentQuery.refetch()} retrying={documentQuery.isFetching} />
          )}
        </main>
      </>
    )
  }

  // Keyed so switching documents starts with that document's own conversation.
  return <Workspace key={documentQuery.data.id} doc={documentQuery.data} />
}

function Workspace({ doc }: { doc: DocumentSummary }) {
  const documentsQuery = useDocuments()
  const processMutation = useProcessDocument()
  const processingIds = useProcessingIds()
  const chat = useChat(doc.id)

  const [railOpen, setRailOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<Highlight | null>(null)

  const busy = processingIds.has(doc.id) || doc.status === 'processing'
  const ready = isReady(doc) && !busy

  // Sources shown: the answer the user picked, otherwise the latest answer that has any.
  const activeMessage = useMemo(() => {
    const withSources = chat.messages.filter((m) => m.sources?.length)
    return withSources.find((m) => m.id === selectedId) ?? withSources.at(-1) ?? null
  }, [chat.messages, selectedId])

  const showSources = useCallback((message: ChatMessage) => {
    setSelectedId(message.id)
    setSourcesOpen(true)
  }, [])

  const citePassage = useCallback((message: ChatMessage, number: number) => {
    setSelectedId(message.id)
    setHighlight((current) => ({ messageId: message.id, number, token: (current?.token ?? 0) + 1 }))
    setSourcesOpen(true)
  }, [])

  const closeDrawers = useCallback(() => {
    setRailOpen(false)
    setSourcesOpen(false)
  }, [])

  useEffect(() => {
    if (!railOpen && !sourcesOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawers()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [railOpen, sourcesOpen, closeDrawers])

  return (
    <div className="workspace-shell">
      <AppHeader>
        <div className="doc-bar">
          <Link to="/library" className="crumb"><ChevronLeft size={16} aria-hidden /> Library</Link>
          <h1 className="doc-bar__title" title={doc.filename}>{doc.filename}</h1>
          <StatusBadge status={doc.status} busy={busy} />
          <span className="doc-bar__spacer" />
          <a className="icon-btn icon-btn--default doc-bar__download" href={api.fileUrl(doc.id)} download={doc.filename} aria-label="Download original file" title="Download original file">
            <Download size={18} />
          </a>
          <IconButton label="Show documents" className="only-compact" aria-expanded={railOpen} onClick={() => { setSourcesOpen(false); setRailOpen(!railOpen) }}>
            <PanelLeft size={18} />
          </IconButton>
          <IconButton label="Show sources" className="only-narrow" aria-expanded={sourcesOpen} onClick={() => { setRailOpen(false); setSourcesOpen(!sourcesOpen) }}>
            <BookOpen size={18} />
          </IconButton>
        </div>
      </AppHeader>

      <main id="main" className="workspace" data-rail={railOpen} data-sources={sourcesOpen}>
        <DocumentRail documents={documentsQuery.data} loading={documentsQuery.isPending} onNavigate={closeDrawers} />

        {ready ? (
          <ChatPanel
            doc={doc}
            messages={chat.messages}
            pending={chat.pending}
            selectedId={activeMessage?.id ?? null}
            onSend={chat.send}
            onStop={chat.stop}
            onRetry={chat.retry}
            onClear={() => { chat.clear(); setSelectedId(null); setHighlight(null) }}
            onShowSources={showSources}
            onCite={citePassage}
          />
        ) : (
          <section className="chat chat--center" aria-label="Document status">
            <ProcessPrompt doc={doc} busy={busy} onProcess={() => processMutation.mutate(doc)} />
          </section>
        )}

        <aside className="side-wrap" aria-label="Sources and document details">
          <SourcesPanel doc={doc} message={activeMessage} highlight={highlight} onClose={() => setSourcesOpen(false)} />
        </aside>

        <div className="scrim" onClick={closeDrawers} aria-hidden />
      </main>
    </div>
  )
}
