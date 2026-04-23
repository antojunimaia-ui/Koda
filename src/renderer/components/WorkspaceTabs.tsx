import React, { useState, useEffect, useRef } from 'react'
import { Workspace } from '../types/index.js'

interface WorkspaceTabsProps {
  workspaces: Workspace[]
  activeId: string | null
  onSwitch: (id: string) => void
  onAdd: () => void
  onClose: (id: string) => void
  variant?: 'classic' | 'modern'
  /** When using modern variant with iconbar, offset the left edge by this amount */
  iconbarWidth?: number
  splitIds?: [string, string] | null
  onSplitWith?: (id: string) => void
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
interface ContextMenuState { tabId: string; x: number; y: number }

const TabContextMenu: React.FC<{
  state: ContextMenuState
  workspaces: Workspace[]
  activeId: string | null
  splitIds?: [string, string] | null
  onSplitWith?: (id: string) => void
  onClose: (id: string) => void
  onDismiss: () => void
}> = ({ state, workspaces, activeId, splitIds, onSplitWith, onClose, onDismiss }) => {
  const ref = useRef<HTMLDivElement>(null)
  const isCurrentlySplit = splitIds?.includes(state.tabId)
  const canClose = workspaces.length > 1

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onDismiss])

  return (
    <div
      ref={ref}
      className="fixed z-[9999] bg-[#0d1117] border border-white/10 rounded-lg shadow-2xl py-1 min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-100"
      style={{ left: state.x, top: state.y }}
    >
      {onSplitWith && (
        <button
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/8 hover:text-indigo-300 transition-colors text-left"
          onClick={() => { onSplitWith(state.tabId); onDismiss() }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="12" y1="3" x2="12" y2="21"/>
          </svg>
          {isCurrentlySplit ? 'Close split view' : 'View alongside active'}
        </button>
      )}
      <div className="h-px bg-white/5 mx-2 my-1" />
      <button
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/8 transition-colors text-left"
        onClick={() => { /* duplicate in future */ onDismiss() }}
        disabled
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span className="opacity-40">Duplicate (soon)</span>
      </button>
      {canClose && (
        <button
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
          onClick={() => { onClose(state.tabId); onDismiss() }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
          Close workspace
        </button>
      )}
    </div>
  )
}

// ─── Classic Tab Bar (used by ClassicUI) ──────────────────────────────────────
const ClassicTabs: React.FC<Omit<WorkspaceTabsProps, 'variant' | 'iconbarWidth'>> = ({
  workspaces, activeId, onSwitch, onAdd, onClose, splitIds, onSplitWith
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  return (
    <>
      <div className="flex items-center bg-slate-900/50 border-b border-white/5 h-9 px-2 gap-1 overflow-x-auto no-scrollbar select-none">
        {workspaces.map((ws) => {
          const isActive = activeId === ws.id
          const isSplit = splitIds?.includes(ws.id)
          return (
            <div
              key={ws.id}
              onClick={() => onSwitch(ws.id)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ tabId: ws.id, x: e.clientX, y: e.clientY }) }}
              className={`flex items-center gap-2 px-3 h-7 rounded-t-md cursor-pointer transition-all border-x border-t text-[10px] font-bold uppercase tracking-wider min-w-[120px] max-w-[200px] group ${
                isActive
                  ? 'bg-slate-800 border-white/10 text-cyan-400'
                  : isSplit
                  ? 'bg-slate-900 border-indigo-500/30 text-indigo-400'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {isSplit && <span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />}
              <span className="truncate flex-1">{ws.name}</span>
              {workspaces.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(ws.id) }}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-opacity"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}
        <button
          onClick={onAdd}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/10 text-slate-500 hover:text-cyan-400 transition-all ml-1"
          title="New Workspace"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {contextMenu && (
        <TabContextMenu
          state={contextMenu}
          workspaces={workspaces}
          activeId={activeId}
          splitIds={splitIds}
          onSplitWith={onSplitWith}
          onClose={onClose}
          onDismiss={() => setContextMenu(null)}
        />
      )}
    </>
  )
}

// ─── Modern Tab Bar (used by ModernUI) ────────────────────────────────────────
const ModernTabs: React.FC<Omit<WorkspaceTabsProps, 'variant' | 'iconbarWidth'>> = ({
  workspaces, activeId, onSwitch, onAdd, onClose, splitIds, onSplitWith
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  return (
    <>
      <div className="flex items-center h-8 select-none border-b border-white/5 bg-[#0a0a0b]">
        <div className="flex items-center gap-1 px-2 h-full flex-1 overflow-x-auto no-scrollbar">
          {workspaces.map((ws) => {
            const isActive = activeId === ws.id
            const isSplit = splitIds?.includes(ws.id)
            return (
              <div
                key={ws.id}
                onClick={() => onSwitch(ws.id)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ tabId: ws.id, x: e.clientX, y: e.clientY }) }}
                className={`
                  group relative flex items-center gap-1.5 h-6 px-3 rounded-md cursor-pointer
                  transition-all duration-150 text-[10px] font-semibold tracking-wide
                  min-w-[100px] max-w-[180px]
                  ${isActive
                    ? 'bg-white/8 text-slate-100 shadow-sm'
                    : isSplit
                    ? 'bg-indigo-500/10 text-indigo-300'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }
                `}
              >
                {/* Active/split indicator pill */}
                {(isActive || isSplit) && (
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 rounded-full ${isActive ? 'bg-indigo-400' : 'bg-indigo-500/60'}`} />
                )}

                {/* Workspace icon */}
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={isActive ? 'text-indigo-400' : isSplit ? 'text-indigo-500' : 'text-slate-600'}
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>

                <span className="truncate flex-1">{ws.name}</span>

                {workspaces.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClose(ws.id) }}
                    className="opacity-0 group-hover:opacity-100 ml-0.5 rounded hover:bg-white/10 p-0.5 text-slate-500 hover:text-rose-400 transition-all"
                    title="Close workspace"
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}

          {/* New workspace button */}
          <button
            onClick={onAdd}
            className="flex items-center justify-center w-6 h-6 ml-1 rounded hover:bg-white/8 text-slate-600 hover:text-indigo-400 transition-all"
            title="New Workspace"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {contextMenu && (
        <TabContextMenu
          state={contextMenu}
          workspaces={workspaces}
          activeId={activeId}
          splitIds={splitIds}
          onSplitWith={onSplitWith}
          onClose={onClose}
          onDismiss={() => setContextMenu(null)}
        />
      )}
    </>
  )
}

// ─── Unified export ───────────────────────────────────────────────────────────
const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({ variant = 'classic', ...props }) => {
  if (variant === 'modern') return <ModernTabs {...props} />
  return <ClassicTabs {...props} />
}

export default WorkspaceTabs
