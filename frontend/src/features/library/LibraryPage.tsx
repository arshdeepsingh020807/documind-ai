import { Search, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { useDeleteDocument, useDocuments, useProcessDocument, useProcessingIds } from '../../api/hooks'
import type { DocumentSummary } from '../../api/types'
import { AppHeader } from '../../components/AppHeader'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState, ErrorState } from '../../components/States'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { DocumentTable } from './DocumentTable'
import { EmptyLibrary } from './EmptyLibrary'
import { LibraryStats } from './LibraryStats'
import {
  applyView, DEFAULT_VIEW, isViewActive, SORT_OPTIONS, STATUS_OPTIONS,
  type LibraryView, type SortKey, type StatusFilter,
} from './libraryView'
import { UploadLayer } from '../upload/UploadLayer'
import { useUploadFlow } from '../upload/useUploadFlow'

export function LibraryPage() {
  useDocumentTitle('Library')
  const documentsQuery = useDocuments()
  const processMutation = useProcessDocument()
  const deleteMutation = useDeleteDocument()
  const processingIds = useProcessingIds()

  const [view, setView] = useState<LibraryView>(DEFAULT_VIEW)
  const upload = useUploadFlow()
  const [toDelete, setToDelete] = useState<DocumentSummary | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const documents = documentsQuery.data
  const visible = useMemo(() => (documents ? applyView(documents, view) : []), [documents, view])

  const confirmDelete = () => {
    if (!toDelete) return
    deleteMutation.mutate(toDelete, { onSettled: () => setToDelete(null) })
  }

  const openUpload = () => upload.setOpen(true)

  // "/" jumps to search, as on most sites with a search box, unless the user is already typing somewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable], dialog[open]')) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <AppHeader />
      <main id="main" className="page">
        <div className="page__head">
          <div>
            <h1 className="page__title">Library</h1>
            <p className="page__sub">Documents you’ve added. Open one to ask it questions.</p>
          </div>
          <Button variant="primary" icon={<Upload size={18} />} onClick={openUpload}>Upload documents</Button>
        </div>

        {documents && documents.length > 0 && <LibraryStats documents={documents} />}

        {documents && documents.length > 0 && (
          <div className="toolbar" role="search">
            <div className="field field--search">
              <Search size={16} aria-hidden />
              <input
                ref={searchRef}
                type="search"
                className="input"
                placeholder="Search by file name"
                aria-label="Search documents by file name"
                aria-keyshortcuts="/"
                value={view.query}
                onChange={(e) => setView({ ...view, query: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return
                  if (view.query) setView({ ...view, query: '' })
                  else e.currentTarget.blur()
                }}
              />
              <kbd className="field__kbd" aria-hidden>/</kbd>
            </div>
            <select className="select" aria-label="Filter by status" value={view.status} onChange={(e) => setView({ ...view, status: e.target.value as StatusFilter })}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="select" aria-label="Sort documents" value={view.sort} onChange={(e) => setView({ ...view, sort: e.target.value as SortKey })}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {documentsQuery.isPending && <LibrarySkeleton />}

        {documentsQuery.isError && (
          <ErrorState
            title="Couldn't load your library"
            message={documentsQuery.error instanceof ApiError ? documentsQuery.error.message : 'Something went wrong.'}
            onRetry={() => void documentsQuery.refetch()}
            retrying={documentsQuery.isFetching}
          />
        )}

        {documents && documents.length === 0 && <EmptyLibrary onUpload={openUpload} />}

        {documents && documents.length > 0 && visible.length === 0 && (
          <EmptyState
            title="No documents match"
            action={isViewActive(view) ? <Button onClick={() => setView({ ...DEFAULT_VIEW, sort: view.sort })}>Clear filters</Button> : undefined}
          >
            Try a different search or status filter.
          </EmptyState>
        )}

        {visible.length > 0 && (
          <DocumentTable
            documents={visible}
            processingIds={processingIds}
            onProcess={(doc) => processMutation.mutate(doc)}
            onDelete={setToDelete}
          />
        )}
      </main>

      <UploadLayer flow={upload} />

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this document?"
        description={toDelete ? `“${toDelete.filename}” and its search index will be permanently removed. This can’t be undone.` : ''}
        confirmLabel="Delete"
        danger
        pending={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}

function LibrarySkeleton() {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading documents">
      {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton skeleton--row" />)}
    </div>
  )
}
