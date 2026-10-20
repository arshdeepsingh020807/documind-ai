import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  wide?: boolean
  /** Extra-wide, for content such as an enlarged page image. */
  xl?: boolean
  /** When false, Esc and backdrop clicks are ignored (e.g. while a request is in flight). */
  dismissible?: boolean
}

/** Built on the native <dialog>, which supplies the focus trap, Esc handling and inert background. */
export function Dialog({ open, onClose, title, description, children, footer, wide = false, xl = false, dismissible = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog--wide' : ''} ${xl ? 'dialog--xl' : ''}`.trim()}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault()
      }}
      onClose={onClose}
      onClick={(event) => {
        if (dismissible && event.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="dialog__panel">
          <div className="dialog__header">
            <h2 id={titleId} className="dialog__title">{title}</h2>
            <IconButton label="Close dialog" onClick={onClose} disabled={!dismissible}>
              <X size={18} />
            </IconButton>
          </div>
          {description && <p id={descId} className="dialog__description">{description}</p>}
          {children && (
            // An extra-wide body can scroll, so keyboard users must be able to focus it to scroll it.
            <div className="dialog__body" {...(xl ? { tabIndex: 0, role: 'region', 'aria-label': title } : {})}>{children}</div>
          )}
          {footer && <div className="dialog__footer">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
