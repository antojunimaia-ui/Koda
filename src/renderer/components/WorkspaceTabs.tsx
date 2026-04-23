import React from 'react'
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
}

// ─── Classic Tab Bar (used by ClassicUI) ──────────────────────────────────────
const ClassicTabs: React.FC<Omit<WorkspaceTabsProps, 'variant' | 'iconbarWidth'>> = ({
  workspaces, activeId, onSwitch, onAdd, onClose
}) => (
  <div className="flex items-center bg-slate-900/50 border-b border-white/5 h-9 px-2 gap-1 overflow-x-auto no-scrollbar select-none">
    {workspaces.map((ws) => (
      <div
        key={ws.id}
        onClick={() => onSwitch(ws.id)}
        className={`flex items-center gap-2 px-3 h-7 rounded-t-md cursor-pointer transition-all border-x border-t text-[10px] font-bold uppercase tracking-wider min-w-[120px] max-w-[200px] group ${
          activeId === ws.id
            ? 'bg-slate-800 border-white/10 text-cyan-400'
            : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
        }`}
      >
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
    ))}
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
)

// ─── Modern Tab Bar (used by ModernUI) ────────────────────────────────────────
const ModernTabs: React.FC<Omit<WorkspaceTabsProps, 'variant' | 'iconbarWidth'>> = ({
  workspaces, activeId, onSwitch, onAdd, onClose
}) => (
  <div className="flex items-center h-8 select-none border-b border-white/5 bg-[#0a0a0b]">
    <div className="flex items-center gap-1 px-2 h-full flex-1 overflow-x-auto no-scrollbar">
      {workspaces.map((ws) => {
        const isActive = activeId === ws.id
        return (
          <div
            key={ws.id}
            onClick={() => onSwitch(ws.id)}
            className={`
              group relative flex items-center gap-1.5 h-6 px-3 rounded-md cursor-pointer
              transition-all duration-150 text-[10px] font-semibold tracking-wide
              min-w-[100px] max-w-[180px]
              ${isActive
                ? 'bg-white/8 text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }
            `}
          >
            {/* Active indicator pill */}
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 rounded-full bg-indigo-400" />
            )}

            {/* Workspace icon */}
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={isActive ? 'text-indigo-400' : 'text-slate-600'}
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
)

// ─── Unified export ───────────────────────────────────────────────────────────
const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({ variant = 'classic', ...props }) => {
  if (variant === 'modern') return <ModernTabs {...props} />
  return <ClassicTabs {...props} />
}

export default WorkspaceTabs
