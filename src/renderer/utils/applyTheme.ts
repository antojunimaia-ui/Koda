import type { KodaTheme } from '../types/index.js'

/**
 * Fonte única que aplica um tema nas variáveis --koda-* do documento.
 *
 * Tanto o host (useTheme) quanto os painéis (modo painel) bebem daqui — assim
 * o painel é idêntico ao shell sem duplicar o mapeamento.
 */
export function applyThemeToDocument(theme: KodaTheme): void {
  const colors = theme?.colors
  if (!colors) return
  const root = document.documentElement

  root.style.setProperty('--koda-bg', colors.bg)
  root.style.setProperty('--koda-bg-alt', colors.bgAlt)
  root.style.setProperty('--koda-sidebar', colors.sidebar)

  root.style.setProperty('--koda-text', colors.text)
  root.style.setProperty('--koda-text-dim', colors.textDim)
  root.style.setProperty('--koda-text-faint', colors.textFaint)

  root.style.setProperty('--koda-border', colors.border)
  root.style.setProperty('--koda-border-faint', colors.borderFaint)

  root.style.setProperty('--koda-accent', colors.accent)
  root.style.setProperty('--koda-accent-alt', colors.accentAlt)
  root.style.setProperty('--koda-accent-glow', colors.accentGlow)

  root.style.setProperty('--koda-status-ok', colors.statusOk)
  root.style.setProperty('--koda-status-busy', colors.statusBusy)
  root.style.setProperty('--koda-status-error', colors.statusError)
  root.style.setProperty('--koda-status-info', colors.statusInfo)

  root.style.setProperty('--koda-code-bg', colors.codeBg)
  root.style.setProperty('--koda-code-text', colors.codeText)
  root.style.setProperty('--koda-code-syntax', colors.codeSyntax)
  root.style.setProperty('--koda-inline-code', colors.inlineCode)

  root.style.setProperty('--koda-user-msg', colors.userMsg)
  root.style.setProperty('--koda-tool-msg', colors.toolMsg)
}
