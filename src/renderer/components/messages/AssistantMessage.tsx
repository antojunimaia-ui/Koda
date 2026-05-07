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
      {/* Koda Avatar - sempre no topo */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-shrink-0">
          {!done && !text ? (
            // Loading animation quando está pensando
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
              <video 
                src="/Loading.webm" 
                autoPlay 
                loop 
                muted 
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            // Ícone estático do Koda
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center">
              <img 
                src="/icon.png" 
                alt="Koda" 
                className="w-5 h-5 object-contain"
              />
            </div>
          )}
        </div>
        {uiMode === 'classic' && (
          <span className="font-bold opacity-60 text-sm" style={{ color: 'var(--koda-accent)' }}>Koda</span>
        )}
        {uiMode === 'modern' && (
          <span className="font-bold text-slate-300 text-sm">Koda</span>
        )}
      </div>

      {/* Message Content */}
      <div className="flex flex-col max-w-full overflow-hidden">
        {!done && !text && (
          <div className="ml-1">
            <BrailleSpinner rotateLabel color="cyan" />
          </div>
        )}
        {text && (
          <>
            <div
              className="markdown-body text-slate-300 leading-relaxed overflow-x-auto w-full"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {!done && (
              <span className="inline-block mt-2">
                <BrailleSpinner color="cyan" />
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
})

AssistantMessage.displayName = 'AssistantMessage'

export default AssistantMessage
