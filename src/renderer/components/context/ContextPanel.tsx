import React, { memo, useState } from 'react'
import { TrackedFile } from '../../types/index.js'
import {
  FileExplorer,
  ExplorerTabButton,
  ExplorerPanelOverlay,
  IconPin,
  ExplorerPosition,
} from '../explorer/index.js'

// Re-export components and types for 100% backward compatibility
export { FileExplorer, ExplorerTabButton, ExplorerPanelOverlay }
export type {
  FileNode,
  ExplorerPosition,
  FileExplorerProps,
  ExplorerTabButtonProps,
  ExplorerPanelOverlayProps,
} from '../explorer/index.js'

export interface ContextPanelProps {
  files: TrackedFile[]
  pinnedFiles: string[]
  onPin: (path: string) => void
  onUnpin: (path: string) => void
  onInject: (path: string) => void
  onAddToInput?: (path: string) => void
  cwd: string
  width?: number
  explorerTabPosition?: ExplorerPosition
  onExplorerTabPositionChange?: (pos: ExplorerPosition) => void
  showExplorerTab?: boolean
  activeTab?: 'context' | 'explorer'
  onTabChange?: (tab: 'context' | 'explorer') => void
}

const ContextPanel = memo(({
  files,
  pinnedFiles,
  onPin,
  onUnpin,
  onInject,
  onAddToInput,
  cwd,
  explorerTabPosition = 'panel',
  onExplorerTabPositionChange,
  showExplorerTab = true,
  activeTab: controlledTab,
  onTabChange,
}: ContextPanelProps) => {
  const [internalTab, setInternalTab] = useState<'context' | 'explorer'>('context')
  const tab = controlledTab ?? internalTab
  const setTab = (t: 'context' | 'explorer') => {
    setInternalTab(t)
    onTabChange?.(t)
  }

  const shortPath = (absPath: string) => absPath.replace(cwd, '').replace(/^[/\\]/, '') || absPath

  const modifiedFiles = files.filter(f => f.access === 'modified')
  const readFiles = files.filter(f => f.access === 'read' && !modifiedFiles.find(m => m.path === f.path))

  const FileRow = ({ file, badge }: { file: TrackedFile; badge: React.ReactNode }) => {
    const isPinned = pinnedFiles.includes(file.path)
    return (
      <div
        className="group flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 cursor-pointer transition-colors"
        onClick={() => onInject(file.path)}
        title={file.path}
      >
        {badge}
        <span className="flex-1 text-slate-400 text-[11px] truncate group-hover:text-slate-200 transition-colors">
          {shortPath(file.path)}
        </span>
        <button
          onClick={e => {
            e.stopPropagation()
            isPinned ? onUnpin(file.path) : onPin(file.path)
          }}
          className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 ${isPinned ? 'opacity-100' : ''}`}
          title={isPinned ? 'Unpin' : 'Pin'}
        >
          <IconPin active={isPinned} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#141414]">
      {/* Header */}
      <div className="flex items-center gap-0.5 px-2 pt-2 pb-1.5 border-b border-white/5 shrink-0">
        <button
          onClick={() => setTab('context')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
            tab === 'context' ? 'bg-white/8 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h12M3 18h8" />
          </svg>
          Context
        </button>

        {showExplorerTab && explorerTabPosition === 'panel' && (
          <ExplorerTabButton
            active={tab === 'explorer'}
            onClick={() => setTab('explorer')}
            position={explorerTabPosition}
            onMoveTo={(pos) => onExplorerTabPositionChange?.(pos)}
            variant="panel"
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* ── Context tab ── */}
        {tab === 'context' && (
          <div className="py-2">
            {pinnedFiles.length > 0 && (
              <div className="mb-4">
                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600 mb-1">Pinned</div>
                {pinnedFiles.map(path => (
                  <div
                    key={path}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => onInject(path)}
                    title={path}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="flex-1 text-slate-300 text-[11px] truncate group-hover:text-white transition-colors">
                      {shortPath(path)}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        onUnpin(path)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all text-[9px] p-0.5"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {modifiedFiles.length > 0 && (
              <div className="mb-4">
                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600 mb-1">Modified</div>
                {modifiedFiles.map(f => (
                  <FileRow
                    key={f.path}
                    file={f}
                    badge={<span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 flex-shrink-0" />}
                  />
                ))}
              </div>
            )}

            {readFiles.length > 0 && (
              <div className="mb-4">
                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600 mb-1">Read</div>
                {readFiles.map(f => (
                  <FileRow
                    key={f.path}
                    file={f}
                    badge={<span className="w-1.5 h-1.5 rounded-full bg-slate-700 flex-shrink-0" />}
                  />
                ))}
              </div>
            )}

            {files.length === 0 && pinnedFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
                  <path d="M3 6h18M3 12h12M3 18h8" />
                </svg>
                <span className="text-slate-600 text-[10px] text-center leading-relaxed">
                  No files tracked yet.<br />Start a task to see activity.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Explorer tab ── */}
        {tab === 'explorer' && (
          <FileExplorer
            cwd={cwd}
            onInject={onInject}
            onPin={onPin}
            onAddToInput={onAddToInput}
            pinnedFiles={pinnedFiles}
          />
        )}
      </div>
    </div>
  )
})

ContextPanel.displayName = 'ContextPanel'

export default ContextPanel

// ─── Resizable Overlay ────────────────────────────────────────────────────────

export interface ContextPanelOverlayProps extends ContextPanelProps {
  width: number
  isResizing: boolean
  onStartResize: () => void
}

export const ContextPanelOverlay: React.FC<ContextPanelOverlayProps> = ({
  width,
  isResizing,
  onStartResize,
  ...props
}) => {
  return (
    <div
      className="absolute top-10 bottom-0 right-0 z-50 animate-in slide-in-from-right duration-200 flex bg-[#141414] border-l border-white/5"
      style={{ width }}
    >
      <div
        onMouseDown={onStartResize}
        className={`w-1 h-full cursor-col-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${
          isResizing ? 'bg-indigo-500 w-1.5' : 'bg-white/5 hover:bg-indigo-500/50'
        }`}
      />
      <ContextPanel {...props} />
    </div>
  )
}
