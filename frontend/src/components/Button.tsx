import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'sm'
  /** Shows a spinner and blocks clicks while keeping the button's width stable. */
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls need an accessible name. It doubles as the tooltip. */
  label: string
  tone?: 'default' | 'danger'
  children: ReactNode
}

export function IconButton({ label, tone = 'default', className = '', children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} className={`icon-btn icon-btn--${tone} ${className}`.trim()} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}
