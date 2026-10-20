import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { apcaLc, evaluate, MIN_LC, wcagRatio } from '../../scripts/contrast-lib.mjs'

// Vitest runs from the frontend folder; import.meta.url isn't a file: URL under jsdom.
const tokens = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

describe('design tokens', () => {
  it('meet WCAG 2 and size-aware APCA minimums in both themes', () => {
    const { rows, drift, missing } = evaluate(tokens)
    expect(missing).toEqual([])
    expect(drift).toEqual([])
    expect(rows.filter((r) => !r.ok).map((r) => `${r.theme} ${r.fg} on ${r.bg}`)).toEqual([])
    expect(rows.some((r) => r.theme === 'dark') && rows.some((r) => r.theme === 'light')).toBe(true)
  })

  // The checker is only worth trusting if it fails on bad input.
  it('fails when small text is too faint, even if WCAG 2 would still pass it', () => {
    // #767676 on white is the classic "just passes AA" grey: 4.54:1, but well under APCA's small-text minimum.
    expect(wcagRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(apcaLc('#767676', '#ffffff')).toBeLessThan(MIN_LC.small)

    const faint = tokens.replace('--muted: #53534f;', '--muted: #767676;')
    const failing = evaluate(faint).rows.filter((r) => !r.ok && r.theme === 'light').map((r) => r.fg)
    expect(failing).toContain('muted')
  })

  it('detects the two dark palettes drifting apart', () => {
    const drifted = tokens.replace(/(:root:not\(\[data-theme='light'\]\) \{[\s\S]*?--ink: )#eeeeec/, '$1#ffffff')
    expect(drifted).not.toBe(tokens)
    expect(evaluate(drifted).drift).toContain('ink')
  })

  it('reports a missing token instead of silently skipping it', () => {
    const broken = tokens.replace(/--focus: #3e63dd;/, '')
    expect(evaluate(broken).missing.some((m) => m.endsWith('focus'))).toBe(true)
  })

  it('applies stricter minimums to body text than to buttons and borders', () => {
    expect(MIN_LC.body).toBeGreaterThan(MIN_LC.small)
    expect(MIN_LC.small).toBeGreaterThan(MIN_LC.large)
    expect(MIN_LC.large).toBeGreaterThan(MIN_LC.ui)
  })
})
