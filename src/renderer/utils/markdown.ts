import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

// Custom code block renderer to include wrapper container, language tag, and copy button.
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang || 'text';
      const highlighted = hljs.getLanguage(language)
        ? hljs.highlight(text, { language }).value
        : hljs.highlight(text, { language: 'plaintext' }).value;

      const encoded = encodeURIComponent(text);

      return `<div class="code-block-container relative group my-3">
  <div class="code-block-controls absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-900/90 border border-slate-700/50 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] text-slate-400 font-sans select-none shadow-lg">
    <span class="code-block-lang uppercase font-semibold text-cyan/95 pr-1.5 border-r border-slate-700/50">${language}</span>
    <button class="copy-code-btn hover:text-white flex items-center gap-1 cursor-pointer transition-colors" data-code="${encoded}">
      <i class="codicon codicon-copy text-[10px] pointer-events-none"></i>
      <span class="pointer-events-none">Copy</span>
    </button>
  </div>
  <pre class="!my-0"><code class="hljs language-${language}">${highlighted}</code></pre>
</div>`;
    }
  }
});

/**
 * Replaces file path references (e.g. `src/main.ts:45`) with clickable
 * `koda-open://` links that the global click handler in App.tsx intercepts.
 */
export const processMessageLinks = (text: string): string => {
  // First convert @[path] mentions to clickable links
  let processed = text.replace(/@\[(.*?)\]/g, (match, filePath) => {
    return `[📄 ${filePath}](koda-open://${filePath})`;
  });

  // Then convert file path references (e.g. src/main.ts:45)
  return processed.replace(
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
