import React, { useState, useEffect, useRef, memo } from 'react'
import { MessageEntry, KodaSettings, AgentInfo } from '../../types/index.js'
import DiffViewer from '../diff/DiffViewer.js'
import ansi from '../../utils/ansi.js'

// Persist an approved command to localStorage and sync to main process
const persistApprovedCommand = async (type: 'base' | 'full', command: string) => {
  const key = type === 'base' ? 'koda_approved_base' : 'koda_approved_full'
  const current = JSON.parse(localStorage.getItem(key) || '[]')
  const updated = [...new Set([...current, command])]
  localStorage.setItem(key, JSON.stringify(updated))

  const base = JSON.parse(localStorage.getItem('koda_approved_base') || '[]')
  const full = JSON.parse(localStorage.getItem('koda_approved_full') || '[]')
  await window.koda.updateApprovedCommands({ base, full })
}

const TOOL_ICONS: Record<string, string> = {
  file_read:           '👁',
  file_edit:           '✏️',
  file_write:          '💾',
  list_dir:            '📂',
  file_find:           '🔍',
  search:              '🔎',
  shell:               '⚡',
  shell_wait:          '⏱️',
  lsp_query:           '🧠',
  browser_agent:       '🌐',
  enter_plan_mode:     '📋',
  exit_plan_mode:      '📋',
  start_collaboration: '🤝',
  send_to_advisor:     '💬',
  end_collaboration:   '🤝',
  load_skill:          '🎯',
  get_diagnostics:     '🩺',
}

const symbols = {
  check: '✔',
  cross: '✖',
}

interface ToolMessageProps {
  tool: MessageEntry['tool']
  settings: KodaSettings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agentInfo: AgentInfo | any
  uiMode?: 'classic' | 'modern'
}

