import { useState, useEffect } from 'react'
import { KodaTheme } from '../types/index.js'
import { KoDB } from '../db/kodb.js'
import { applyThemeToDocument } from '../utils/applyTheme.js'

export function useTheme() {
  const [theme, setTheme] = useState<KodaTheme>(() => KoDB.get('theme'))

  useEffect(() => {
    KoDB.set('theme', theme)
    applyThemeToDocument(theme)
  }, [theme])

  return { theme, setTheme }
}
