// Verifies every foreground/background pair in src/styles/tokens.css against WCAG 2 and APCA.
// Run: npm run check:contrast  (exits non-zero on any failure)
import { calcAPCA } from 'apca-w3'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')

const tokens = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]))
const between = (start, end) => css.slice(css.indexOf(start), end ? css.indexOf(end, css.indexOf(start) + 1) : undefined)

const light = tokens(between(':root {', '@media'))
const darkMedia = tokens(between(":root:not([data-theme='light'])", ":root[data-theme='dark']"))
const dark = tokens(between(":root[data-theme='dark']"))

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const wcag = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const apca = (fg, bg) => Math.abs(calcAPCA(fg, bg))

// [foreground, background, kind]. text: WCAG 4.5 and APCA Lc 60. ui: WCAG 3 and APCA Lc 30
// (borders, focus rings and icons; APCA's guidance for meaningful non-text elements).
const PAIRS = [
  ['ink', 'bg', 'text'], ['ink', 'surface', 'text'], ['ink', 'surface-2', 'text'],
  ['ink-2', 'bg', 'text'], ['ink-2', 'surface', 'text'], ['ink-2', 'surface-2', 'text'], ['ink-2', 'neutral-soft', 'text'],
  ['muted', 'bg', 'text'], ['muted', 'surface', 'text'], ['muted', 'surface-2', 'text'],
  ['accent-text', 'bg', 'text'], ['accent-text', 'surface', 'text'], ['accent-text', 'accent-soft', 'text'], ['accent-text', 'surface-2', 'text'],
  ['accent-ink', 'accent', 'text'], ['accent-ink', 'accent-hover', 'text'],
  ['ink', 'accent-soft', 'text'],
  ['good', 'good-soft', 'text'], ['bad', 'bad-soft', 'text'], ['busy', 'busy-soft', 'text'],
  ['bad', 'surface', 'text'], ['bad', 'bg', 'text'], ['ink', 'bad-soft', 'text'],
  ['on-bad', 'bad-solid', 'text'],
  ['control', 'surface', 'ui'], ['control', 'bg', 'ui'], ['focus', 'surface', 'ui'], ['focus', 'bg', 'ui'],
]

let failures = 0
const run = (name, t) => {
  console.log(`\n${name}`)
  for (const [fg, bg, kind] of PAIRS) {
    if (!t[fg] || !t[bg]) { console.log(`  MISSING token ${!t[fg] ? fg : bg}`); failures++; continue }
    const w = wcag(t[fg], t[bg]); const a = apca(t[fg], t[bg])
    const [wMin, aMin] = kind === 'text' ? [4.5, 60] : [3, 30]
    const ok = w >= wMin && a >= aMin
    if (!ok) failures++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${kind.padEnd(4)} WCAG ${w.toFixed(2).padStart(5)} APCA Lc ${a.toFixed(0).padStart(3)}  ${fg} on ${bg}`)
  }
}
run('light', light)
run('dark', dark)

// The dark palette is declared twice (system preference and explicit toggle); they must stay identical.
const drift = Object.keys({ ...dark, ...darkMedia }).filter((k) => dark[k] !== darkMedia[k])
if (drift.length) { failures++; console.log(`\nFAIL dark blocks differ on: ${drift.join(', ')}`) }
else console.log('\nok   both dark blocks are identical')

console.log(failures ? `\n${failures} failure(s)` : '\nAll contrast checks passed')
process.exit(failures ? 1 : 0)
