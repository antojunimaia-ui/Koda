import React, { useState, useRef, useEffect } from 'react'

type Mode = 'fast' | 'planner' | 'colab' | 'teach'

interface TitleBarProps {
  mode: Mode
  onModeChange: (mode: Mode) => void
  onSettingsClick: () => void
  onMcpClick: () => void
  onBrowserClick: () => void
  showBrowser: boolean
  onTerminalClick: () => void
  showTerminal: boolean
  showPanel: boolean
  onTogglePanel: () => void
  uiMode?: 'classic' | 'modern'
  showIconBar?: boolean
}

const MODES: { id: Mode; label: string; icon: string; desc: string; color: string }[] = [
  { id: 'fast', label: 'Fast Mode', icon: '⚡', desc: 'Direct execution, high speed', color: 'text-cyan-400' },
  { id: 'planner', label: 'Planner', icon: '📋', desc: 'Strategy first, safe edits', color: 'text-amber-400' },
  { id: 'colab', label: 'Collaborative', icon: '👥', desc: 'Multi-agent architectural design', color: 'text-indigo-400' },
  { id: 'teach', label: 'Teach & Code', icon: '🎓', desc: 'Live coding with step-by-step lessons', color: 'text-emerald-400' },
]

const TitleBar: React.FC<TitleBarProps> = ({ 
  mode, onModeChange, onSettingsClick, onMcpClick, 
  onBrowserClick, showBrowser, onTerminalClick, showTerminal, 
  showPanel, onTogglePanel, uiMode = 'classic', showIconBar = true
}) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const activeMode = MODES.find(m => m.id === mode) || MODES[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const modeSelector = (
    <div className="relative h-full flex items-center" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-md border border-white/5 transition-all no-drag group"
      >
        <span className="text-xs">{activeMode.icon}</span>
        <span className={`text-[10px] font-black uppercase tracking-widest ${activeMode.color}`}>{activeMode.label}</span>
        <svg 
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" 
          className={`text-slate-500 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-[#0d1117] border border-white/10 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200 z-[1100]">
          <div className="p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onModeChange(m.id)
                  setShowDropdown(false)
                }}
                className={`w-full flex flex-col gap-0.5 px-3 py-2 rounded-md transition-all text-left group ${mode === m.id ? 'bg-white/5' : 'hover:bg-white/5'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{m.icon}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${mode === m.id ? m.color : 'text-slate-400 group-hover:text-slate-200'}`}>
                      {m.label}
                    </span>
                  </div>
                  {mode === m.id && <div className={`w-1 h-1 rounded-full ${m.color.replace('text-', 'bg-')}`} />}
                </div>
                <span className="text-[9px] text-slate-500 ml-5 group-hover:text-slate-400 transition-colors uppercase font-medium">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className={`relative h-10 flex items-center justify-between select-none titlebar-drag shrink-0 z-[1000] ${uiMode === 'modern' ? 'bg-transparent pr-3' : 'bg-slate-900 border-b border-white/5 px-3'}`}>
      
      {/* Custom bottom border for Modern UI (starts after Iconbar) */}
      {uiMode === 'modern' && (
        <div className={`absolute bottom-0 right-0 h-[1px] bg-white/5 ${showIconBar ? 'left-12' : 'left-0'}`} />
      )}

      <div className="flex items-center h-full relative z-10">
        
        {/* Visual extension of the IconBar directly inside the TitleBar */}
        {uiMode === 'modern' && showIconBar && (
          <div className="w-12 h-full shrink-0" />
        )}

        <div className={`flex items-center gap-1 h-full ${uiMode === 'modern' ? 'pl-3' : ''}`}>
          <div className="no-drag h-full flex items-center">
            {modeSelector}
          </div>

        {uiMode === 'classic' && (
          <button 
            onClick={onSettingsClick}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:bg-white/5 rounded transition-all no-drag ml-1"
            title="Agent Settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        )}

        {uiMode === 'classic' && (
          <button 
            onClick={onMcpClick}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:bg-white/5 rounded transition-all no-drag ml-0.5"
            title="MCP Settings (Model Context Protocol)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </button>
        )}

        {/* Modern UI: Settings button shown only when Iconbar is hidden (escape hatch) */}
        {uiMode === 'modern' && !showIconBar && (
          <button
            onClick={onSettingsClick}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-zinc-200 hover:bg-white/5 rounded transition-all no-drag ml-1"
            title="Settings (enable Iconbar here)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        )}
        </div>
      </div>

      <div className="flex items-center no-drag h-full">
        {/* Toolbar Toggles - Only visible in Classic Mode as Modern uses Iconbar */}
        {uiMode === 'classic' && (
          <>
            <button
              onClick={onTerminalClick}
              title={showTerminal ? 'Hide Terminal' : 'Show Terminal'}
              className={`w-11 h-10 flex items-center justify-center transition-colors no-drag ${showTerminal ? 'text-amber-400 bg-amber-900/20' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
            </button>

            <button
              onClick={onBrowserClick}
              title={showBrowser ? 'Hide Browser Preview' : 'Show Browser Preview'}
              className={`w-11 h-10 flex items-center justify-center transition-colors no-drag ${showBrowser ? 'text-emerald-400 bg-emerald-900/20' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </button>

            <button
              onClick={onTogglePanel}
              title={showPanel ? 'Hide context panel' : 'Show context panel'}
              className={`w-11 h-10 flex items-center justify-center transition-colors no-drag ${showPanel ? 'text-cyan-400 bg-cyan-900/20' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M3 12h12M3 18h8"/>
              </svg>
            </button>
          </>
        )}

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
