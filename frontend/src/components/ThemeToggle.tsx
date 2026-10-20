import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from '../lib/theme'
import { IconButton } from './Button'

const LABEL: Record<Theme, string> = { system: 'Theme: match system', light: 'Theme: light', dark: 'Theme: dark' }

export function ThemeToggle() {
  const { theme, cycle } = useTheme()
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  return (
    <IconButton label={`${LABEL[theme]}. Click to change.`} onClick={cycle}>
      <Icon size={18} />
    </IconButton>
  )
}
