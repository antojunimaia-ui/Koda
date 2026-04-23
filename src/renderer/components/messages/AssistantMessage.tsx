import React, { memo } from 'react'
import { BrailleSpinner } from '../BrailleSpinner.js'
import { marked, processMessageLinks } from '../../utils/markdown.js'

interface AssistantMessageProps {
  text?: string
  done?: boolean
  uiMode?: 'classic' | 'modern'
}

const AssistantMessage = memo(({ text, done, uiMode = 'classic' }: AssistantMessageProps) => {
  let html = ''
  if (text) {
    try {
      const processedText = processMessageLinks(text)
      html = marked.parse(processedText) as string
    } catch {
      html = text
    }
  }

  return (
    <div className="flex flex-col ml-4">
      {!done && !text && <BrailleSpinner rotateLabel color="cyan" />}
      {text && (
        <div className="flex flex-col max-w-full overflow-hidden">
          {uiMode === 'classic' && (
            <span className="font-bold opacity-60 mb-1" style={{ color: 'var(--koda-accent)' }}>Koda:</span>
          )}
          <div
            className="markdown-body text-slate-300 leading-relaxed overflow-x-auto w-full"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {!done && (
            <span className="inline-block mt-2">
              <BrailleSpinner color="cyan" />
            </span>
          )}
        </div>
      )}
    </div>
  )
})

AssistantMessage.displayName = 'AssistantMessage'

export default AssistantMessage
