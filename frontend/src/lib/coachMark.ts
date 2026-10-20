import { useCallback, useState } from 'react'

const storageKey = (name: string) => `documind:coach:${name}`

/** A hint shown until the user dismisses it once; the choice is remembered in this browser. */
export function useCoachMark(name: string) {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(storageKey(name)) === null
    } catch {
      return true
    }
  })
  const dismiss = useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(storageKey(name), '1')
    } catch {
      /* hint may reappear next visit */
    }
  }, [name])
  return [visible, dismiss] as const
}
