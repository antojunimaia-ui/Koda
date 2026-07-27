import React, { useEffect, useState, useCallback } from 'react'
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
          // minus
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        ) : (
          // plus
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        )}
      </button>
    </div>
  )
}

const SourceControlPanel: React.FC<SourceControlPanelProps> = ({ cwd, onStartResize, isResizing, width }) => {
  const [files, setFiles]         = useState<GitFile[]>([])
  const [message, setMessage]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [pushing, setPushing]     = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError]         = useState('')
  const [isGitRepo, setIsGitRepo] = useState(true)

  const refresh = useCallback(async () => {
    if (!cwd || cwd === '...') return
    setLoading(true)
    setError('')
    const res = await window.koda.gitStatus(cwd)
    if (res.success) {
      setIsGitRepo(true)
      setFiles(res.files as GitFile[])
    } else {
      setIsGitRepo(false)
      setFiles([])
    }
    setLoading(false)
  }, [cwd])

  useEffect(() => { refresh() }, [refresh])

  const staged   = files.filter(f => f.staged)
  const unstaged = files.filter(f => f.unstaged && !f.staged)

  const handleStage = async (path: string) => {
    await window.koda.gitStage(cwd, path)
    refresh()
  }

  const handleUnstage = async (path: string) => {
    await window.koda.gitUnstage(cwd, path)
    refresh()
  }

  const handleStageAll = async () => {
    await window.koda.gitStageAll(cwd)
    refresh()
  }

  const handleCommit = async () => {
    if (!message.trim()) return
    setCommitting(true)
    setError('')
    const res = await window.koda.gitCommit(cwd, message)
    if (res.success) {
      setMessage('')
      refresh()
    } else {
      setError(res.error || 'Commit failed')
    }
    setCommitting(false)
  }

  const handlePush = async () => {
    setPushing(true)
    setError('')
    const res = await window.koda.gitPush(cwd)
    if (!res.success) setError(res.error || 'Push failed')
    setPushing(false)
  }

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

            {/* Commit input */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Commit message"
                rows={2}
                className="w-full bg-slate-900 border border-slate-700/60 text-slate-200 text-[11px] rounded-lg px-3 py-2 resize-none outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 custom-scrollbar"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommit()
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleCommit}
                  disabled={!message.trim() || committing || staged.length === 0}
                  className="flex-1 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] font-bold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Commit staged changes (Ctrl+Enter)"
                >
                  {committing ? 'Committing...' : 'Commit'}
                </button>
                <button
                  onClick={handlePush}
                  disabled={pushing}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Push to remote"
                >
                  {pushing ? '...' : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                    </svg>
                  )}
                </button>
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
                      title="Unstage all"
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
                    <button
                      onClick={handleStageAll}
                      className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
                      title="Stage all"
                    >stage all</button>
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
