import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { HelpButton } from './HelpDialog'
import { LogoMark } from './Logo'
import { ThemeToggle } from './ThemeToggle'

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="app-header">
      <Link to="/" className="brand" aria-label="DocuMind, go to the home page">
        <LogoMark />
        <span className="brand__name">DocuMind</span>
      </Link>
      <div className="app-header__slot">{children}</div>
      <HelpButton />
      <ThemeToggle />
    </header>
  )
}
