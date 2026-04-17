import React, { memo } from 'react'
import { TrackedFile } from '../../types/index.js'

interface ContextPanelProps {
  files: TrackedFile[]
  pinnedFiles: string[]
  onPin: (path: string) => void
  onUnpin: (path: string) => void
  onInject: (path: string) => void
  cwd: string
}

const ContextPanel = memo(({ files, pinnedFiles, onPin, onUnpin, onInject, cwd }: ContextPanelProps) => {
  const shortPath = (absPath: string) => absPath.replace(cwd, '').replace(/^[/\\]/, '') || absPath

  const modifiedFiles = files.filter(f => f.access === 'modified')
  const readFiles = files.filter(f => f.access === 'read' && !modifiedFiles.find(m => m.path === f.path))

  const FileRow = ({ file, badge }: { file: TrackedFile; badge: React.ReactNode }) => {
    const isPinned = pinnedFiles.includes(file.path)
    return (
      <div
        className="group flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800/50 cursor-pointer transition-colors"
        onClick={() => onInject(file.path)}
        title={`Click to inject into chat: ${file.path}`}
      >
        {badge}
        <span className="flex-1 text-slate-400 text-[10px] font-mono truncate group-hover:text-slate-200 transition-colors">
          {shortPath(file.path)}
        </span>
        <button
          onClick={e => { e.stopPropagation(); isPinned ? onUnpin(file.path) : onPin(file.path) }}
          title={isPinned ? 'Unpin from context' : 'Pin to context'}
          className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-[9px] ${
            isPinned ? 'text-cyan-400 opacity-100' : 'text-slate-500 hover:text-cyan-400'
          }`}
        >
          {isPinned ? '📌' : '📍'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-64 h-full flex-shrink-0 border-l border-black/20 overflow-hidden" style={{ backgroundColor: 'var(--koda-sidebar)' }}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/5 flex items-center gap-2">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400 flex-shrink-0">
          <path d="M3 6h18M3 12h12M3 18h8" />
        </svg>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Context Panel</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
        {/* Pinned files */}
        {pinnedFiles.length > 0 && (
          <div className="mb-3">
            <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-500/70 mb-1">📌 Pinned</div>
            {pinnedFiles.map(path => (
              <div
                key={path}
                className="group flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800/50 cursor-pointer transition-colors"
                onClick={() => onInject(path)}
                title={`Click to inject: ${path}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                <span className="flex-1 text-slate-300 text-[10px] font-mono truncate group-hover:text-white transition-colors">
                  {shortPath(path)}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onUnpin(path) }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-all text-[9px] p-0.5"
                  title="Unpin"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Modified this session */}
        {modifiedFiles.length > 0 && (
          <div className="mb-3">
            <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-500/70 mb-1">✏️ Modified</div>
            {modifiedFiles.map(f => (
              <FileRow
                key={f.path}
                file={f}
                badge={<span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
              />
            ))}
          </div>
        )}

        {/* Read by agent */}
        {readFiles.length > 0 && (
          <div className="mb-3">
            <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500/70 mb-1">👁 Read</div>
            {readFiles.map(f => (
              <FileRow
                key={f.path}
                file={f}
                badge={<span className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" />}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {files.length === 0 && pinnedFiles.length === 0 && (
          <div className="px-3 py-6 text-center">
            <div className="text-slate-600 text-[10px] font-mono leading-relaxed">
              No files tracked yet.<br />Start a task and the agent's<br />file activity will appear here.
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

ContextPanel.displayName = 'ContextPanel'

export default ContextPanel
