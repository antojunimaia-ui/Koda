import React, { memo } from 'react'
import { AttachedImage } from '../../types/index.js'

const symbols = {
  arrow: '❯',
}

interface UserMessageProps {
  text: string
  images?: AttachedImage[]
  onRollback?: () => void
  remote?: boolean
}

const UserMessage = memo(({ text, images, onRollback, remote }: UserMessageProps) => (
  <div className="flex flex-col gap-2 mb-1 mt-2 p-2 rounded-md group relative" style={{ backgroundColor: 'var(--koda-user-msg)' }}>
    {/* Image thumbnails */}
    {images && images.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {images.map((img, i) => (
          <img
            key={i}
            src={img.dataUrl}
            alt={img.name}
            className="h-24 rounded border border-slate-700 object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
            title={img.name}
          />
        ))}
      </div>
    )}
    <div className="flex gap-3 items-start">
      <span className="font-bold mt-0.5 select-none" style={{ color: 'var(--koda-accent)' }}>{symbols.arrow}</span>
      <span className="text-slate-100 font-medium leading-relaxed flex-1">
        {remote && (
          <span className="inline-flex items-center gap-1 mr-2 text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-900/30 border border-emerald-500/30 px-1.5 py-0.5 rounded align-middle">
            🌐 Remote
          </span>
        )}
        {text}
      </span>
      {onRollback && (
        <button
          onClick={onRollback}
          title="Rollback to this point — restores files and memory"
          className="opacity-30 hover:opacity-100 transition-opacity ml-1 mt-0.5 p-1 rounded hover:bg-rose-900/30 text-slate-500 hover:text-rose-400 flex-shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      )}
    </div>
  </div>
))

UserMessage.displayName = 'UserMessage'

export default UserMessage
