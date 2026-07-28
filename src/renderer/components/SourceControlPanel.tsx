import React, { useEffect, useState, useCallback, useRef } from 'react'
import { getIconForFile } from 'vscode-icons-js'

interface GitFile {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
  unstaged: boolean
}

interface GitCommit {
  hash: string
  shortHash: string
  message: string
  body?: string
  author: string
  date: string
  fullDate?: string
  branch: string | null
  insertions?: number
  deletions?: number
  filesChanged?: number
}

interface SourceControlPanelProps {
  cwd: string
  onStartResize: (e: React.MouseEvent) => void
  isResizing: boolean
  width: number
}

const STATUS_COLOR: Record<string, string> = {
  modified:  'text-amber-400',
  added:     'text-emerald-400',
  deleted:   'text-rose-400',
  renamed:   'text-sky-400',
  untracked: 'text-slate-400',
}

const STATUS_LETTER: Record<string, string> = {
  modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: 'U',
}

// ── Avatar initials ──────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-sky-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
]
function avatarColor(name: string) {
  let n = 0; for (const c of name) n += c.charCodeAt(0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── File row ─────────────────────────────────────────────────────────────────
const FileRow: React.FC<{
  file: GitFile; cwd: string
  onStage: (p: string) => void; onUnstage: (p: string) => void
}> = ({ file, cwd, onStage, onUnstage }) => {
  const name = file.path.split(/[/\\]/).pop() || file.path
  const rel  = file.path.replace(cwd.replace(/\\/g, '/'), '').replace(/^[/\\]/, '')
  return (
    <div className="group flex items-center gap-2 px-3 py-[5px] hover:bg-white/5 rounded-md transition-colors cursor-default" title={file.path}>
      <img src={`https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons/icons/${getIconForFile(name)}`} width="14" height="14" className="shrink-0 object-contain opacity-80" alt={name} />
      <span className="flex-1 text-[11px] text-slate-400 group-hover:text-slate-200 truncate transition-colors">{rel}</span>
      <span className={`text-[10px] font-black w-3 text-right shrink-0 ${STATUS_COLOR[file.status] || 'text-slate-500'}`}>{STATUS_LETTER[file.status] || '?'}</span>
      <button onClick={() => file.staged ? onUnstage(file.path) : onStage(file.path)} className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-slate-200" title={file.staged ? 'Unstage' : 'Stage'}>
        {file.staged
          ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        }
      </button>
    </div>
  )
}

// ── Main Panel ───────────────────────────────────────────────────────────────
const SourceControlPanel: React.FC<SourceControlPanelProps> = ({ cwd, onStartResize, isResizing, width }) => {
  const [files, setFiles]                 = useState<GitFile[]>([])
  const [message, setMessage]             = useState('')
  const [loading, setLoading]             = useState(false)
  const [syncing, setSyncing]             = useState(false)
  const [committing, setCommitting]       = useState(false)
  const [error, setError]                 = useState('')
  const [isGitRepo, setIsGitRepo]         = useState(true)
  const [justCommitted, setJustCommitted] = useState(false)
  const [showMenu, setShowMenu]           = useState(false)
  const [commits, setCommits]             = useState<GitCommit[]>([])
  const [currentBranch, setCurrentBranch] = useState('')
  const [graphOpen, setGraphOpen]           = useState(true)
  const [scHeight, setScHeight]             = useState(50) // % height for source control section
  const [isDraggingDivider, setIsDraggingDivider] = useState(false)
  const dividerRef = useRef<HTMLDivElement>(null)
  const innerRef   = useRef<HTMLDivElement>(null)
  const [hoveredCommit, setHoveredCommit]   = useState<{ commit: GitCommit; y: number } | null>(null)
  const hoverTimeout                         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuRef   = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const panelRef  = useRef<HTMLDivElement>(null)
  const [popoverHeight, setPopoverHeight]   = useState(480)

  const refresh = useCallback(async () => {
    if (!cwd || cwd === '...') return
    setLoading(true); setError('')
    const res = await window.koda.gitStatus(cwd)
    if (res.success) {
      setIsGitRepo(true)
      setFiles(res.files as GitFile[])
      if (justCommitted && (res.files as GitFile[]).length > 0) setJustCommitted(false)
    } else { setIsGitRepo(false); setFiles([]) }
    const log = await (window.koda as any).gitLog(cwd)
    if (log.success) { setCommits(log.commits as GitCommit[]); setCurrentBranch(log.currentBranch || '') }
    setLoading(false)
  }, [cwd, justCommitted])

  useEffect(() => { refresh() }, [refresh])

  // Measure popover height after render to correct clamping
  useEffect(() => {
    if (!hoveredCommit || !detailRef.current) return
    const h = detailRef.current.getBoundingClientRect().height
    if (h > 0) setPopoverHeight(h)
  })

  // Close dropdown on outside click
  useEffect(() => {
    if (!showMenu) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [showMenu])

  const handleCommitMouseEnter = (commit: GitCommit, e: React.MouseEvent) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const panelRect = panelRef.current?.getBoundingClientRect()
    const y = rect.top - (panelRect?.top ?? 0)
    setHoveredCommit({ commit, y })
  }

  const handleCommitMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setHoveredCommit(null), 120)
  }

  const handlePopoverMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
  }

  const handlePopoverMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setHoveredCommit(null), 120)
  }

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingDivider(true)
    const startY = e.clientY
    const startPct = scHeight
    const totalH = innerRef.current?.getBoundingClientRect().height ?? 1
    const onMove = (ev: MouseEvent) => {
      const delta = ((ev.clientY - startY) / totalH) * 100
      setScHeight(Math.min(80, Math.max(20, startPct + delta)))
    }
    const onUp = () => {
      setIsDraggingDivider(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const staged   = files.filter(f => f.staged)
  const unstaged = files.filter(f => f.unstaged && !f.staged)

  const handleStage    = async (p: string) => { await window.koda.gitStage(cwd, p); refresh() }
  const handleUnstage  = async (p: string) => { await window.koda.gitUnstage(cwd, p); refresh() }
  const handleStageAll = async () => { await window.koda.gitStageAll(cwd); refresh() }

  const handleCommit = async () => {
    if (!message.trim()) return
    setCommitting(true); setError('')
    const res = await window.koda.gitCommit(cwd, message)
    if (res.success) { setMessage(''); setJustCommitted(true); refresh() }
    else setError(res.error || 'Commit failed')
    setCommitting(false)
  }

  const handleSync = async () => {
    setSyncing(true); setError('')
    const pull = await window.koda.gitPull(cwd)
    if (!pull.success) { setError(pull.error || 'Pull failed'); setSyncing(false); return }
    const push = await window.koda.gitPush(cwd)
    if (!push.success) { setError(push.error || 'Push failed'); setSyncing(false); return }
    setJustCommitted(false); setSyncing(false); refresh()
  }

  const handleCommitAndPush = async () => {
    setShowMenu(false)
    if (!message.trim() || staged.length === 0) return
    setCommitting(true); setError('')
    const res = await window.koda.gitCommit(cwd, message)
    if (!res.success) { setError(res.error || 'Commit failed'); setCommitting(false); return }
    setMessage(''); setCommitting(false)
    await handleSync()
  }

  const isDisabled = !message.trim() || committing || syncing || staged.length === 0

  const menuItems = [
    { label: 'Commit',          action: () => { setShowMenu(false); handleCommit() } },
    { label: 'Commit & Push',   action: () => { setShowMenu(false); handleCommitAndPush() } },
    { label: 'Commit & Sync',   action: () => { setShowMenu(false); handleCommitAndPush() } },
  ]

  return (
    <div ref={panelRef} className="absolute top-8 bottom-0 right-0 flex bg-[#141414] border-l border-white/5" style={{ width, zIndex: 100 }}>
      {/* Resize handle */}
      <div onMouseDown={onStartResize} className={`w-1 h-full cursor-col-resize shrink-0 transition-colors ${isResizing ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/50'}`} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Source Control</span>
          <button onClick={refresh} className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all" title="Refresh">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        {!isGitRepo ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 px-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700"><circle cx="12" cy="12" r="3"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
            <p className="text-slate-600 text-[10px] text-center leading-relaxed">Not a git repository.<br />Open a project with git initialized.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center flex-1"><span className="text-slate-600 text-[10px]">Loading...</span></div>
        ) : (
          <div ref={innerRef} className="flex-1 flex flex-col overflow-hidden">

            {/* Commit input */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <textarea
                value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Commit message" rows={2}
                className="w-full bg-slate-900 border border-slate-700/60 text-slate-200 text-[11px] rounded-lg px-3 py-2 resize-none outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 custom-scrollbar"
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { justCommitted ? handleSync() : handleCommit() } }}
              />
              <div className="mt-2 relative" ref={menuRef}>
                {justCommitted ? (
                  <button onClick={handleSync} disabled={syncing} className="w-full py-1.5 bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5" title="Pull (rebase) then push">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    {syncing ? 'Syncing...' : 'Sync Changes'}
                  </button>
                ) : (
                  <div className="flex rounded-lg overflow-hidden border border-white/10">
                    <button onClick={handleCommit} disabled={isDisabled} className="flex-1 py-1.5 bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed" title="Commit staged changes (Ctrl+Enter)">
                      {committing ? 'Committing...' : 'Commit'}
                    </button>
                    <div className="w-px bg-white/10 shrink-0" />
                    <button onClick={() => setShowMenu(m => !m)} disabled={isDisabled} className="px-2 py-1.5 bg-white/10 hover:bg-white/15 text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed" title="More actions">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>
                )}
                {showMenu && (
                  <div className="absolute top-full right-0 mt-1 w-44 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    {menuItems.map(item => (
                      <button key={item.label} onClick={item.action} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:bg-white/5 transition-colors">{item.label}</button>
                    ))}
                  </div>
                )}
              </div>
              {error && <p className="text-rose-400 text-[10px] mt-1.5 leading-relaxed">{error}</p>}
            </div>

            {/* ── Source Control section (independent scroll) ── */}
            <div className="overflow-y-auto custom-scrollbar px-1 pb-1" style={{ height: graphOpen && commits.length > 0 ? `${scHeight}%` : undefined, flex: (!graphOpen || commits.length === 0) ? 1 : undefined }}>
              {/* Staged */}
              {staged.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Staged ({staged.length})</span>
                    <button onClick={async () => { for (const f of staged) await window.koda.gitUnstage(cwd, f.path); refresh() }} className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors">unstage all</button>
                  </div>
                  {staged.map(f => <FileRow key={f.path} file={f} cwd={cwd} onStage={handleStage} onUnstage={handleUnstage} />)}
                </div>
              )}

              {/* Changes */}
              {unstaged.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Changes ({unstaged.length})</span>
                    <button onClick={handleStageAll} className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors">stage all</button>
                  </div>
                  {unstaged.map(f => <FileRow key={f.path} file={f} cwd={cwd} onStage={handleStage} onUnstage={handleUnstage} />)}
                </div>
              )}

              {staged.length === 0 && unstaged.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="text-slate-600 text-[10px]">No changes</span>
                </div>
              )}
            </div>

            {/* ── Divider — only visible when Graph is open ── */}
            {commits.length > 0 && graphOpen && (
              <div
                ref={dividerRef}
                onMouseDown={handleDividerMouseDown}
                className={`h-1 w-full cursor-row-resize shrink-0 transition-colors ${isDraggingDivider ? 'bg-indigo-500' : 'bg-white/5 hover:bg-indigo-500/50'}`}
              />
            )}

            {/* ── Graph section (independent scroll) ── */}
            {commits.length > 0 && (
              <div className={`flex flex-col overflow-hidden border-t border-white/5 ${graphOpen ? 'flex-1' : 'shrink-0'}`}>
                {/* Graph header */}
                <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
                  <button onClick={() => setGraphOpen(o => !o)} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${graphOpen ? 'rotate-0' : '-rotate-90'}`}><polyline points="6 9 12 15 18 9"/></svg>
                    Graph
                  </button>
                  <div className="flex items-center gap-0.5">
                    <button onClick={refresh} className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all" title="Fetch / Refresh">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    </button>
                    <button onClick={() => window.koda.gitPull(cwd).then(refresh)} className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all" title="Pull">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                    </button>
                    <button onClick={() => window.koda.gitPush(cwd).then(refresh)} className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all" title="Push">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                    </button>
                  </div>
                </div>

                {graphOpen && (
                  <div className="flex-1 overflow-y-auto custom-scrollbar px-1 pb-3">
                    {commits.map((commit, i) => (
                      <div
                        key={commit.hash}
                        onMouseEnter={(e) => handleCommitMouseEnter(commit, e)}
                        onMouseLeave={handleCommitMouseLeave}
                        className="group w-full flex items-center gap-2 px-2 py-[5px] transition-colors text-left rounded-md hover:bg-white/5 cursor-default"
                      >
                        <div className="flex flex-col items-center shrink-0 self-stretch justify-start pt-[5px]" style={{ width: 12 }}>
                          <div className={`w-2 h-2 rounded-full shrink-0 ring-1 ${i === 0 ? 'bg-indigo-400 ring-indigo-400/40' : 'bg-slate-600 ring-slate-600/40'}`} />
                          {i < commits.length - 1 && <div className="w-px flex-1 bg-slate-700/50 mt-[2px]" />}
                        </div>
                        <span className="flex-1 text-[11px] text-slate-400 group-hover:text-slate-200 truncate transition-colors min-w-0">{commit.message}</span>
                        {commit.branch && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 truncate max-w-16">{commit.branch}</span>
                        )}
                        <div className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-white ${avatarColor(commit.author)}`} title={commit.author}>
                          {initials(commit.author)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Commit hover popover ─────────────────────────────────────────── */}
      {hoveredCommit && (
        <div
          ref={detailRef}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
          className="absolute bg-[#1c1c1c] border border-white/10 rounded-lg flex flex-col z-50 animate-in fade-in duration-100"
          style={{
            right: width + 8,
            top: Math.min(
              Math.max(8, hoveredCommit.y - 16),
              (panelRef.current?.getBoundingClientRect().height ?? window.innerHeight) - popoverHeight - 8
            ),
            width: 480,
            maxHeight: 480,
          }}
        >
          {/* Author + date row */}
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 shrink-0">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0 ${avatarColor(hoveredCommit.commit.author)}`}>
              {initials(hoveredCommit.commit.author)}
            </div>
            <span className="text-indigo-400 text-[11px] font-semibold">{hoveredCommit.commit.author}</span>
            <span className="text-slate-600 text-[10px]">,</span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 shrink-0">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="text-slate-400 text-[10px]">
              {hoveredCommit.commit.date}
              {hoveredCommit.commit.fullDate && (
                <span className="text-slate-500"> ({hoveredCommit.commit.fullDate.slice(0, 10).replace(/-/g, '/')} at {hoveredCommit.commit.fullDate.slice(11, 16)})</span>
              )}
            </span>
          </div>

          {/* Commit subject */}
          <div className="px-4 pb-2.5 shrink-0">
            <p className="text-white text-[13px] font-semibold leading-snug">{hoveredCommit.commit.message}</p>
          </div>

          {/* Commit body — bullet points from multi-line message */}
          {hoveredCommit.commit.body && hoveredCommit.commit.body.trim() && (
            <div className="px-4 pb-2.5 flex-1 overflow-y-auto custom-scrollbar">
              {hoveredCommit.commit.body.trim().split('\n').filter(l => l.trim()).map((line, i) => {
                const isBullet = line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().startsWith('•')
                const text = isBullet ? line.trim().slice(1).trim() : line.trim()
                return (
                  <div key={i} className={`flex items-start gap-2 text-slate-300 text-[11px] leading-relaxed ${i > 0 ? 'mt-1' : ''}`}>
                    <span className="text-slate-500 shrink-0 mt-0.5">•</span>
                    <span>{text}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-white/5 shrink-0">
            {/* stat */}
            {(hoveredCommit.commit.filesChanged ?? 0) > 0 && (
              <span className="text-slate-500 text-[10px]">
                {hoveredCommit.commit.filesChanged} file{hoveredCommit.commit.filesChanged !== 1 ? 's' : ''} changed,{' '}
                <span className="text-emerald-400">{hoveredCommit.commit.insertions} insertion{hoveredCommit.commit.insertions !== 1 ? 's' : ''}(+)</span>
                {(hoveredCommit.commit.deletions ?? 0) > 0 && (
                  <>, <span className="text-rose-400">{hoveredCommit.commit.deletions} deletion{hoveredCommit.commit.deletions !== 1 ? 's' : ''}(-)</span></>
                )}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {/* hash */}
              <button
                onClick={() => navigator.clipboard.writeText(hoveredCommit.commit.hash)}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-[10px] font-mono transition-colors"
                title="Copy full hash"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                {hoveredCommit.commit.shortHash}
              </button>
              <span className="text-slate-700">|</span>
              {/* Open on GitHub */}
              <button
                onClick={() => {
                  window.koda.gitInfo(cwd).then((info: any) => {
                    if (info?.remote) {
                      const base = info.remote.replace(/\.git$/, '').replace('git@github.com:', 'https://github.com/')
                      window.koda.openExternal(`${base}/commit/${hoveredCommit.commit.hash}`)
                    }
                  })
                }}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-[10px] transition-colors"
                title="Open on GitHub"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-indigo-400"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02.005 2.04.138 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>
                Open on GitHub
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SourceControlPanel
