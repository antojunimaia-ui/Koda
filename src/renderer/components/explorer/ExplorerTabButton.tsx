import React, { useState, useRef, useEffect } from 'react'
import { ExplorerPosition, ExplorerTabButtonProps } from './types.js'

export const ExplorerTabButton: React.FC<ExplorerTabButtonProps> = ({
  active,
  onClick,
  position,
  onMoveTo,
  variant = 'panel',
}) => {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const folderSvg = (size: number) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )

  const btn = variant === 'panel' ? (
    <button onClick={onClick} onContextMenu={onContextMenu}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${active ? 'bg-white/8 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
      title="Explorer (right-click to move)">
      {folderSvg(10)} Explorer
    </button>
  ) : variant === 'iconbar' ? (
    <button onClick={onClick} onContextMenu={onContextMenu}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${active ? 'bg-amber-500/10 text-amber-400' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
      title="Explorer (right-click to move)">
      {folderSvg(16)}
    </button>
  ) : (
    <button onClick={onClick} onContextMenu={onContextMenu}
      className={`w-7 h-7 flex items-center justify-center rounded transition-all no-drag ml-1 ${active ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-amber-400 hover:bg-white/5'}`}
      title="Explorer (right-click to move)">
      {folderSvg(14)}
    </button>
  )

  const LOCATIONS: { id: ExplorerPosition; label: string; icon: React.ReactNode }[] = [
    { id: 'panel', label: 'Context Panel', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
    { id: 'iconbar', label: 'Iconbar', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="4" height="18" rx="1"/><path d="M7 12h14"/></svg> },
    { id: 'titlebar', label: 'Title Bar', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M12 7v14"/></svg> },
  ]

  return (
    <>
      {btn}
      {menu && (
        <div ref={menuRef} className="fixed z-[9999] bg-[#141414] border border-white/10 rounded-xl shadow-2xl py-1 w-52" style={{ top: menu.y, left: menu.x }}>
          <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-600">Move to</div>
          {LOCATIONS.map(loc => (
            <button key={loc.id} onClick={() => { onMoveTo(loc.id); setMenu(null) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${position === loc.id ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300 hover:bg-white/5'}`}>
              {loc.icon}
              {loc.label}
              {position === loc.id && <span className="ml-auto text-[9px] text-indigo-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
