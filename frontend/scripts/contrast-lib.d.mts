export const MIN_LC: Record<'body' | 'small' | 'button' | 'large' | 'ui', number>
export const PAIRS: [string, string, keyof typeof MIN_LC][]
export const wcagRatio: (a: string, b: string) => number
export const apcaLc: (fg: string, bg: string) => number
export function evaluate(css: string): {
  rows: { theme: string; fg: string; bg: string; role: string; wcag: number; apca: number; ok: boolean }[]
  drift: string[]
  missing: string[]
}
