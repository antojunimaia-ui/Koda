import React, { memo, useState } from 'react'
import { AttachedFile } from '../../types/index.js'

interface UserMessageProps {
  text: string
  images?: AttachedFile[]
  onRollback?: () => void
  remote?: boolean
  uiMode?: 'modern' | 'classic'
}

const UserMessage = memo(({ text, images, onRollback, remote, uiMode }: UserMessageProps) => {
  const [hovered, setHovered] = useState(false)

  if (uiMode === 'modern') {
    return (
      <div
        className="flex flex-col items-end gap-1 my-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Image thumbnails */}
        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end">
            {images.map((img, i) => (
              img.isImage ? (
                <img
                  key={i}
                  src={img.dataUrl}
                  alt={img.name}
                  className="h-24 rounded-xl border border-white/10 object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                  title={img.name}
                />
              ) : (
                <div key={i} className="h-16 w-32 bg-[#1e1e1e] border border-white/5 rounded-xl p-2.5 flex flex-col justify-between shadow-lg relative overflow-hidden group/file">
                  <div className="text-[9px] text-slate-300 font-bold leading-tight break-all line-clamp-2 uppercase tracking-tight">
                    {img.name}
                  </div>
                  <div className="flex items-center">
                    <div className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      {img.name.split('.').pop()?.toUpperCase() || 'FILE'}
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* Bubble */}
        <div className="max-w-[80%] bg-zinc-800/60 border border-white/8 rounded-2xl px-3.5 py-2">
          {remote && (
            <span className="inline-flex items-center gap-1 mr-2 text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-900/30 border border-emerald-500/30 px-1.5 py-0.5 rounded align-middle">
              🌐 Remote
            </span>
          )}
          <span className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">{text}</span>
        </div>

        {/* Actions — aparecem no hover */}
        <div className={`flex items-center gap-1 transition-all duration-150 ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {onRollback && (
            <button
              onClick={onRollback}
              title="Rollback to this point — restores files and memory"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Rollback
            </button>
          )}
        </div>
      </div>
    )
  }

  // Classic mode — layout original
  return (
    <div className="flex flex-col gap-2 mb-1 mt-2 p-2 rounded-md group relative" style={{ backgroundColor: 'var(--koda-user-msg)' }}>
      {images && images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            img.isImage ? (
              <img
                key={i}
                src={img.dataUrl}
                alt={img.name}
                className="h-24 rounded border border-slate-700 object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                title={img.name}
              />
            ) : (
              <div key={i} className="h-14 w-28 bg-[#1e1e1e] border border-slate-700 rounded p-2 flex flex-col justify-between shadow-sm">
                <div className="text-[9px] text-slate-300 font-bold truncate">
                  {img.name}
                </div>
                <div className="text-[8px] font-black text-slate-500 uppercase">
                  {img.name.split('.').pop()?.toUpperCase() || 'FILE'}
                </div>
              </div>
            )
          ))}
        </div>
      )}
      <div className="flex gap-3 items-start">
        <span className="font-bold mt-0.5 select-none" style={{ color: 'var(--koda-accent)' }}>❯</span>
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
  )
})

UserMessage.displayName = 'UserMessage'

export default UserMessage
