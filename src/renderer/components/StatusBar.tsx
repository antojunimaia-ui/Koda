import React, { useState, useRef, useEffect } from 'react'

type Mode = 'fast' | 'planner' | 'colab' | 'teach'

const MODES: { id: Mode; label: string; icon: string; desc: string; color: string }[] = [
  { id: 'fast', label: 'Fast Mode', icon: '⚡', desc: 'Direct execution, high speed', color: 'text-cyan-400' },
  { id: 'planner', label: 'Spec Development', icon: '📝', desc: 'Define specifications in specs.md first', color: 'text-amber-400' },
  { id: 'colab', label: 'Collaborative', icon: '👥', desc: 'Multi-agent architectural design', color: 'text-indigo-400' },
  { id: 'teach', label: 'Teach & Code', icon: '🎓', desc: 'Live coding with step-by-step lessons', color: 'text-emerald-400' },
]

interface StatusBarProps {
  mode?: Mode
  onModeChange?: (mode: Mode) => void
}

const StatusBar: React.FC<StatusBarProps> = ({ mode, onModeChange }) => {
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

  return (
    <div className="h-6 bg-[#0a0a0a] border-t border-white/5 flex items-center px-2 shrink-0 select-none">
      {/* Left section - Mode selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-white/5 rounded transition-all"
        >
          <span className="text-[10px]">{activeMode.icon}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${activeMode.color}`}>{activeMode.label}</span>
          <svg
            width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
            className={`text-slate-600 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {showDropdown && (
          <div className="absolute bottom-full left-0 mb-1 w-56 bg-[#0d1117] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-9999 animate-in fade-in slide-in-from-bottom-1 duration-150">
            <div className="p-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onModeChange?.(m.id)
                    setShowDropdown(false)
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all text-left ${mode === m.id ? 'bg-white/5' : 'hover:bg-white/5'}`}
                >
                  <span className="text-[10px]">{m.icon}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${mode === m.id ? m.color : 'text-slate-400'}`}>
                    {m.label}
                  </span>
                  {mode === m.id && <div className={`w-1 h-1 rounded-full ml-auto ${m.color.replace('text-', 'bg-')}`} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Center section - placeholder */}
      <div className="flex-1 flex items-center justify-center">
      </div>

      {/* Right section - placeholder */}
      <div className="flex items-center gap-2 text-slate-500 text-[10px]">
      </div>
    </div>
  )
}

export default StatusBar
