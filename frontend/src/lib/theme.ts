import { useCallback, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'documind:theme'
const ORDER: Theme[] = ['system', 'light', 'dark']

function read(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function apply(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* preference just won't persist */
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(read)
  const cycle = useCallback(() => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'system'
    apply(next)
    setThemeState(next)
  }, [theme])
  return { theme, cycle }
}