const ToolMessage = memo(({ tool, settings, agentInfo, uiMode = 'classic' }: ToolMessageProps) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  const isOutputVisible = (
    (tool?.name === 'shell' && settings.showTerminal) ||
    (tool?.name === 'shell_wait' && settings.showShellWait) ||
    (tool?.name === 'file_read' && settings.showFileRead) ||
    (tool?.name === 'file_edit' && settings.showFileEdit) ||
    (tool?.name === 'file_write' && settings.showFileWrite) ||
    (tool?.name === 'list_dir' && settings.showListDir) ||
    (tool?.name === 'file_find' && settings.showFileFind) ||
    (tool?.name === 'search' && settings.showSearch) ||
    (tool?.name === 'lsp_query' && settings.showLspQuery) ||
    (tool?.name === 'browser_agent' && settings.showBrowserAgent) ||
    (['enter_plan_mode', 'exit_plan_mode'].includes(tool?.name || '') && settings.showPlanMode) ||
    (['start_collaboration', 'send_to_advisor', 'end_collaboration'].includes(tool?.name || '') && settings.showColab) ||
    (!['shell', 'shell_wait', 'file_read', 'file_edit', 'file_write', 'list_dir', 'file_find', 'search', 'lsp_query', 'browser_agent', 'enter_plan_mode', 'exit_plan_mode', 'start_collaboration', 'send_to_advisor', 'end_collaboration'].includes(tool?.name || ''))
  )

  const isRunning = tool?.status === 'running' || tool?.status === 'writing'

  const stats = tool?.name === 'file_edit' ? (() => {
    let plus = 0, minus = 0
    tool.output?.split('\n').forEach((l: string) => {
      if (l.startsWith('+') && !l.startsWith('+++')) plus++
      else if (l.startsWith('-') && !l.startsWith('---')) minus++
    })
    return { plus, minus }
  })() : null

  const resolveLabel = () => {
    const isDone = tool?.status === 'done'
    const isModern = uiMode === 'modern'
    
    // Determine prefix (Only for Modern UI)
    let prefix = ''
    if (isModern) {
      if (tool?.name === 'file_edit' || tool?.name === 'file_write') {
        if (tool?.name === 'file_write' && tool?.isNew) {
          prefix = isDone ? 'Created: ' : 'Creating: '
        } else {
          prefix = isDone ? 'Edited: ' : 'Editing: '
        }
      } else if (tool?.name === 'file_read' || tool?.name === 'list_dir') {
        prefix = isDone ? 'Analyzed: ' : 'Analyzing: '
      } else if (tool?.name === 'shell' || tool?.name === 'shell_wait') {
        prefix = isDone ? 'Ran: ' : 'Running: '
      } else {
        prefix = isDone ? 'Finished: ' : 'Executing: '
      }
    }
    // Determine value (Original logic)
    let value = tool?.name || ''
    if (tool?.name === 'list_dir') {
      const cwd = agentInfo?.cwd || ''
      const p = tool?.args?.path
      if (!p || p === '.') value = cwd
      else if (p.startsWith('/') || p.match(/^[a-zA-Z]:[\\/]/)) value = p
      else {
        const sep = cwd.includes('\\') ? '\\' : '/'
        const cleanP = p.replace(/^\.\//, '')
        value = cwd.endsWith(sep) ? cwd + cleanP : cwd + sep + cleanP
      }
    } else if (tool?.name === 'file_read' || tool?.name === 'file_edit' || tool?.name === 'file_write') {
      value = tool?.args?.path?.split(/[/\\]/).pop() || tool?.args?.path || tool?.name
    } else if (tool?.name === 'shell') {
      value = tool?.command || tool?.args?.command || tool?.name
    }

    return { prefix, value }
  }

  const { prefix, value } = resolveLabel()

  return (
    <div className="flex flex-col ml-4 gap-2 my-2 border-l-2 border-slate-700/50 pl-3 py-1">
      <div className="flex items-center gap-2">
        <span
          className={isRunning ? 'animate-pulse' : ''}
          title={tool?.name}
          style={{ fontSize: '14px', lineHeight: 1 }}
        >
          {TOOL_ICONS[tool?.name || ''] ?? '⚙️'}
        </span>
        <span 
          className={`text-white font-mono text-[13px] bg-slate-800/80 px-2 py-0.5 rounded shadow-sm border border-slate-700/50 flex items-center ${isRunning && uiMode === 'modern' ? 'shimmer-text !bg-transparent !border-none !shadow-none' : ''}`}
        >
          {prefix && <span className="opacity-60 mr-1">{prefix}</span>}
          <span className="font-bold">{value}</span>
          {stats && !settings.showFileEdit && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700/50 ml-2">
              <span className="text-cyan-400">+{stats.plus}</span>
              <span className="text-rose-400">-{stats.minus}</span>
            </div>
          )}
        </span>

        {isRunning && (
          <div className="flex items-center gap-2">
            {uiMode === 'classic' && <span className="text-slate-400 text-[11px] animate-pulse">executing...</span>}
            {tool?.pid && (
              <button
                onClick={() => window.koda.ptyKill(tool.pid!)}
                className="px-1.5 py-0.5 rounded bg-rose-950/30 border border-rose-500/30 text-rose-400 text-[9px] font-bold uppercase hover:bg-rose-900/50 transition-colors"
                title="Force kill this process"
              >
                Kill
              </button>
            )}
          </div>
        )}
        {tool?.status === 'awaiting_approval' && (
          <div className="flex-1 flex justify-end items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300 relative">
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="text-amber-500 text-[10px] font-bold uppercase tracking-wider">Awaiting Approval</span>
            </div>

            <button
              onClick={() => window.koda.shellResponse(false, false, false)}
              className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-rose-400 text-[10px] font-bold hover:bg-rose-900/20 hover:border-rose-500/50 transition-all active:scale-95"
            >
              Deny
            </button>

            <div className="flex items-stretch rounded-md border border-emerald-500/50 relative" ref={dropdownRef}>
              <button
                onClick={() => window.koda.shellResponse(true, false, false)}
                className="px-3 py-1 bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-400 text-[10px] font-bold transition-all active:bg-emerald-600/80 rounded-l-[5px]"
              >
                Accept
              </button>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                title="Approval options"
                className={`px-2 flex items-center justify-center transition-colors rounded-r-[5px] ${showDropdown ? 'bg-emerald-500/40 text-white' : 'bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-400 border-l border-emerald-500/30'}`}
              >
                <svg className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-[100] overflow-hidden animate-in slide-in-from-top-1 duration-200">
                  <button
                    onClick={async () => {
                      await window.koda.shellResponse(true, true, false)
                      await persistApprovedCommand('base', tool!.baseCommand!)
                      setShowDropdown(false)
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-900/20 transition-colors flex flex-col gap-0.5 border-b border-slate-700/30"
                  >
                    <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1.5">
                      <span className="text-xs">⚡</span> Accept Base Command
                    </span>
                    <span className="text-[9px] text-slate-500 ml-5 opacity-70">
                      Always allow "<code className="bg-slate-950 px-1 rounded">{tool!.baseCommand!}</code>" this session
                    </span>
                  </button>

                  <button
                    onClick={async () => {
                      await window.koda.shellResponse(true, false, true)
                      await persistApprovedCommand('full', tool!.command!)
                      setShowDropdown(false)
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-900/20 transition-colors flex flex-col gap-0.5 border-b border-slate-700/30"
                  >
                    <span className="text-cyan-400 font-bold text-[11px] flex items-center gap-1.5">
                      <span className="text-xs">🚀</span> Accept Full Command
                    </span>
                    <span className="text-[9px] text-slate-500 ml-5 opacity-70 line-clamp-1">
                      Always allow "<code className="bg-slate-950 px-1 rounded">{tool!.command!}</code>"
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
        )}

        {tool?.status === 'done' && uiMode === 'classic' && (
          <span className={`text-[11px] flex items-center gap-1 ${tool?.success ? 'text-emerald-400' : 'text-rose-400'}`}>
            {tool?.success ? symbols.check : symbols.cross}
            <span className="opacity-70">{tool?.success ? 'completed' : 'failed'}</span>
          </span>
        )}
      </div>

      {isOutputVisible && (
        (tool?.status === 'done' || tool?.status === 'writing') && (tool.output || (tool.status === 'writing' && tool.args?.replacement)) && (
          tool?.name === 'file_edit'
            ? <DiffViewer output={tool.output || `--- ${tool.args?.path || 'file'}\n+++ ${tool.args?.path || 'file'}\n@@ -1,1 +1,1 @@\n${(tool.args.replacement || '').split('\n').map((l: string) => '+' + l).join('\n')}`} />
            : (
              <div className="mt-1 bg-[#0d1117] border border-slate-700/60 p-3 rounded-md text-[11px] font-mono overflow-hidden shadow-inner relative max-h-[400px] overflow-y-auto custom-scrollbar">
                {(tool.output || (tool.args?.command || tool.args?.text || '')).split('\n').map((line: string, i: number) => {
                  if (line.trim() === '' && i === 0 && !tool.output) return null
                  let lineClass = 'text-slate-300 hover:bg-slate-800/20'
                  if (line.startsWith('+')) lineClass = 'text-cyan-400 bg-cyan-950/40 border-l-2 border-cyan-500/50 pl-2 -ml-2'
                  else if (line.startsWith('-')) lineClass = 'text-rose-400 bg-rose-950/40 border-l-2 border-rose-500/50 pl-2 -ml-2'
                  return (
                    <div
                      key={i}
                      className={`whitespace-pre-wrap break-all leading-relaxed px-1 rounded-sm transition-colors min-h-[1em] ${lineClass}`}
                      dangerouslySetInnerHTML={{ __html: ansi.toHtml(line) || '&nbsp;' }}
                    />
                  )
                })}
              </div>
            )
        )
      )}
    </div>
  )
})

ToolMessage.displayName = 'ToolMessage'

export default ToolMessage
