import { Button } from './Button'
import { Dialog } from './Dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, description, confirmLabel, danger = false, pending = false, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      dismissible={!pending}
      footer={
        <>
          <Button variant="quiet" onClick={onCancel} disabled={pending}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={pending} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
