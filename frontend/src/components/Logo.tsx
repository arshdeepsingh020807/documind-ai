export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M9 8h9l5 5v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" fill="var(--bg)" />
      <path d="M18 8v5h5" fill="var(--accent-soft)" />
      <path d="M11.5 18h9M11.5 21h6" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
