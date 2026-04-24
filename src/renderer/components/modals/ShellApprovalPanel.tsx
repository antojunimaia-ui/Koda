import React, { useState, useRef, useEffect, memo } from 'react'

const persistApprovedCommand = async (type: 'base' | 'full', command: string) => {
  const key = type === 'base' ? 'koda_approved_base' : 'koda_approved_full'
  const current = JSON.parse(localStorage.getItem(key) || '[]')
  const updated = [...new Set([...current, command])]
  localStorage.setItem(key, JSON.stringify(updated))
  const base = JSON.parse(localStorage.getItem('koda_approved_base') || '[]')
  const full = JSON.parse(localStorage.getItem('koda_approved_full') || '[]')
  await window.koda.updateApprovedCommands({ base, full })
}

interface ShellApprovalPanelProps {
  command: string
  baseCommand: string
  variant?: 'modern' | 'classic'
}

const ShellApprovalPanel = memo(({ command, baseCommand, variant = 'modern' }: ShellApprovalPanelProps) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  return (
    <div className={`w-full bg-neutral-900/90 border border-neutral-700/60 backdrop-blur-xl shadow-lg overflow-visible
      ${variant === 'modern' ? 'rounded-2xl rounded-b-none border-b-0' : 'rounded-xl rounded-b-none border-b-0'}
    `}>
      <div className="px-4 py-3 flex items-center gap-3">

        {/* Left: command */}
        <div
          className="flex-1 min-w-0 bg-neutral-950/60 border border-neutral-700/40 rounded-xl px-3 py-2 cursor-pointer"
          onClick={() => setExpanded(e => !e)}
          title={command}
        >
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-mono text-[11px] flex-shrink-0">$</span>
            <span className="text-slate-200 font-mono text-[11px] truncate">{command}</span>
            {command.length > 60 && (
              <svg className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
          {expanded && (
            <div className="mt-2 text-slate-300 font-mono text-[11px] whitespace-pre-wrap break-all border-t border-neutral-700/40 pt-2">
              {command}
            </div>
          )}
        </div>

        {/* Right: Deny + Accept (with dropdown) */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Deny */}
          <button
            onClick={() => window.koda.shellResponse(false, false, false)}
            className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-rose-400 text-[10px] font-bold hover:bg-rose-900/20 hover:border-rose-500/50 transition-all active:scale-95"
          >
            Deny
          </button>

          {/* Accept + dropdown */}
          <div className="flex items-stretch rounded-md border border-emerald-500/50 relative" ref={dropdownRef}>
            <button
              onClick={() => window.koda.shellResponse(true, false, false)}
              className="px-3 py-1 bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-400 text-[10px] font-bold transition-all active:bg-emerald-600/80 rounded-l-[5px]"
            >
              Accept
            </button>
            <button
              onClick={() => setShowDropdown(d => !d)}
              className={`px-2 flex items-center justify-center transition-colors rounded-r-[5px] ${showDropdown ? 'bg-emerald-500/40 text-white' : 'bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-400 border-l border-emerald-500/30'}`}
            >
              <svg className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div className="absolute right-0 bottom-full mb-1.5 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-[200] overflow-hidden animate-in slide-in-from-bottom-1 duration-200">
                <button
                  onClick={async () => {
                    await window.koda.shellResponse(true, true, false)
                    await persistApprovedCommand('base', baseCommand)
                    setShowDropdown(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-emerald-900/20 transition-colors flex flex-col gap-0.5 border-b border-slate-700/30"
                >
                  <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1.5">
                    <span className="text-xs">⚡</span> Accept Base Command
                  </span>
                  <span className="text-[9px] text-slate-500 ml-5 opacity-70">
                    Always allow "<code className="bg-slate-950 px-1 rounded">{baseCommand}</code>" this session
                  </span>
                </button>

                <button
                  onClick={async () => {
                    await window.koda.shellResponse(true, false, true)
                    await persistApprovedCommand('full', command)
                    setShowDropdown(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-emerald-900/20 transition-colors flex flex-col gap-0.5 border-b border-slate-700/30"
                >
                  <span className="text-cyan-400 font-bold text-[11px] flex items-center gap-1.5">
                    <span className="text-xs">🚀</span> Accept Full Command
                  </span>
                  <span className="text-[9px] text-slate-500 ml-5 opacity-70 line-clamp-1">
                    Always allow "<code className="bg-slate-950 px-1 rounded">{command}</code>"
                  </span>
                </button>

                <button
                  onClick={() => { window.koda.shellResponse(true, false, false); setShowDropdown(false) }}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-700/50 transition-colors"
                >
                  <span className="text-slate-300 font-bold text-[11px] flex items-center gap-1.5">
                    <span>✔</span> Accept Once
                  </span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
})

ShellApprovalPanel.displayName = 'ShellApprovalPanel'

export default ShellApprovalPanel
