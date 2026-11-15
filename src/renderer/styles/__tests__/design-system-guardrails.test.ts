import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ─── ModernUI design-system guardrails ────────────────────────────────────────
// These tests keep the ModernUI skin honest: no hardcoded surface colours inside
// the components that belong to the skin. Surfaces must come from the tokens in
// styles/modern.css (.mui-* primitives / var(--mui-*)). ClassicUI lives in
// components/classic/** and is intentionally not covered.

const RENDERER = join(process.cwd(), 'src', 'renderer')
const MODERN_DIRS = ['components/modern', 'components/settings'].map((p) => join(RENDERER, p))
const MODERN_CSS = join(RENDERER, 'styles', 'modern.css')

// Patterns that must never appear again in the skin components.
// - bg-[#xxxxxx] / border-[#xxxxxx] — raw hex surfaces
// - bg-neutral-9xx — Tailwind legacy neutral palette
// - bg-white/[0.0x] — ad-hoc white-alpha fills
const FORBIDDEN = [/bg-\[#/i, /border-\[#/i, /\bbg-neutral-9/, /\bbg-white\/\[0\.0/]

function listTsx(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listTsx(p))
    else if (entry.name.endsWith('.tsx')) out.push(p)
  }
  return out
}

describe('ModernUI design system guardrails', () => {
  it('proíbe cores de superfície hardcoded nos componentes do skin modern', () => {
    const offenders: string[] = []
    for (const dir of MODERN_DIRS) {
      for (const file of listTsx(dir)) {
        const src = readFileSync(file, 'utf8')
        for (const re of FORBIDDEN) {
          const m = src.match(re)
          if (m) offenders.push(`${file.replace(/\\/g, '/')}: ${m[0]}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('expõe os tokens essenciais do skin no modern.css', () => {
    const css = readFileSync(MODERN_CSS, 'utf8')
    for (const token of [
      '--mui-canvas',
      '--mui-chrome',
      '--mui-surface-1',
      '--mui-surface-2',
      '--mui-surface-hover',
      '--mui-fg',
      '--mui-fg-strong',
      '--mui-fg-muted',
      '--mui-accent',
      '--mui-hairline',
      '--mui-hairline-strong',
      '--mui-tint-1',
      '--mui-border-selected',
      '--mui-radius',
    ]) {
      expect(css).toContain(token)
    }
  })
})
