import { useState, useEffect } from 'react'
import { KodaTheme } from '../types/index.js'
import { KoDB } from '../db/kodb.js'

export function useTheme() {
  const [theme, setTheme] = useState<KodaTheme>(() => KoDB.get('theme'))

  useEffect(() => {
    KoDB.set('theme', theme)
    const root = document.documentElement
    const { colors: c } = theme

    root.style.setProperty('--koda-bg',           c.bg)
    root.style.setProperty('--koda-bg-alt',       c.bgAlt)
    root.style.setProperty('--koda-sidebar',      c.sidebar)

    root.style.setProperty('--koda-text',         c.text)
    root.style.setProperty('--koda-text-dim',     c.textDim)
    root.style.setProperty('--koda-text-faint',   c.textFaint)

    root.style.setProperty('--koda-border',       c.border)
    root.style.setProperty('--koda-border-faint', c.borderFaint)

    root.style.setProperty('--koda-accent',       c.accent)
    root.style.setProperty('--koda-accent-alt',   c.accentAlt)
    root.style.setProperty('--koda-accent-glow',  c.accentGlow)

    root.style.setProperty('--koda-status-ok',    c.statusOk)
    root.style.setProperty('--koda-status-busy',  c.statusBusy)
    root.style.setProperty('--koda-status-error', c.statusError)
    root.style.setProperty('--koda-status-info',  c.statusInfo)

    root.style.setProperty('--koda-code-bg',      c.codeBg)
    root.style.setProperty('--koda-code-text',    c.codeText)
    root.style.setProperty('--koda-code-syntax',  c.codeSyntax)
    root.style.setProperty('--koda-inline-code',  c.inlineCode)

    root.style.setProperty('--koda-user-msg',     c.userMsg)
    root.style.setProperty('--koda-tool-msg',     c.toolMsg)
  }, [theme])

  return { theme, setTheme }
}
