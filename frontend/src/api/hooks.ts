import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { api, ApiError } from './client'
import type { DocumentSummary } from './types'

export const documentsKey = ['documents'] as const
export const documentKey = (id: string) => ['document', id] as const

// Retry transient failures only: never client errors, which would just fail again.
const retryTransient = (failureCount: number, error: Error) =>
  failureCount < 2 && error instanceof ApiError && (error.kind === 'network' || (error.status ?? 0) >= 500)

export function useDocuments() {
  return useQuery({
    queryKey: documentsKey,
    queryFn: ({ signal }) => api.listDocuments(signal),
    retry: retryTransient,
    // Something may be processing from another tab or before a reload: keep watching until it settles.
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === 'processing') ? 2000 : false,
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKey(id),
    queryFn: ({ signal }) => api.getDocument(id, signal),
    retry: retryTransient,
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 2000 : false),
  })
}

/** `notify: false` for callers that already report the outcome themselves (the upload dialog). */
export function useProcessDocument({ notify = true }: { notify?: boolean } = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationKey: ['process'],
    mutationFn: (doc: Pick<DocumentSummary, 'id' | 'filename'>) => api.processDocument(doc.id),
    onSuccess: (_data, doc) => {
      if (notify) toast.success(`“${doc.filename}” is ready. Ask it anything.`)
    },
    onError: (error, doc) => {
      if (notify) toast.error(`Couldn't process “${doc.filename}”. ${error.message}`)
    },
    onSettled: (_data, _error, doc) => {
      void queryClient.invalidateQueries({ queryKey: documentsKey })
      void queryClient.invalidateQueries({ queryKey: documentKey(doc.id) })
    },
  })
}

/** Ids currently being processed by this tab, across every screen. */
export function useProcessingIds(): Set<string> {
  const ids = useMutationState({
    filters: { mutationKey: ['process'], status: 'pending' },
    select: (mutation) => (mutation.state.variables as { id: string }).id,
  })
  return new Set(ids)
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (doc: Pick<DocumentSummary, 'id' | 'filename'>) => api.deleteDocument(doc.id),
    onSuccess: (_data, doc) => {
      toast.success(`Deleted “${doc.filename}”.`)
      queryClient.removeQueries({ queryKey: documentKey(doc.id) })
      void queryClient.invalidateQueries({ queryKey: documentsKey })
    },
    onError: (error, doc) => toast.error(`Couldn't delete “${doc.filename}”. ${error.message}`),
  })
}
