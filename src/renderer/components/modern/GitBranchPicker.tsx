import React, { useEffect, useRef, useState } from 'react'

interface GitBranchPickerProps {
  cwd: string
  onCheckout?: (branch: string) => void
}

export const GitBranchPicker: React.FC<GitBranchPickerProps> = ({ cwd, onCheckout }) => {
  const [branch, setBranch] = useState<string | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!cwd) return
    window.koda.gitInfo(cwd).then(res => {
      if (res.success && res.branch) {
        setBranch(res.branch)
        setBranches(res.branches)
      } else {
        setBranch(null)
        setBranches([])
      }
    })
  }, [cwd])

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!branch) return null

  const handleCheckout = async (target: string) => {
    if (target === branch) { setOpen(false); return }
    setSwitching(true)
    setOpen(false)
    const res = await window.koda.gitCheckout(cwd, target)
    if (res.success) {
      setBranch(target)
      onCheckout?.(target)
    }
    setSwitching(false)
  }

  return (
    <div ref={ref} className="relative flex items-center">
      {/* Divisória */}
      <span className="text-zinc-600 text-[13px] mx-1.5 select-none">/</span>

      {/* Branch button */}
      <button
        onClick={() => branches.length > 1 && setOpen(o => !o)}
        className={`flex items-center gap-1 group transition-colors ${branches.length > 1 ? 'cursor-pointer' : 'cursor-default'}`}
        title={branches.length > 1 ? 'Switch branch' : branch}
      >
        {/* Git branch icon */}
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 transition-colors ${switching ? 'text-amber-400 animate-pulse' : 'text-zinc-600 group-hover:text-indigo-400'}`}
        >
          <line x1="6" y1="3" x2="6" y2="15"/>
          <circle cx="18" cy="6" r="3"/>
          <circle cx="6" cy="18" r="3"/>
          <path d="M18 9a9 9 0 0 1-9 9"/>
        </svg>
        <span className={`text-[11px] font-semibold transition-colors ${switching ? 'text-amber-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
          {switching ? 'Switching...' : branch}
        </span>
        {branches.length > 1 && (
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[9999] animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 border-b border-white/5">
            Switch Branch
          </div>
          <div className="max-h-52 overflow-y-auto custom-scrollbar py-1">
            {branches.map(b => (
              <button
                key={b}
                onClick={() => handleCheckout(b)}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                  b === branch
                    ? 'text-indigo-400 bg-indigo-500/10'
                    : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                <svg
                  width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="shrink-0 opacity-60"
                >
                  <line x1="6" y1="3" x2="6" y2="15"/>
                  <circle cx="18" cy="6" r="3"/>
                  <circle cx="6" cy="18" r="3"/>
                  <path d="M18 9a9 9 0 0 1-9 9"/>
                </svg>
                <span className="text-[11px] font-medium truncate">{b}</span>
                {b === branch && (
                  <span className="ml-auto text-[9px] text-indigo-400 font-bold shrink-0">current</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
