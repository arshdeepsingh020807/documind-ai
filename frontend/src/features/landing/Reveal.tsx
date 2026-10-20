import { useEffect, useRef, useState, type ReactNode } from 'react'

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** True once the element has scrolled into view. Starts true whenever the browser can't observe scrolling or
 *  the user asked for less motion, so nothing is ever stuck hidden. */
export function useSeen<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined' || prefersReducedMotion())

  useEffect(() => {
    const el = ref.current
    if (seen || !el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setSeen(true)
    }, { rootMargin: '0px 0px -8% 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [seen])

  return [ref, seen] as const
}

/** Fades its children up the first time they scroll into view. */
export function Reveal({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  const [ref, seen] = useSeen<HTMLDivElement>()
  return <div ref={ref} id={id} className={`reveal ${seen ? 'reveal--in' : ''} ${className}`.trim()}>{children}</div>
}
