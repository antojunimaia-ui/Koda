import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

// Configure marked once at module level (not inside render)
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language }).value
  }
}))

/**
 * Replaces file path references (e.g. `src/main.ts:45`) with clickable
 * `koda-open://` links that the global click handler in App.tsx intercepts.
 */
export const processMessageLinks = (text: string): string => {
  return text.replace(
    /(([a-zA-Z]:[\\/][^: \n\r`"']+)|([^: \n\r`"']+)):(\d+)/g,
    (match, _full, absPath, relPath, line) => {
      const finalPath = absPath || relPath
      if (finalPath.includes('.') || finalPath.includes('/') || finalPath.includes('\\')) {
        return `[${match}](koda-open://${finalPath}:${line})`
      }
      return match
    }
  )
}

export { marked }
