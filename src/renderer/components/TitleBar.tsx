import React from 'react'

interface TitleBarProps {
  mode: 'fast' | 'planner'
  onModeChange: (mode: 'fast' | 'planner') => void
  onSettingsClick: () => void
  showPanel: boolean
  onTogglePanel: () => void
}

const TitleBar: React.FC<TitleBarProps> = ({ mode, onModeChange, onSettingsClick, showPanel, onTogglePanel }) => {
  return (
    <div className="h-10 bg-slate-900 border-b border-white/5 flex items-center justify-between px-3 select-none titlebar-drag">
      <div className="flex items-center gap-2 no-drag h-full">
        <div className="flex bg-slate-900/60 rounded-md p-0.5 border border-white/5 shadow-inner">
          <button 
            onClick={() => onModeChange('fast')}
            className={`w-14 h-5 flex items-center justify-center rounded text-[8px] font-black uppercase tracking-widest transition-all duration-200 no-drag ${mode === 'fast' ? 'bg-cyan-600/90 text-white scale-105' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
          >
            Fast
          </button>
          <button 
            onClick={() => onModeChange('planner')}
            className={`w-16 h-5 flex items-center justify-center rounded text-[8px] font-black uppercase tracking-widest transition-all duration-200 no-drag ${mode === 'planner' ? 'bg-amber-600/90 text-white scale-105' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
          >
            Planner
          </button>
        </div>

        <button 
          onClick={onSettingsClick}
          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:bg-white/5 rounded transition-all no-drag ml-1"
          title="Agent Settings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>

      <div className="flex items-center no-drag h-full">
        {/* Context Panel Toggle — left of window controls */}
        <button
          onClick={onTogglePanel}
          title={showPanel ? 'Hide context panel' : 'Show context panel'}
          className={`w-11 h-10 flex items-center justify-center transition-colors no-drag ${showPanel ? 'text-cyan-400 bg-cyan-900/20' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
        >
          {/* Files/tree icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h12M3 18h8"/>
          </svg>
        </button>

        <button 
          onClick={() => window.koda.minimize()}
          className="w-11 h-10 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors no-drag"
        >
          <svg width="12" height="1" viewBox="0 0 12 1" fill="currentColor"><rect width="12" height="1"/></svg>
        </button>
        <button 
          onClick={() => window.koda.maximize()}
          className="w-11 h-10 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors no-drag"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1"><rect x="1" y="1" width="8" height="8"/></svg>
        </button>
        <button 
          onClick={() => window.koda.close()}
          className="w-11 h-10 flex items-center justify-center text-slate-400 hover:bg-rose-600 hover:text-white transition-colors no-drag"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M1 1L9 9M9 1L1 9"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default TitleBar

