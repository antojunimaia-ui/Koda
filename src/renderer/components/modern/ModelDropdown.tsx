import React, { useEffect, useRef, useState } from 'react'
import { formatModelName } from '../../utils/formatModelName.js'

interface ModelOption {
  providerId: string
  providerName: string
  model: string
  advisorModel: string
  apiKey: string
  availableModels: string[]
}

interface ModelDropdownProps {
  currentProviderId: string
  currentModel: string
  options: ModelOption[]
  onSelect: (providerId: string, model: string, advisorModel: string, apiKey: string) => void
  onManageProviders: () => void
  onFetchModels?: (providerId: string, apiKey: string) => void
}

export const ModelDropdown: React.FC<ModelDropdownProps> = ({
  currentProviderId,
  currentModel,
  options,
  onSelect,
  onManageProviders,
  onFetchModels,
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Fecha no Esc
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setSearch('') }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Foca o search ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50)
      // Busca modelos do provider atual ao abrir
      const activeOpt = options.find(o => o.providerId === currentProviderId)
      if (activeOpt && onFetchModels) {
        onFetchModels(activeOpt.providerId, activeOpt.apiKey)
      }
    }
  }, [open])

  const displayName = formatModelName(currentModel)

  // Monta a lista filtrada agrupada por provider
  const filtered = options
    .map(opt => {
      const base = opt.availableModels?.length > 0 ? opt.availableModels : [opt.model]
      const models = Array.from(new Set([
        ...(!base.includes(opt.model) ? [opt.model] : []),
        ...base,
      ]))

      const q = search.toLowerCase()
      const matchingModels = q
        ? models.filter(m =>
            formatModelName(m).toLowerCase().includes(q) ||
            m.toLowerCase().includes(q) ||
            opt.providerName.toLowerCase().includes(q)
          )
        : models

      return { ...opt, models: matchingModels }
    })
    .filter(opt => opt.models.length > 0)

  return (
    <div ref={containerRef} className="relative flex items-center shrink-0">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-[12px] font-sans transition-colors cursor-pointer"
      >
        <span>{displayName}</span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`text-zinc-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#1c1c1c] border border-white/10 rounded-lg shadow-none overflow-hidden z-[9999] animate-in fade-in slide-in-from-bottom-1 duration-150">

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 shrink-0">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search models..."
              className="flex-1 bg-transparent text-[12px] text-white placeholder:text-zinc-600 outline-none font-sans"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Model list */}
          <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-zinc-600 text-[11px]">No models found</div>
            ) : (
              filtered.map(opt => (
                <div key={opt.providerId}>
                  {/* Provider label */}
                  <div className="px-3 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-zinc-600">
                    {opt.providerName}
                  </div>
                  {opt.models.map(m => {
                    const isActive = m === currentModel && opt.providerId === currentProviderId
                    return (
                      <button
                        key={`${opt.providerId}-${m}`}
                        onClick={() => {
                          onSelect(opt.providerId, m, opt.advisorModel, opt.apiKey)
                          setOpen(false)
                          setSearch('')
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                          isActive
                            ? 'text-white bg-white/5'
                            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="text-[13px] font-medium">{formatModelName(m)}</span>
                        {isActive && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400 shrink-0">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer — Gerenciar provedores */}
          <div className="border-t border-white/5">
            <button
              onClick={() => { onManageProviders(); setOpen(false); setSearch('') }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/>
                <circle cx="2" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="8" cy="18" r="1"/>
              </svg>
              <span className="text-[12px] font-medium">Gerenciar provedores</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
