import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { uid } from '../lib/id'

type Tone = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  tone: Tone
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const DURATION: Record<Tone, number> = { success: 5000, info: 5000, error: 9000 }
const MAX_VISIBLE = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const region = useRef<HTMLDivElement>(null)

  // Modal dialogs live in the browser's top layer, which z-index can't beat. A manual popover joins
  // that layer, and re-showing it on each new toast keeps notifications above a dialog opened earlier.
  useEffect(() => {
    const el = region.current
    if (!el || typeof el.showPopover !== 'function') return
    try {
      el.hidePopover()
      if (toasts.length) el.showPopover()
    } catch {
      // Popover unsupported or detached: the toasts still render, just without top-layer promotion.
    }
  }, [toasts])

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const arm = useCallback((id: string, tone: Tone) => {
    clearTimeout(timers.current.get(id))
    timers.current.set(id, setTimeout(() => dismiss(id), DURATION[tone]))
  }, [dismiss])

  const push = useCallback((tone: Tone, message: string) => {
    const id = uid()
    setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, tone, message }])
    arm(id, tone)
  }, [arm])

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div ref={region} popover="manual" className="toasts" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast--${t.tone}`}
            role={t.tone === 'error' ? 'alert' : 'status'}
            // Hovering or focusing a toast keeps it on screen so it can be read.
            onMouseEnter={() => clearTimeout(timers.current.get(t.id))}
            onMouseLeave={() => arm(t.id, t.tone)}
            onFocus={() => clearTimeout(timers.current.get(t.id))}
            onBlur={() => arm(t.id, t.tone)}
          >
            {t.tone === 'success' ? <CheckCircle2 size={18} aria-hidden /> : t.tone === 'error' ? <AlertCircle size={18} aria-hidden /> : <Info size={18} aria-hidden />}
            <p className="toast__message">{t.message}</p>
            <button type="button" className="icon-btn icon-btn--default" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}
