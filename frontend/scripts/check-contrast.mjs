// Verifies every foreground/background pair in src/styles/tokens.css against WCAG 2 and APCA.
// Run: npm run check:contrast  (exits non-zero on any failure)
import fs from 'node:fs'
import { evaluate, MIN_LC } from './contrast-lib.mjs'

const css = fs.readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
const { rows, drift, missing } = evaluate(css)

for (const theme of ['light', 'dark']) {
  console.log(`\n${theme}`)
  for (const r of rows.filter((x) => x.theme === theme)) {
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.role.padEnd(6)} WCAG ${r.wcag.toFixed(2).padStart(5)}  APCA Lc ${r.apca.toFixed(0).padStart(3)} (min ${MIN_LC[r.role]})  ${r.fg} on ${r.bg}`)
  }
}
for (const m of missing) console.log(`\nFAIL missing token ${m}`)
if (drift.length) console.log(`\nFAIL the two dark blocks differ on: ${drift.join(', ')}`)

const failures = rows.filter((r) => !r.ok).length + missing.length + (drift.length ? 1 : 0)
console.log(failures ? `\n${failures} failure(s)` : '\nAll contrast checks passed')
process.exit(failures ? 1 : 0)
