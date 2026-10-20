// Contrast rules for src/styles/tokens.css. Used by check-contrast.mjs and by the unit test.
import { calcAPCA } from 'apca-w3'

// Minimum APCA Lc by text role, from APCA's font-size/weight table (apcacontrast.com):
//   body   14-16px regular text            Lc 90 preferred
//   small  11-13px text (labels, badges)   Lc 78 (APCA floor is 75)
//   button 14px medium text on a fill      Lc 75
//   large  24px+ or bold 19px+ headings    Lc 60
//   ui     borders, focus rings, icons     Lc 30 (and WCAG 3:1)
export const MIN_LC = { body: 90, small: 78, button: 75, large: 60, ui: 30 }

// [foreground token, background token, role]
export const PAIRS = [
  ['ink', 'bg', 'body'], ['ink', 'surface', 'body'], ['ink', 'surface-2', 'body'], ['ink', 'accent-soft', 'body'], ['ink', 'bad-soft', 'body'],
  ['ink-2', 'bg', 'body'], ['ink-2', 'surface', 'body'], ['ink-2', 'surface-2', 'body'],
  ['ink-2', 'neutral-soft', 'small'],
  ['muted', 'bg', 'small'], ['muted', 'surface', 'small'], ['muted', 'surface-2', 'small'],
  ['accent-text', 'bg', 'small'], ['accent-text', 'surface', 'small'], ['accent-text', 'surface-2', 'small'], ['accent-text', 'accent-soft', 'small'],
  ['good', 'good-soft', 'small'], ['bad', 'bad-soft', 'small'], ['busy', 'busy-soft', 'small'],
  ['bad', 'surface', 'small'], ['bad', 'bg', 'small'],
  ['accent-ink', 'accent', 'button'], ['accent-ink', 'accent-hover', 'button'], ['on-bad', 'bad-solid', 'button'],
  ['paper-ink', 'paper', 'body'], ['paper-muted', 'paper', 'small'], ['paper-ink', 'paper-mark', 'body'], // landing demo page
  ['ink', 'accent-soft-2', 'large'], // marker-highlighted words in the landing headline
  ['control', 'surface', 'ui'], ['control', 'bg', 'ui'], ['focus', 'surface', 'ui'], ['focus', 'bg', 'ui'],
]

const tokens = (block) =>
  Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]))

const slice = (css, start, end) => {
  const from = css.indexOf(start)
  return css.slice(from, end ? css.indexOf(end, from + 1) : undefined)
}

const luminance = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const wcagRatio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
export const apcaLc = (fg, bg) => Math.abs(calcAPCA(fg, bg))

/** Evaluates every pair in both themes. Returns { rows, drift, missing }. */
export function evaluate(css) {
  const themes = {
    light: tokens(slice(css, ':root {', '@media')),
    dark: tokens(slice(css, ":root[data-theme='dark']")),
  }
  const darkFromMedia = tokens(slice(css, ":root:not([data-theme='light'])", ":root[data-theme='dark']"))

  const rows = []
  const missing = []
  for (const [theme, t] of Object.entries(themes)) {
    for (const [fg, bg, role] of PAIRS) {
      if (!t[fg] || !t[bg]) { missing.push(`${theme}: ${!t[fg] ? fg : bg}`); continue }
      const wcag = wcagRatio(t[fg], t[bg])
      const apca = apcaLc(t[fg], t[bg])
      const ok = wcag >= (role === 'ui' ? 3 : 4.5) && apca >= MIN_LC[role]
      rows.push({ theme, fg, bg, role, wcag, apca, ok })
    }
  }
  // The dark palette is declared twice (system preference and explicit toggle); they must stay identical.
  const drift = Object.keys({ ...themes.dark, ...darkFromMedia }).filter((k) => themes.dark[k] !== darkFromMedia[k])
  return { rows, drift, missing }
}
