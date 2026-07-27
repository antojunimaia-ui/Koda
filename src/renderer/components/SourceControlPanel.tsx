import React, { useEffect, useState, useCallback, useRef } from 'react'
import { getIconForFile } from 'vscode-icons-js'

interface GitFile {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
  unstaged: boolean
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
  modified:  'M',
  added:     'A',
  deleted:   'D',
  renamed:   'R',
  untracked: 'U',
}

const FileRow: React.FC<{
  file: GitFile
  cwd: string
  onStage: (path: string) => void
  onUnstage: (path: string) => void
}> = ({ file, cwd, onStage, onUnstage }) => {
  const name = file.path.split(/[/\\]/).pop() || file.path
  const rel  = file.path.replace(cwd.replace(/\\/g, '/'), '').replace(/^[/\\]/, '')
  const icon = getIconForFile(name)

  return (
    <div className="group flex items-center gap-2 px-3 py-[5px] hover:bg-white/5 rounded-md transition-colors cursor-default" title={file.path}>
      <img
        src={`https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons/icons/${icon}`}
        width="14" height="14"
        className="shrink-0 object-contain opacity-80"
        alt={name}
      />
      <span className="flex-1 text-[11px] text-slate-400 group-hover:text-slate-200 truncate transition-colors">
        {rel}
      </span>
      <span className={`text-[10px] font-black w-3 text-right shrink-0 ${STATUS_COLOR[file.status] || 'text-slate-500'}`}>
        {STATUS_LETTER[file.status] || '?'}
      </span>
      <button
        onClick={() => file.staged ? onUnstage(file.path) : onStage(file.path)}
        className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-slate-200"
        title={file.staged ? 'Unstage' : 'Stage'}
      >
        {file.staged ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        )}
      </button>
    </div>
  )
}

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
  const menuRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    if (!cwd || cwd === '...') return
    setLoading(true)
    setError('')
    const res = await window.koda.gitStatus(cwd)
    if (res.success) {
      setIsGitRepo(true)
      setFiles(res.files as GitFile[])
      if (justCommitted && (res.files as GitFile[]).length > 0) setJustCommitted(false)
    } else {
      setIsGitRepo(false)
      setFiles([])
    }
    setLoading(false)
  }, [cwd, justCommitted])

  useEffect(() => { refresh() }, [refresh])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const staged   = files.filter(f => f.staged)
  const unstaged = files.filter(f => f.unstaged && !f.staged)

  const handleStage    = async (path: string) => { await window.koda.gitStage(cwd, path); refresh() }
  const handleUnstage  = async (path: string) => { await window.koda.gitUnstage(cwd, path); refresh() }
  const handleStageAll = async () => { await window.koda.gitStageAll(cwd); refresh() }

  const handleCommit = async () => {
    if (!message.trim()) return
    setCommitting(true)
    setError('')
    const res = await window.koda.gitCommit(cwd, message)
    if (res.success) {
      setMessage('')
      setJustCommitted(true)
      refresh()
    } else {
      setError(res.error || 'Commit failed')
    }
    setCommitting(false)
  }

  const handleSync = async () => {
    setSyncing(true)
    setError('')
    const pull = await window.koda.gitPull(cwd)
    if (!pull.success) { setError(pull.error || 'Pull failed'); setSyncing(false); return }
    const push = await window.koda.gitPush(cwd)
    if (!push.success) { setError(push.error || 'Push failed'); setSyncing(false); return }
    setJustCommitted(false)
    setSyncing(false)
    refresh()
  }

  const handleCommitAndPush = async () => {
    setShowMenu(false)
    if (!message.trim() || staged.length === 0) return
    setCommitting(true)
    setError('')
    const res = await window.koda.gitCommit(cwd, message)
    if (!res.success) { setError(res.error || 'Commit failed'); setCommitting(false); return }
    setMessage('')
    setCommitting(false)
    await handleSync()
  }

  const handleCommitAndSync = handleCommitAndPush

  const isDisabled = !message.trim() || committing || syncing || staged.length === 0

  const menuItems = [
    { label: 'Commit', action: () => { setShowMenu(false); handleCommit() } },
    { label: 'Commit & Push', action: () => { setShowMenu(false); handleCommitAndPush() } },
    { label: 'Commit & Sync', action: () => { setShowMenu(false); handleCommitAndSync() } },
  ]

  return (
    <div
      className="absolute top-8 bottom-0 right-0 flex bg-[#141414] border-l border-white/5"
      style={{ width, zIndex: 100 }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={onStartResize}
        className={`w-1 h-full cursor-col-resize shrink-0 transition-colors ${isResizing ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/50'}`}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Source Control</span>
          <button
            onClick={refresh}
            className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"
            title="Refresh"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        {!isGitRepo ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 px-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
              <circle cx="12" cy="12" r="3"/><line x1="3" y1="3" x2="21" y2="21"/>
            </svg>
            <p className="text-slate-600 text-[10px] text-center leading-relaxed">
              Not a git repository.<br />Open a project with git initialized.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center flex-1">
            <span className="text-slate-600 text-[10px]">Loading...</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Commit input + action button */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Commit message"
                rows={2}
                className="w-full bg-slate-900 border border-slate-700/60 text-slate-200 text-[11px] rounded-lg px-3 py-2 resize-none outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 custom-scrollbar"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    justCommitted ? handleSync() : handleCommit()
                  }
                }}
              />

              <div className="mt-2 relative" ref={menuRef}>
                {justCommitted ? (
                  // Sync Changes button (after commit)
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    title="Pull (rebase) then push"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    {syncing ? 'Syncing...' : 'Sync Changes'}
                  </button>
                ) : (
                  // Commit button + More Actions chevron
                  <div className="flex rounded-lg overflow-hidden border border-indigo-500/20">
                    <button
                      onClick={handleCommit}
                      disabled={isDisabled}
                      className="flex-1 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Commit staged changes (Ctrl+Enter)"
                    >
                      {committing ? 'Committing...' : 'Commit'}
                    </button>
                    <div className="w-px bg-indigo-500/20 shrink-0" />
                    <button
                      onClick={() => setShowMenu(m => !m)}
                      disabled={isDisabled}
                      className="px-2 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="More actions"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                  </div>
                )}

                {/* Dropdown menu */}
                {showMenu && (
                  <div className="absolute bottom-full right-0 mb-1 w-44 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-1 duration-150">
                    {menuItems.map(item => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:bg-white/5 transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && <p className="text-rose-400 text-[10px] mt-1.5 leading-relaxed">{error}</p>}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-1 pb-3">

              {/* Staged */}
              {staged.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Staged ({staged.length})</span>
                    <button
                      onClick={async () => { for (const f of staged) await window.koda.gitUnstage(cwd, f.path); refresh() }}
                      className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
                    >unstage all</button>
                  </div>
                  {staged.map(f => (
                    <FileRow key={f.path} file={f} cwd={cwd} onStage={handleStage} onUnstage={handleUnstage} />
                  ))}
                </div>
              )}

              {/* Changes */}
              {unstaged.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Changes ({unstaged.length})</span>
                    <button onClick={handleStageAll} className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors">stage all</button>
                  </div>
                  {unstaged.map(f => (
                    <FileRow key={f.path} file={f} cwd={cwd} onStage={handleStage} onUnstage={handleUnstage} />
                  ))}
                </div>
              )}

              {staged.length === 0 && unstaged.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="text-slate-600 text-[10px]">No changes</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SourceControlPanel
