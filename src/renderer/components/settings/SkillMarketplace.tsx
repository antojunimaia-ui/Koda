import React, { useState, useEffect, useCallback } from 'react'

interface MarketplaceSkill {
  name: string
  description: string
  author: string
  version: string
  tags: string[]
  triggers: string[]
  stars?: number
}

interface InstalledSkill {
  name: string
  description: string
  version?: string
  filePath: string
}

type Tab = 'browse' | 'installed'

const SkillMarketplace: React.FC = () => {
  const [tab, setTab] = useState<Tab>('browse')
  const [marketSkills, setMarketSkills] = useState<MarketplaceSkill[]>([])
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [uninstalling, setUninstalling] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadInstalled = useCallback(async () => {
    const res = await window.koda.listSkills()
    if (res.success && res.skills) setInstalledSkills(res.skills as InstalledSkill[])
  }, [])

  const fetchMarketplace = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.koda.marketplaceFetch()
      if (res.success) setMarketSkills(res.skills)
      else setError(res.error || 'Failed to fetch marketplace')
    } catch {
      setError('Could not reach the marketplace. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInstalled()
    fetchMarketplace()
  }, [loadInstalled, fetchMarketplace])

  const isInstalled = (name: string) => installedSkills.some(s => s.name === name)

  const hasUpdate = (skill: MarketplaceSkill) => {
    const installed = installedSkills.find(s => s.name === skill.name)
    if (!installed?.version) return false
    // Simple semver comparison: split by '.' and compare numerically
    const parse = (v: string) => v.split('.').map(Number)
    const [ma, mi, pa] = parse(skill.version)
    const [ib, ic, id] = parse(installed.version)
    return ma > ib || (ma === ib && mi > ic) || (ma === ib && mi === ic && pa > id)
  }

  const handleInstall = async (skill: MarketplaceSkill) => {
    setInstalling(skill.name)
    try {
      const res = await window.koda.marketplaceInstall(skill.name, skill.version)
      if (res.success) {
        await loadInstalled()
        window.dispatchEvent(new CustomEvent('koda:skills-changed'))
        showToast(`✅ "${skill.name}" installed`)
      } else {
        showToast(`❌ ${res.error}`)
      }
    } finally {
      setInstalling(null)
    }
  }

  const handleUninstall = async (name: string) => {
    setUninstalling(name)
    try {
      const res = await window.koda.marketplaceUninstall(name)
      if (res.success) {
        await loadInstalled()
        window.dispatchEvent(new CustomEvent('koda:skills-changed'))
        showToast(`🗑️ "${name}" removed`)
      } else {
        showToast(`❌ ${res.error}`)
      }
    } finally {
      setUninstalling(null)
    }
  }

  const filtered = marketSkills.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase()) ||
    s.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-left-2 duration-300 relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-0 right-0 z-50 bg-slate-800 border border-slate-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          {toast}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <span className="w-1.5 h-4 bg-indigo-400 rounded-full"></span>
          Skills Marketplace
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchMarketplace(); loadInstalled() }}
            disabled={loading}
            className="text-[10px] text-slate-500 hover:text-slate-200 transition-colors font-mono flex items-center gap-1 disabled:opacity-40"
            title="Refresh marketplace"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
            Refresh
          </button>
          <a
            href="https://github.com/antojunimaia-ui/koda-skills"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors font-mono flex items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            koda-skills
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('browse')}
          className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${tab === 'browse' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Browse {marketSkills.length > 0 && <span className="ml-1 opacity-60">({marketSkills.length})</span>}
        </button>
        <button
          onClick={() => setTab('installed')}
          className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${tab === 'installed' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Installed {installedSkills.length > 0 && <span className="ml-1 opacity-60">({installedSkills.length})</span>}
        </button>
      </div>

      {tab === 'browse' && (
        <>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search skills by name, tag..."
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
          />

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-4 justify-center">
              <span className="animate-spin">⠋</span> Fetching marketplace...
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between bg-rose-950/30 border border-rose-500/30 rounded-lg px-4 py-3">
              <span className="text-rose-400 text-xs">{error}</span>
              <button onClick={fetchMarketplace} className="text-[10px] text-rose-400 hover:text-white font-bold underline">Retry</button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-slate-500 text-xs text-center py-8">
              {search ? 'No skills match your search.' : 'No skills in the marketplace yet.'}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {filtered.map(skill => (
              <div key={skill.name} className="flex flex-col gap-2 bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3 hover:border-slate-600 transition-all group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-xs">/{skill.name}</span>
                      <span className="text-[9px] text-slate-500 font-mono">v{skill.version}</span>
                      {isInstalled(skill.name) && !hasUpdate(skill) && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">installed</span>
                      )}
                      {hasUpdate(skill) && (
                        <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold animate-pulse">↑ update</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{skill.description}</p>
                  </div>
                  <button
                    onClick={() => isInstalled(skill.name) && !hasUpdate(skill) ? handleUninstall(skill.name) : handleInstall(skill)}
                    disabled={installing === skill.name || uninstalling === skill.name}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      hasUpdate(skill)
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                        : isInstalled(skill.name)
                          ? 'bg-slate-700 text-slate-400 hover:bg-rose-900/30 hover:text-rose-400 hover:border-rose-500/30 border border-slate-600'
                          : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {installing === skill.name || uninstalling === skill.name
                      ? '...'
                      : hasUpdate(skill)
                        ? '↑ Update'
                        : isInstalled(skill.name)
                          ? 'Remove'
                          : 'Install'
                    }
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {skill.tags.map(tag => (
                      <span key={tag} className="text-[9px] bg-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded font-mono">{tag}</span>
                    ))}
                  </div>
                  <span className="text-[9px] text-slate-600 flex-shrink-0">by {skill.author}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'installed' && (
        <div className="flex flex-col gap-2">
          {installedSkills.length === 0 && (
            <div className="text-slate-500 text-xs text-center py-8">
              No skills installed. Browse the marketplace to find some.
            </div>
          )}
          {installedSkills.map(skill => (
            <div key={skill.name} className="flex items-center justify-between gap-3 bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-xs">/{skill.name}</span>
                  {skill.version && <span className="text-[9px] text-slate-500 font-mono">v{skill.version}</span>}
                </div>
                {skill.description && <p className="text-slate-400 text-[11px]">{skill.description}</p>}
                <p className="text-[9px] text-slate-600 font-mono truncate max-w-xs">{skill.filePath}</p>
              </div>
              <button
                onClick={() => handleUninstall(skill.name)}
                disabled={uninstalling === skill.name}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-700 text-slate-400 hover:bg-rose-900/30 hover:text-rose-400 border border-slate-600 hover:border-rose-500/30 transition-all disabled:opacity-40"
              >
                {uninstalling === skill.name ? '...' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SkillMarketplace
