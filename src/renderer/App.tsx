import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
// @ts-ignore
import 'highlight.js/styles/tokyo-night-dark.css'
import { BrailleSpinner } from './components/BrailleSpinner'
import TitleBar from './components/TitleBar'
import MCPSettings, { MCPServerConfig } from './components/MCPSettings'
import BrowserPreview from './components/BrowserPreview'
import TerminalPanel from './components/TerminalPanel'
import AnsiConverter from 'ansi-to-html'

const ansi = new AnsiConverter({
  fg: '#CCC',
  bg: '#000',
  newline: false, // Prevents double spacing since we split lines
  escapeXML: true,
  stream: false   // Process each line independently
})

// Configure marked once at module level (not inside render)
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language }).value
  }
}))

const symbols = {
  brain: '🧠',
  bullet: '●',
  circle: '○',
  dir: '📂',
  arrow: '❯',
  lightning: '⚡',
  check: '✔',
  cross: '✖',
  info: 'ℹ'
}

interface AttachedImage {
  dataUrl: string
  mimeType: string
  name: string
}

interface MessageEntry {
  id: number
  type: 'user' | 'assistant' | 'system' | 'error' | 'tool' | 'pty'
  text?: string
  images?: AttachedImage[]
  done?: boolean
  tool?: {
    name: string
    status: 'running' | 'done' | 'awaiting_approval'
    output?: string
    success: boolean
    pid?: number
    command?: string
    baseCommand?: string
    args?: any
  }
  pty?: {
    pid: number
    output: string
    exited?: boolean
  }
}

interface KodaSettings {
  showTerminal: boolean
  showShellWait: boolean
  showFileRead: boolean
  showFileEdit: boolean
  showFileWrite: boolean
  showListDir: boolean
  showFileFind: boolean
  showSearch: boolean
  showLspQuery: boolean
  showBrowserAgent: boolean
  showPlanMode: boolean
  showColab: boolean
}

// ─── Memoized message rows — only re-render when their own data changes ───────

const UserMessage = memo(({ text, images, onRollback }: { text: string; images?: AttachedImage[]; onRollback?: () => void }) => (
  <div className="flex flex-col gap-2 mb-1 mt-2 bg-slate-800/20 p-2 rounded-md group relative">
    {/* Image thumbnails */}
    {images && images.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {images.map((img, i) => (
          <img
            key={i}
            src={img.dataUrl}
            alt={img.name}
            className="h-24 rounded border border-slate-700 object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
            title={img.name}
          />
        ))}
      </div>
    )}
    <div className="flex gap-3 items-start">
      <span className="text-cyan-400 font-bold mt-0.5 select-none">{symbols.arrow}</span>
      <span className="text-slate-100 font-medium leading-relaxed flex-1">{text}</span>
      {onRollback && (
        <button
          onClick={onRollback}
          title="Rollback to this point — restores files and memory"
          className="opacity-30 hover:opacity-100 transition-opacity ml-1 mt-0.5 p-1 rounded hover:bg-rose-900/30 text-slate-500 hover:text-rose-400 flex-shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      )}
    </div>
  </div>
))

const processMessageLinks = (text: string) => {
  // Regex to find file paths with line numbers: path/to/file.ts:123
  // It handles both relative and absolute paths (Windows/Unix)
  // Matches something like "src/main.ts:45"
  return text.replace(/(([a-zA-Z]:[\\/][^: \n\r`"']+)|([^: \n\r`"']+)):(\d+)/g, (match, pathPart, absPath, relPath, line) => {
    const finalPath = absPath || relPath;
    // We only convert if it looks like a file path (has extension or is long enough)
    // Avoid accidentally matching things like "http:8080"
    if (finalPath.includes('.') || finalPath.includes('/') || finalPath.includes('\\')) {
      return `[${match}](koda-open://${finalPath}:${line})`;
    }
    return match;
  });
};

const AssistantMessage = memo(({ text, done }: { text?: string; done?: boolean }) => {
  let html = ''
  if (text) {
    try {
      const processedText = processMessageLinks(text)
      html = marked.parse(processedText) as string
    } catch (e) {
      html = text
    }
  }

  return (
    <div className="flex flex-col ml-4">
      {!done && !text && <BrailleSpinner label="Thinking..." color="cyan" />}
      {text && (
        <div className="flex flex-col max-w-full overflow-hidden">
          <span className="text-cyan font-bold opacity-60 mb-1">Koda:</span>
          <div
            className="markdown-body text-slate-300 leading-relaxed overflow-x-auto w-full"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {!done && (
            <span className="inline-block mt-2">
              <BrailleSpinner color="cyan" />
            </span>
          )}
        </div>
      )}
    </div>
  )
})

// ─── Persistence Helper ──────────────────────────────────────────────────────
const persistApprovedCommand = async (type: 'base' | 'full', command: string) => {
  const key = type === 'base' ? 'koda_approved_base' : 'koda_approved_full'
  const current = JSON.parse(localStorage.getItem(key) || '[]')
  const updated = [...new Set([...current, command])]
  localStorage.setItem(key, JSON.stringify(updated))

  // Sync to main process
  const base = JSON.parse(localStorage.getItem('koda_approved_base') || '[]')
  const full = JSON.parse(localStorage.getItem('koda_approved_full') || '[]')
  await window.koda.updateApprovedCommands({ base, full })
}

const ToolMessage = memo(({ tool, settings, agentInfo }: { tool: MessageEntry['tool'], settings: KodaSettings, agentInfo: any }) => {
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
  );

  const stats = tool?.name === 'file_edit' ? (() => {
    let plus = 0, minus = 0;
    tool.output?.split('\n').forEach(l => {
      if (l.startsWith('+') && !l.startsWith('+++')) plus++;
      else if (l.startsWith('-') && !l.startsWith('---')) minus++;
    });
    return { plus, minus };
  })() : null;

  return (
    <div className="flex flex-col ml-4 gap-2 my-2 border-l-2 border-slate-700/50 pl-3 py-1">
      <div className="flex items-center gap-2">
        <span className={tool?.status === 'running' ? 'text-yellow animate-pulse' : 'text-magenta'}>
          {symbols.lightning}
        </span>
        <span className="text-white font-mono text-[13px] bg-slate-800/80 px-2 py-0.5 rounded shadow-sm border border-slate-700/50 flex items-center">
          {stats && !settings.showFileEdit && (
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-700/50 mr-2">
              <span className="text-cyan-400">+{stats.plus}</span>
              <span className="text-rose-400">-{stats.minus}</span>
            </div>
          )}
          {tool?.name === 'list_dir'
            ? (() => {
                const cwd = agentInfo?.cwd || '';
                const p = tool?.args?.path;
                if (!p || p === '.') return cwd;
                if (p.startsWith('/') || p.match(/^[a-zA-Z]:[\\/]/)) return p;
                const sep = cwd.includes('\\') ? '\\' : '/';
                const cleanP = p.replace(/^\.\//, '');
                return cwd.endsWith(sep) ? cwd + cleanP : cwd + sep + cleanP;
              })()
            : (tool?.name === 'file_read' || tool?.name === 'file_edit' || tool?.name === 'file_write')
              ? (tool?.args?.path?.split(/[\\/]/).pop() || tool?.args?.path || tool?.name)
              : tool?.name === 'shell'
                ? (tool?.command || tool?.args?.command || tool?.name)
                : tool?.name}
        </span>
        {tool?.status === 'running' && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] animate-pulse">executing...</span>
            {tool.pid && (
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

              {/* Inline Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-[100] overflow-hidden animate-in slide-in-from-top-1 duration-200">
                  <button
                    onClick={async () => {
                      await window.koda.shellResponse(true, true, false);
                      await persistApprovedCommand('base', tool.baseCommand!);
                      setShowDropdown(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-900/20 transition-colors flex flex-col gap-0.5 border-b border-slate-700/30"
                  >
                    <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1.5">
                      <span className="text-xs">⚡</span> Accept Base Command
                    </span>
                    <span className="text-[9px] text-slate-500 ml-5 opacity-70">Always allow "<code className="bg-slate-950 px-1 rounded">{tool.baseCommand!}</code>" this session</span>
                  </button>

                  <button
                    onClick={async () => {
                      await window.koda.shellResponse(true, false, true);
                      await persistApprovedCommand('full', tool.command!);
                      setShowDropdown(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-900/20 transition-colors flex flex-col gap-0.5 border-b border-slate-700/30"
                  >
                    <span className="text-cyan-400 font-bold text-[11px] flex items-center gap-1.5">
                      <span className="text-xs">🚀</span> Accept Full Command
                    </span>
                    <span className="text-[9px] text-slate-500 ml-5 opacity-70 line-clamp-1">Always allow "<code className="bg-slate-950 px-1 rounded">{tool.command!}</code>"</span>
                  </button>

                  <button
                    onClick={() => { window.koda.shellResponse(true, false, false); setShowDropdown(false); }}
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
        {tool?.status === 'done' && (
          <span className={`text-[11px] flex items-center gap-1 ${tool?.success ? 'text-emerald-400' : 'text-rose-400'}`}>
            {tool?.success ? symbols.check : symbols.cross}
            <span className="opacity-70">{tool?.success ? 'completed' : 'failed'}</span>
          </span>
        )}
      </div>

      {isOutputVisible && tool?.status === 'done' && tool.output && (
        <div className="mt-1 bg-[#0d1117] border border-slate-700/60 p-3 rounded-md text-[11px] font-mono overflow-hidden shadow-inner relative max-h-[400px] overflow-y-auto custom-scrollbar">
          {tool.output.split('\n').map((line, i) => {
            if (line.trim() === '' && i === 0) return null;

            let lineClass = "text-slate-300 hover:bg-slate-800/20";
            if (line.startsWith('+')) lineClass = "text-cyan-400 bg-cyan-950/40 border-l-2 border-cyan-500/50 pl-2 -ml-2";
            else if (line.startsWith('-')) lineClass = "text-rose-400 bg-rose-950/40 border-l-2 border-rose-500/50 pl-2 -ml-2";

            return (
              <div
                key={i}
                className={`whitespace-pre-wrap break-all leading-relaxed px-1 rounded-sm transition-colors min-h-[1em] ${lineClass}`}
                dangerouslySetInnerHTML={{ __html: ansi.toHtml(line) || '&nbsp;' }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
})

const ErrorMessage = memo(({ text }: { text: string }) => (
  <div className="ml-4 text-red flex gap-2 items-center">
    <span>{symbols.cross}</span>
    <span className="font-bold text-xs">{text}</span>
  </div>
))

const SystemMessage = memo(({ text }: { text: string }) => (
  <div className="ml-4 text-slate-500 italic text-[11px] flex gap-2 items-center">
    <span>{symbols.info}</span>
    <span className="whitespace-pre-wrap">{text}</span>
  </div>
))

const PtyMessage = memo(({ pty }: { pty: MessageEntry['pty'] }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [pty?.output])

  const handleCtrlC = async () => {
    if (!pty?.pid || sending || pty.exited) return
    setSending(true)
    await window.koda.ptySendCtrlC(pty.pid)
    setTimeout(() => setSending(false), 800)
  }

  const handleKill = async () => {
    if (!pty?.pid || pty.exited) return
    await window.koda.ptyKill(pty.pid)
  }

  return (
    <div className="flex flex-col ml-4 gap-2 my-2 border-l-2 border-slate-600 pl-3 py-1">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={pty?.exited ? 'text-slate-500' : 'text-[#1e90ff] animate-pulse'}>{symbols.lightning}</span>
        <span className="text-white font-mono text-[13px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
          PTY — PID {pty?.pid}
        </span>
        {pty?.exited ? (
          <span className="text-slate-500 text-[11px] font-mono">[exited]</span>
        ) : (
          <div className="flex items-center gap-1.5 ml-1">
            <button
              onClick={handleCtrlC}
              disabled={sending}
              title="Send Ctrl+C (SIGINT)"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 border border-slate-600 text-yellow-400 hover:bg-slate-700 hover:border-yellow-600 disabled:opacity-40 transition-colors"
            >
              ^C
            </button>
            <button
              onClick={handleKill}
              title="Force kill process"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 border border-slate-600 text-rose-400 hover:bg-slate-700 hover:border-rose-700 transition-colors"
            >
              kill
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="bg-[#0d1117] border border-slate-700 p-3 rounded-md text-[11px] text-[#58a6ff] font-mono max-h-[150px] overflow-y-auto custom-scrollbar whitespace-pre-wrap"
        dangerouslySetInnerHTML={{ __html: ansi.toHtml(pty?.output || '') }}
      />
    </div>
  )
})

const MessageRow = memo(({ msg, onRollback, kodaSettings, agentInfo }: { msg: MessageEntry; onRollback?: () => void, kodaSettings: KodaSettings, agentInfo: any }) => (
  <div className="flex flex-col text-sm">
    {msg.type === 'user' && <UserMessage text={msg.text!} images={msg.images} onRollback={onRollback} />}
    {msg.type === 'assistant' && <AssistantMessage text={msg.text} done={msg.done} />}
    {msg.type === 'tool' && <ToolMessage tool={msg.tool} settings={kodaSettings} agentInfo={agentInfo} />}
    {msg.type === 'error' && <ErrorMessage text={msg.text!} />}
    {msg.type === 'system' && <SystemMessage text={msg.text!} />}
    {msg.type === 'pty' && <PtyMessage pty={msg.pty} />}
  </div>
))

import tokyoNight from './themes/tokyo-night.json'
import monokai from './themes/monokai.json'
import cyberpunk from './themes/cyberpunk.json'
import githubDark from './themes/github-dark.json'

interface KodaTheme {
  id: string
  name: string
  colors: {
    bg: string
    bgAlt: string
    sidebar: string
    accent: string
    accentAlt: string
    text: string
    textDim: string
    border: string
    userMsg: string
  }
}

const THEMES: KodaTheme[] = [
  tokyoNight as KodaTheme,
  monokai as KodaTheme,
  cyberpunk as KodaTheme,
  githubDark as KodaTheme
]

const DEFAULT_THEME = THEMES[0]

// ─── Plan Approval Modal ──────────────────────────────────────────────────────
const PlanApprovalModal = memo(({ plan, onApprove, onReject }: { plan: string; onApprove: () => void; onReject: () => void }) => {
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-[500px] bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-6 bg-slate-800/30 border-b border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <h2 className="text-white font-black text-xs uppercase tracking-[0.2em]">Execution Plan Approval</h2>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">The agent has proposed a plan. Please review the steps below before proceeding.</p>
        </div>
        
        <div className="p-6 max-h-[300px] overflow-y-auto custom-scrollbar">
          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
            {plan}
          </div>
        </div>

        <div className="p-6 bg-slate-800/30 border-t border-white/5 flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 py-3 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-all active:scale-95"
          >
            Reject Plan
          </button>
          <button
            onClick={onApprove}
            className="flex-1 py-3 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
          >
            Approve & Execute
          </button>
        </div>
      </div>
    </div>
  )
})

// ─── Koda Settings Tab ────────────────────────────────────────────────────────
const KodaSettingsTab = memo(({ kodaSettings, setKodaSettings }: {
  kodaSettings: KodaSettings,
  setKodaSettings: React.Dispatch<React.SetStateAction<KodaSettings>>
}) => {
  const [approved, setApproved] = useState<{ base: string[], full: string[] }>({ base: [], full: [] })
  const [newCmd, setNewCmd] = useState('')
  const [type, setType] = useState<'base' | 'full'>('base')

  useEffect(() => {
    window.koda.getApprovedCommands().then(setApproved)
  }, [])

  const addCmd = async () => {
    if (!newCmd.trim()) return
    const updated = { ...approved, [type]: [...new Set([...approved[type], newCmd.trim()])] }
    setApproved(updated)
    await window.koda.updateApprovedCommands(updated)

    // Save to LocalStorage
    localStorage.setItem('koda_approved_base', JSON.stringify(updated.base))
    localStorage.setItem('koda_approved_full', JSON.stringify(updated.full))

    setNewCmd('')
  }

  const removeCmd = async (cmd: string, t: 'base' | 'full') => {
    const updated = { ...approved, [t]: approved[t].filter(c => c !== cmd) }
    setApproved(updated)
    await window.koda.updateApprovedCommands(updated)

    // Save to LocalStorage
    localStorage.setItem('koda_approved_base', JSON.stringify(updated.base))
    localStorage.setItem('koda_approved_full', JSON.stringify(updated.full))
  }

  return (
    <div className="flex flex-col gap-8 animate-in slide-in-from-left-2 duration-300">
      {/* Verbosity Section */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-amber-400 rounded-full"></span>
          Output Verbosity
        </h3>
        <p className="text-slate-400 text-[10px] leading-relaxed mb-4">Toggle tool output visibility in chat. Does not affect agent context.</p>

        <div className="flex flex-col gap-4 bg-slate-800/20 p-4 rounded-xl border border-slate-700/50">
          <SettingToggle
            label="Show Terminal Output"
            description="Live output from running terminal processes (npm, etc)"
            enabled={kodaSettings.showTerminal}
            onChange={v => setKodaSettings(prev => ({ ...prev, showTerminal: v }))}
          />
          <SettingToggle
            label="Show Shell Wait Output"
            description="Output from synchronous shell commands (ls, mkdir, etc)"
            enabled={kodaSettings.showShellWait}
            onChange={v => setKodaSettings(prev => ({ ...prev, showShellWait: v }))}
          />
          <SettingToggle
            label="Show File Read Output"
            description="The content of files read by the agent"
            enabled={kodaSettings.showFileRead}
            onChange={v => setKodaSettings(prev => ({ ...prev, showFileRead: v }))}
          />
          <SettingToggle
            label="Show File Edit Output"
            description="Diffs and changes made to files"
            enabled={kodaSettings.showFileEdit}
            onChange={v => setKodaSettings(prev => ({ ...prev, showFileEdit: v }))}
          />
          <SettingToggle
            label="Show List Dir Output"
            description="Directory listings and file structures"
            enabled={kodaSettings.showListDir}
            onChange={v => setKodaSettings(prev => ({ ...prev, showListDir: v }))}
          />
          <SettingToggle
            label="Show File Find Output"
            description="Search results and file matching logs"
            enabled={kodaSettings.showFileFind}
            onChange={v => setKodaSettings(prev => ({ ...prev, showFileFind: v }))}
          />
          <SettingToggle
            label="Show File Write Output"
            description="Details of files created or overwritten"
            enabled={kodaSettings.showFileWrite}
            onChange={v => setKodaSettings(prev => ({ ...prev, showFileWrite: v }))}
          />
          <SettingToggle
            label="Show Search Output"
            description="Results from regex searches across files"
            enabled={kodaSettings.showSearch}
            onChange={v => setKodaSettings(prev => ({ ...prev, showSearch: v }))}
          />
          <SettingToggle
            label="Show LSP Query Output"
            description="Results from semantic code analysis (Hover/Definition)"
            enabled={kodaSettings.showLspQuery}
            onChange={v => setKodaSettings(prev => ({ ...prev, showLspQuery: v }))}
          />
          <SettingToggle
            label="Show Browser Agent Output"
            description="Reports from web navigation sub-agents"
            enabled={kodaSettings.showBrowserAgent}
            onChange={v => setKodaSettings(prev => ({ ...prev, showBrowserAgent: v }))}
          />
          <SettingToggle
            label="Show Plan Mode Output"
            description="Transitions and strategies developed in Plan Mode"
            enabled={kodaSettings.showPlanMode}
            onChange={v => setKodaSettings(prev => ({ ...prev, showPlanMode: v }))}
          />
          <SettingToggle
            label="Show Collaboration Output"
            description="Messages exchanged with advisor LLMs"
            enabled={kodaSettings.showColab}
            onChange={v => setKodaSettings(prev => ({ ...prev, showColab: v }))}
          />
        </div>
      </section>

      {/* Approved Commands Section */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
          Approved Commands
        </h3>
        <p className="text-slate-400 text-[10px] leading-relaxed mb-4">Commands in this list will execute automatically without asking for permission.</p>

        <div className="flex flex-col gap-4 bg-slate-800/20 p-4 rounded-xl border border-slate-700/50">
          <div className="flex gap-2">
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="base">Base Command</option>
              <option value="full">Full String</option>
            </select>
            <input
              type="text"
              value={newCmd}
              onChange={e => setNewCmd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCmd()}
              placeholder={type === 'base' ? "ex: npm" : "ex: npm install"}
              className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 text-xs outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={addCmd}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
            >Add</button>
          </div>

          <div className="flex flex-col gap-6 pt-2">
            <div>
              <label className="text-slate-500 font-black text-[9px] uppercase tracking-[0.2em] mb-3 block">Base Commands (Session)</label>
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {approved.base.length === 0 && <span className="text-slate-600 text-[10px] italic">No base commands approved yet.</span>}
                {approved.base.map(cmd => (
                  <span key={cmd} className="group flex items-center gap-2 px-2.5 py-1 bg-emerald-900/30 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-mono shadow-sm">
                    {cmd}
                    <button onClick={() => removeCmd(cmd, 'base')} className="hover:text-rose-400 opacity-50 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px]">✕</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <label className="text-slate-500 font-black text-[9px] uppercase tracking-[0.2em] mb-3 block">Full Command Strings (Session)</label>
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {approved.full.length === 0 && <span className="text-slate-600 text-[10px] italic">No full strings approved yet.</span>}
                {approved.full.map(cmd => (
                  <span key={cmd} className="group flex items-center gap-2 px-2.5 py-1 bg-cyan-900/30 border border-cyan-500/30 text-cyan-400 rounded-lg text-[10px] font-mono shadow-sm max-w-full">
                    <span className="truncate">{cmd}</span>
                    <button onClick={() => removeCmd(cmd, 'full')} className="hover:text-rose-400 opacity-50 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] flex-shrink-0">✕</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
})


// ─── Settings UI Modal ────────────────────────────────────────────────────────
const SettingsUI = memo(({ onClose, onSave, defaultProvider, defaultModel, defaultAdvisorModel, theme, setTheme, kodaSettings, setKodaSettings }: {
  onClose: () => void
  onSave: (config: { provider: string, model: string, advisorModel: string, apiKey: string }) => void
  defaultProvider: string
  defaultModel: string
  defaultAdvisorModel: string
  theme: KodaTheme
  setTheme: React.Dispatch<React.SetStateAction<KodaTheme>>
  kodaSettings: KodaSettings
  setKodaSettings: React.Dispatch<React.SetStateAction<KodaSettings>>
}) => {
  const [activeTab, setActiveTab] = useState<'api' | 'themes' | 'koda'>('api')
  const [provider, setProvider] = useState(defaultProvider || 'openai')
  const [model, setModel] = useState(defaultModel || 'gpt-4o')
  const [advisorModel, setAdvisorModel] = useState(defaultAdvisorModel || 'gpt-4o')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('koda_api_key') || '')
  const [models, setModels] = useState<string[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  useEffect(() => {
    if (!apiKey && provider !== 'openrouter') {
      setModels([])
      return
    }

    setIsLoadingModels(true)
    const timer = setTimeout(async () => {
      try {
        const res = await window.koda.getModels(provider, apiKey)
        if (res.success && res.models) {
          setModels(res.models)
        } else {
          setModels([])
        }
      } catch (err) {
        setModels([])
      } finally {
        setIsLoadingModels(false)
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [provider, apiKey])

  const handleSave = () => {
    localStorage.setItem('koda_api_key', apiKey)
    onSave({ provider, model, advisorModel, apiKey })
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex w-[800px] h-[550px] bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl">

        {/* Sidebar */}
        <div className="w-1/4 bg-slate-800/30 border-r border-slate-700/50 flex flex-col p-4 gap-2">
          <div className="text-cyan font-bold flex items-center gap-2 mb-6 px-2">
            <span className="text-xl">⚙️</span> Settings
          </div>

          <button
            onClick={() => setActiveTab('api')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'api' ? 'bg-cyan/10 text-cyan border-r-2 border-cyan' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <span>🏢</span> API & Models
          </button>

          <button
            onClick={() => setActiveTab('themes')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'themes' ? 'bg-magenta/10 text-magenta border-r-2 border-magenta' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <span>🎨</span> Themes
          </button>

          <button
            onClick={() => setActiveTab('koda')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'koda' ? 'bg-amber-400/10 text-amber-400 border-r-2 border-amber-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <span>🤖</span> Koda Settings
          </button>

          <div className="mt-auto">
            <button
              onClick={onClose}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-rose-900/10 hover:text-rose-400 transition-all border border-transparent hover:border-rose-900/30"
            >
              <span>✕</span> Close
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col">
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'api' && (
              <div className="flex flex-col gap-6 animate-in slide-in-from-left-2 duration-300">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-cyan rounded-full"></span>
                  API Configuration
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Provider</label>
                    <select
                      value={provider}
                      onChange={e => setProvider(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-cyan transition-colors font-mono text-xs"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google Gemini</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="ollama">Ollama</option>
                      <option value="llamacpp">Llama.cpp</option>
                      <option value="groq">Groq</option>
                      <option value="deepseek">DeepSeek</option>
                      <option value="mistral">Mistral AI</option>
                      <option value="together">Together AI</option>
                      <option value="xai">xAI</option>
                      <option value="zhipu">Zhipu AI</option>
                      <option value="maritaca">Maritaca AI</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Model</label>
                      {isLoadingModels && <span className="text-[10px] text-cyan animate-pulse">Syncing...</span>}
                    </div>
                    {models.length > 0 ? (
                      <select
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-cyan transition-colors custom-scrollbar font-mono text-xs"
                      >
                        {!models.includes(model) && <option value={model}>{model} (Current)</option>}
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-cyan transition-colors font-mono text-xs"
                        placeholder="ex: llama3"
                      />
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Advisor Model</label>
                    </div>
                    {models.length > 0 ? (
                      <select
                        value={advisorModel}
                        onChange={e => setAdvisorModel(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-magenta transition-colors custom-scrollbar font-mono text-xs"
                      >
                        {!models.includes(advisorModel) && <option value={advisorModel}>{advisorModel} (Current)</option>}
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={advisorModel}
                        onChange={e => setAdvisorModel(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-magenta transition-colors font-mono text-xs"
                        placeholder="ex: claude-3-sonnet"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">API Key</label>
                    {(provider === 'ollama' || provider === 'llamacpp') && <span className="text-[10px] text-emerald-400 opacity-60">Optional for local</span>}
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-cyan transition-colors font-mono text-xs"
                    placeholder={provider === 'ollama' || provider === 'llamacpp' ? "Not required for local..." : "Your secret API key..."}
                  />
                  <p className="text-[10px] text-slate-500 italic mt-1">Keys are stored securely in your local storage only.</p>
                </div>
              </div>
            )}

            {activeTab === 'themes' && (
              <div className="flex flex-col gap-6 animate-in slide-in-from-left-2 duration-300">
                <div className="flex justify-between items-center">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-magenta rounded-full"></span>
                    Theme Selection
                  </h3>
                  <div className="text-[10px] text-slate-500 font-mono italic">Like VS Code, pick your style</div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Active Theme</label>
                  <div className="grid grid-cols-2 gap-3">
                    {THEMES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t)}
                        className={`flex flex-col gap-2 p-3 rounded-lg border transition-all text-left group ${theme.id === t.id ? 'border-magenta bg-magenta/10 shadow-[0_0_15px_rgba(217,70,239,0.1)]' : 'border-slate-700 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/70'}`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className={`text-xs font-bold ${theme.id === t.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{t.name}</span>
                          {theme.id === t.id && <span className="text-magenta text-[10px]">●</span>}
                        </div>
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.colors.bg }}></div>
                          <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.colors.accent }}></div>
                          <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.colors.accentAlt }}></div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-xl border border-slate-700/50" style={{ backgroundColor: theme.colors.bgAlt }}>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Live Preview</div>
                  <div className="flex flex-col gap-3 p-2">
                    <div className="flex gap-2 items-center">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.accent }}></div>
                      <div className="text-xs font-bold" style={{ color: theme.colors.text }}>This is how Koda will look.</div>
                    </div>
                    <div className="p-3 rounded-lg border text-[10px] leading-relaxed" style={{ backgroundColor: theme.colors.sidebar, borderColor: theme.colors.border, color: theme.colors.textDim }}>
                      The quick brown fox jumps over the lazy dog.
                      <code className="ml-2 font-mono" style={{ color: theme.colors.accentAlt }}>npm run dev</code>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'koda' && <KodaSettingsTab kodaSettings={kodaSettings} setKodaSettings={setKodaSettings} />}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex justify-between items-center bg-slate-800/10 border-t border-slate-700/50">
            <div className="text-[10px] text-slate-500 font-mono">
              v26.8.4 — Build 2026.04.08
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg font-bold border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded-lg font-bold bg-cyan/80 text-white hover:bg-cyan transition-all transform active:scale-95 shadow-lg shadow-cyan/10 text-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

const SettingToggle = ({ label, description, enabled, onChange }: { label: string, description: string, enabled: boolean, onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between group">
    <div className="flex flex-col">
      <span className="text-xs font-bold text-slate-200">{label}</span>
      <span className="text-[10px] text-slate-500">{description}</span>
    </div>
    <button
      onClick={() => onChange(!enabled)}
      className={`w-10 h-5 rounded-full relative transition-all ${enabled ? 'bg-cyan' : 'bg-slate-700'}`}
    >
      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`} />
    </button>
  </div>
)

const ThemeColorInput = ({ label, value, onChange, colorClass }: { label: string, value: string, onChange: (v: string) => void, colorClass?: string }) => (
  <div className="flex items-center justify-between gap-4">
    <label className="text-slate-400 text-[11px] font-medium">{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-20 bg-slate-850 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono focus:border-cyan outline-none"
      />
      <div className="relative w-6 h-6 rounded border border-slate-700 group overflow-hidden">
        <input
          type="color"
          value={value.startsWith('rgba') ? '#22d3ee' : value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="w-full h-full transition-transform group-hover:scale-110" style={{ backgroundColor: value }}></div>
      </div>
    </div>
  </div>
)

// ─── ID counter ───────────────────────────────────────────────────────────────
let _nextId = 0
const nextId = () => ++_nextId

// ─── Context Panel ────────────────────────────────────────────────────────────
interface TrackedFile {
  path: string
  access: 'read' | 'modified'
  timestamp: number
}

const ContextPanel = memo(({ files, pinnedFiles, onPin, onUnpin, onInject, cwd }: {
  files: TrackedFile[]
  pinnedFiles: string[]
  onPin: (path: string) => void
  onUnpin: (path: string) => void
  onInject: (path: string) => void
  cwd: string
}) => {
  const shortPath = (absPath: string) => absPath.replace(cwd, '').replace(/^[\\/]/, '') || absPath

  const modifiedFiles = files.filter(f => f.access === 'modified')
  const readFiles = files.filter(f => f.access === 'read' && !modifiedFiles.find(m => m.path === f.path))

  const FileRow = ({ file, badge }: { file: TrackedFile; badge: React.ReactNode }) => {
    const isPinned = pinnedFiles.includes(file.path)
    return (
      <div
        className="group flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800/50 cursor-pointer transition-colors"
        onClick={() => onInject(file.path)}
        title={`Click to inject into chat: ${file.path}`}
      >
        {badge}
        <span className="flex-1 text-slate-400 text-[10px] font-mono truncate group-hover:text-slate-200 transition-colors">
          {shortPath(file.path)}
        </span>
        <button
          onClick={e => { e.stopPropagation(); isPinned ? onUnpin(file.path) : onPin(file.path) }}
          title={isPinned ? 'Unpin from context' : 'Pin to context'}
          className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-[9px] ${isPinned ? 'text-cyan-400 opacity-100' : 'text-slate-500 hover:text-cyan-400'
            }`}
        >
          {isPinned ? '📌' : '📍'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-64 flex-shrink-0 border-l border-white/5 bg-slate-900/80 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/5 flex items-center gap-2">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400 flex-shrink-0">
          <path d="M3 6h18M3 12h12M3 18h8" />
        </svg>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Context Panel</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">

        {/* Pinned files */}
        {pinnedFiles.length > 0 && (
          <div className="mb-3">
            <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-500/70 mb-1">📌 Pinned</div>
            {pinnedFiles.map(path => (
              <div
                key={path}
                className="group flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800/50 cursor-pointer transition-colors"
                onClick={() => onInject(path)}
                title={`Click to inject: ${path}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                <span className="flex-1 text-slate-300 text-[10px] font-mono truncate group-hover:text-white transition-colors">
                  {shortPath(path)}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onUnpin(path) }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-all text-[9px] p-0.5"
                  title="Unpin"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Modified this session */}
        {modifiedFiles.length > 0 && (
          <div className="mb-3">
            <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-500/70 mb-1">✏️ Modified</div>
            {modifiedFiles.map(f => (
              <FileRow
                key={f.path}
                file={f}
                badge={<span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
              />
            ))}
          </div>
        )}

        {/* Read by agent */}
        {readFiles.length > 0 && (
          <div className="mb-3">
            <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500/70 mb-1">👁 Read</div>
            {readFiles.map(f => (
              <FileRow
                key={f.path}
                file={f}
                badge={<span className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" />}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {files.length === 0 && pinnedFiles.length === 0 && (
          <div className="px-3 py-6 text-center">
            <div className="text-slate-600 text-[10px] font-mono leading-relaxed">
              No files tracked yet.<br />Start a task and the agent's<br />file activity will appear here.
            </div>
          </div>
        )}
      </div>
    </div>
  )
})


const App: React.FC = () => {
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [input, setInput] = useState('')
  const [initializing, setInitializing] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [agentInfo, setAgentInfo] = useState({ provider: '...', model: '...', advisorModel: '...', project: '...', cwd: '...' })
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [pendingShellRequest, setPendingShellRequest] = useState<{ command: string; description: string; baseCommand: string } | null>(null)
  const [inPlanMode, setInPlanMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMcpSettings, setShowMcpSettings] = useState(false)
  const [showBrowser, setShowBrowser] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(50)
  const [browserHeight, setBrowserHeight] = useState(60)
  const [isResizing, setIsResizing] = useState(false)
  const [isResizingHeight, setIsResizingHeight] = useState(false)
  const [mode, setMode] = useState<'fast' | 'planner' | 'colab' | 'teach'>('fast')
  const [showPanel, setShowPanel] = useState(false)
  const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([])
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([])
  const [pendingImages, setPendingImages] = useState<AttachedImage[]>([])
  const [taskQueue, setTaskQueue] = useState<{ text: string; images: AttachedImage[] }[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [suggestionTriggerPos, setSuggestionTriggerPos] = useState(-1)
  const [isFetchingFiles, setIsFetchingFiles] = useState(false)

  // Slash command menu
  interface SlashItem { name: string; description: string; icon: string; isSkill?: boolean }
  const [slashItems, setSlashItems] = useState<SlashItem[]>([])
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  const [availableSkills, setAvailableSkills] = useState<Array<{ name: string; description: string }>>([])

  const [kodaSettings, setKodaSettings] = useState<KodaSettings>(() => {
    try {
      const saved = localStorage.getItem('koda_settings')
      if (saved) return JSON.parse(saved)
    } catch (e) { }
    return {
      showTerminal: true, showShellWait: true, showFileRead: true, showFileEdit: true,
      showFileWrite: true, showListDir: true, showFileFind: true, showSearch: true,
      showLspQuery: true, showBrowserAgent: true, showPlanMode: true, showColab: true
    }
  })

  const [theme, setTheme] = useState<KodaTheme>(() => {
    try {
      const saved = localStorage.getItem('koda_theme')
      if (saved) return JSON.parse(saved)
    } catch (e) { }
    return DEFAULT_THEME
  })

  // Refs
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const lastSavedCwd = useRef<string>('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chunkBufferRef = useRef<string>('')
  const rafRef = useRef<number | null>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onSelectMode = useCallback((m: 'fast' | 'planner' | 'colab' | 'teach') => {
    setMode(m)
  }, [])

  // ── Session Management ──
  const loadSession = useCallback(async (projectPath: string) => {
    if (!projectPath || projectPath === '...' || projectPath === lastSavedCwd.current) return
    lastSavedCwd.current = projectPath
    
    setMessages([{ id: nextId(), type: 'system', text: `📂 Loading project context: ${projectPath}...` }])
    
    const session = await window.koda.getProjectSession(projectPath)
    if (session) {
      setMessages(session.messages || [])
      setPinnedFiles(session.pinnedFiles || [])
      // Sync back to agent internal state
      await window.koda.saveProjectSession(projectPath, {
        rendererMessages: session.messages,
        backendMessages: session.backendHistory,
        pinnedFiles: session.pinnedFiles
      })
    } else {
      setMessages([])
      setPinnedFiles([])
      await window.koda.softReset()
    }
  }, [])

  // Auto-save debounced
  useEffect(() => {
    if (initializing || !agentInfo.cwd || agentInfo.cwd === '...') return
    const timer = setTimeout(async () => {
      await window.koda.saveProjectSession(agentInfo.cwd, {
        rendererMessages: messages,
        backendMessages: null, // index.ts will fill this from getHistory()
        pinnedFiles: pinnedFiles
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [messages, pinnedFiles, agentInfo.cwd, initializing])

  // Context Switcher
  useEffect(() => {
    if (agentInfo.cwd && agentInfo.cwd !== '...' && agentInfo.cwd !== lastSavedCwd.current) {
      loadSession(agentInfo.cwd)
    }
  }, [agentInfo.cwd, loadSession])

  // ── Theme & Global Settings ──
  useEffect(() => {
    localStorage.setItem('koda_settings', JSON.stringify(kodaSettings))
  }, [kodaSettings])

  useEffect(() => {
    localStorage.setItem('koda_theme', JSON.stringify(theme))
    const root = document.documentElement
    const colors = theme.colors
    root.style.setProperty('--koda-bg', colors.bg)
    root.style.setProperty('--koda-bg-alt', colors.bgAlt)
    root.style.setProperty('--koda-sidebar', colors.sidebar)
    root.style.setProperty('--koda-accent', colors.accent)
    root.style.setProperty('--koda-accent-alt', colors.accentAlt)
    root.style.setProperty('--koda-text', colors.text)
    root.style.setProperty('--koda-text-dim', colors.textDim)
    root.style.setProperty('--koda-border', colors.border)
    root.style.setProperty('--koda-user-msg', colors.userMsg)
  }, [theme])
  // ── Streaming batch: accumulate chunks in a ref, flush via rAF ──────
  // This completely bypasses React batching drops because string concat is sync.

  const flushStreaming = useCallback(() => {
    rafRef.current = null
    const chunk = chunkBufferRef.current
    if (!chunk) return
    chunkBufferRef.current = ''

    setMessages(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last && last.type === 'assistant' && !last.done) {
        updated[updated.length - 1] = { ...last, text: (last.text || '') + chunk }
        return updated
      } else {
        return [...updated, { id: nextId(), type: 'assistant', text: chunk, done: false }]
      }
    })
  }, [])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(flushStreaming)
  }, [flushStreaming])

  // ── Debounced scroll: only scroll when content actually settles ────────────
  const scheduleScroll = useCallback(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' })
    }, 80)
  }, [messages.length])

  useEffect(() => {
    if (!window.koda) return

    window.koda.init().then(async (res: any) => {
      if (res.success) {
        // Sync approved commands from LocalStorage
        const base = JSON.parse(localStorage.getItem('koda_approved_base') || '[]')
        const full = JSON.parse(localStorage.getItem('koda_approved_full') || '[]')
        window.koda.updateApprovedCommands({ base, full })

        // Load available skills for slash menu
        window.koda.listSkills().then(r => {
          if (r.success && r.skills) setAvailableSkills(r.skills)
        })

        // Hydrate from localStorage if available
        const savedKey = localStorage.getItem('koda_api_key')
        if (savedKey) {
          try {
            const setupRes = await window.koda.setup({ apiKey: savedKey })
            if (setupRes.success) {
                setAgentInfo(setupRes.info)
                loadSession(setupRes.info.cwd)
            }
          } catch (e) { }
        } else {
          setAgentInfo(res.info)
          loadSession(res.info.cwd)
        }
      } else {
        console.error('Failed to initialize agent:', res.error)
        setMessages([{ id: nextId(), type: 'error', text: `System initialization failed: ${res.error}` }])
      }
      setInitializing(false)
    })

    const unsubscribe = window.koda.onUpdate((update: any) => {
      if (update.type === 'text') {
        chunkBufferRef.current += update.content
        scheduleFlush()
        scheduleScroll()
      } else if (update.type === 'tool_start') {
        const chunk = chunkBufferRef.current
        chunkBufferRef.current = ''
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }

        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          let finalized = updated

          if (chunk) {
            if (last && last.type === 'assistant' && !last.done) {
              updated[updated.length - 1] = { ...last, text: (last.text || '') + chunk, done: true }
            } else {
              finalized = [...updated, { id: nextId(), type: 'assistant', text: chunk, done: true }]
            }
          } else {
            if (last && last.type === 'assistant' && !last.done) {
              updated[updated.length - 1] = { ...last, done: true }
            }
          }
          return [...finalized, { id: nextId(), type: 'tool', tool: { name: update.name, args: update.args, status: 'running', success: false } }]
        })
        scheduleScroll()
      } else if (update.type === 'tool_end') {
        setMessages(prev =>
          prev.map(m =>
            m.type === 'tool' && m.tool && m.tool.name === update.name && (m.tool.status === 'running' || m.tool.status === 'awaiting_approval')
              ? { ...m, tool: { ...m.tool, status: 'done' as const, success: update.success, output: update.result, args: update.args || m.tool.args } }
              : m
          )
        )
        scheduleScroll()
      } else if (update.type === 'error') {
        chunkBufferRef.current = ''
        setMessages(prev => [...prev, { id: nextId(), type: 'error', text: update.message }])
        scheduleScroll()
      } else if (update.type === 'pty_output') {
        setMessages(prev => {
          const updated = [...prev]
          const ptyIndex = updated.map(m => m.type === 'pty' ? m.pty?.pid : null).lastIndexOf(update.pid);

          if (ptyIndex !== -1) {
            updated[ptyIndex] = {
              ...updated[ptyIndex],
              pty: { ...updated[ptyIndex].pty!, output: updated[ptyIndex].pty!.output + update.data }
            }
            return updated;
          }
          return [...updated, { id: nextId(), type: 'pty', pty: { pid: update.pid, output: update.data } }]
        })
        // Only scroll if it's the latest message to avoid forced scrolls on old processes
        scheduleScroll()
      } else if (update.type === 'pty_exit') {
        setMessages(prev => prev.map(m =>
          m.type === 'pty' && m.pty?.pid === update.pid
            ? { ...m, pty: { ...m.pty!, exited: true } }
            : m
        ))
      } else if (update.type === 'plan_mode_entered') {
        setInPlanMode(true)
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: '📋 Koda exited Plan Mode — all changes approved and history updated.' }])
        scheduleScroll()
      } else if (update.type === 'info_updated') {
        setAgentInfo(update.info)
      } else if (update.type === 'plan_approval_requested') {
        setPendingPlan(update.plan)
        scheduleScroll()
      } else if (update.type === 'shell_awaiting_approval') {
        setMessages(prev => {
          const updated = [...prev]
          const lastToolIdx = updated.map(m => m.type === 'tool' && m.tool?.status === 'running' ? m.tool.name : null).lastIndexOf('shell')
          if (lastToolIdx !== -1) {
            updated[lastToolIdx] = {
              ...updated[lastToolIdx],
              tool: {
                ...updated[lastToolIdx].tool!,
                status: 'awaiting_approval',
                command: update.command,
                baseCommand: update.baseCommand
              }
            }
          }
          return updated
        })
        scheduleScroll()
      } else if (update.type === 'plan_mode_exited') {
        setInPlanMode(false)
        setPendingPlan(null)
        const msg = update.approved
          ? '✅ Plan approved! Koda will start implementation now.'
          : '❌ Plan rejected. Koda will refine the approach.'
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: msg }])
        scheduleScroll()
      } else if (update.type === 'files_tracked') {
        setTrackedFiles(update.files)
      } else if (update.type === 'pty_spawned') {
        setMessages(prev => {
          const updated = [...prev]
          // Find the latest running tool with this name (usually the one just started)
          const index = updated.map(m => m.type === 'tool' && m.tool?.status === 'running' ? m.tool.name : null).lastIndexOf(update.name)
          if (index !== -1) {
            updated[index] = {
              ...updated[index],
              tool: { ...updated[index].tool!, pid: update.pid }
            }
          }
          return updated
        })
      }
    })

    return () => {
      window.koda.removeUpdateListener()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [scheduleFlush, scheduleScroll])

  // Focus input when idle
  useEffect(() => {
    if (!isProcessing && !initializing) inputRef.current?.focus()
  }, [isProcessing, initializing])

  const handlePathClick = async () => {
    const newPath = await window.koda.selectDirectory()
    if (newPath) {
      setInitializing(true)
      const res = await window.koda.cd(newPath)
      if (res.success) {
        setAgentInfo(res.info)
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: `📂 Working directory changed to: ${newPath}. Context reset.` }])
      } else {
        setMessages(prev => [...prev, { id: nextId(), type: 'error', text: `❌ Failed to change directory: ${res.error}` }])
      }
      setInitializing(false)
    }
  }

  // Auto-dequeue: when agent finishes, fire next queued task
  useEffect(() => {
    if (!isProcessing && taskQueue.length > 0) {
      const [next, ...rest] = taskQueue
      setTaskQueue(rest)
      // Small delay so UI settles before firing the next task
      setTimeout(() => handleSend(next.text, next.images), 200)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing])

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      if (link && link.href.startsWith('koda-open://')) {
        e.preventDefault()
        // URL constructor might struggle with koda-open:// (it's not a standard protocol)
        // Let's decode manually
        const raw = link.href.replace('koda-open://', '')
        const decoded = decodeURIComponent(raw)
        // Format: path:line
        const lastColon = decoded.lastIndexOf(':')
        if (lastColon !== -1 && !isNaN(parseInt(decoded.substring(lastColon + 1)))) {
          const path = decoded.substring(0, lastColon)
          const line = parseInt(decoded.substring(lastColon + 1), 10)
          window.koda.openFile(path, line)
        } else {
          window.koda.openFile(decoded)
        }
      }
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [])

  const handleSend = useCallback(async (overrideText?: string, overrideImages?: AttachedImage[]) => {
    const userMsg = overrideText ?? input
    const currentImages = overrideImages ?? pendingImages
    if (!userMsg.trim()) return

    // If already processing, enqueue instead of sending
    if (isProcessing && !overrideText) {
      setTaskQueue(prev => [...prev, { text: userMsg, images: currentImages }])
      setInput('')
      setPendingImages([])
      return
    }

    if (!overrideText) {
      setInput('')
      setPendingImages([])
      // Update history
      setHistory(prev => prev[0] === userMsg ? prev : [userMsg, ...prev])
      setHistoryIndex(-1)
    }

    if (userMsg.startsWith('/')) {
      const parts = userMsg.toLowerCase().split(' ')
      const cmd = parts[0]

      if (cmd === '/clear') { setMessages([]); return }
      if (cmd === '/help') {
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: 'Available commands:\n/help - Show this help\n/clear - Clear messages\n/reset - Reset conversation\n/model [--name] - View or switch model' }])
        return
      }
      if (cmd === '/reset') {
        await window.koda.reset()
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: 'Conversation reset!' }])
        return
      }
      if (cmd === '/model') {
        const modelArg = parts[1]
        if (modelArg?.startsWith('--')) {
          const res = await window.koda.setModel(modelArg.slice(2))
          if (res.success) {
            setAgentInfo(res.info)
            setMessages(prev => [...prev, { id: nextId(), type: 'system', text: `🤖 Model updated to: ${res.info.model} (${res.info.provider})` }])
          } else {
            setMessages(prev => [...prev, { id: nextId(), type: 'error', text: res.error }])
          }
          return
        }
        const info = await window.koda.getInfo()
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: `Provider: ${info.provider} | Model: ${info.model}` }])
        return
      }
      if (cmd === '/apikey') {
        const key = parts[1]
        if (!key) { setMessages(prev => [...prev, { id: nextId(), type: 'error', text: 'Usage: /apikey <key>' }]); return }
        const res = await window.koda.setApiKey(key)
        if (res.success) {
          setAgentInfo(res.info)
          setMessages(prev => [...prev, { id: nextId(), type: 'system', text: '🔑 API Key updated successfully!' }])
        } else {
          setMessages(prev => [...prev, { id: nextId(), type: 'error', text: res.error }])
        }
        return
      }
      if (cmd === '/debug' && parts[1] === 'loading') {
        setInitializing(true)
        return
      }

      // Skill invocation: /skill-name [optional message]
      // The agent handles the actual skill loading — renderer just shows a UI hint
      const skillName = cmd.slice(1) // remove /
      const knownCmds = ['/clear', '/help', '/reset', '/model', '/apikey', '/tokens', '/cost', '/debug']
      if (!knownCmds.includes(cmd)) {
        // Show a skill activation badge in the UI before the agent processes it
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: `🎯 Activating skill: ${skillName}...` }])
        // Fall through to send to agent — don't return
      }
    }

    let finalMsg = userMsg
    if (mode === 'planner') {
      finalMsg = `[PLANNER MODE PROTOCOL - MANDATORY]
1. Use 'enter_plan_mode' IMMEDIATELY.
2. Explore the codebase using read-only tools ONLY.
3. DESIGN a complete implementation strategy.
4. Call 'exit_plan_mode' with your Markdown plan to get my approval.
5. DO NOT ATTEMPT TO EDIT ANY FILES OR RUN EVOLUTIVE SHELL COMMANDS UNTIL I APPROVE THE PLAN.

Your current task is: ${userMsg}`
    } else if (mode === 'colab') {
      finalMsg = `[COLLABORATIVE MODE PROTOCOL - ACTIVE]
1. You are working in COLLABORATIVE MODE.
2. You have access to a suite of collaboration tools: 'start_collaboration', 'send_to_advisor', and 'end_collaboration'.
3. Use 'start_collaboration' to initialize a discussion with an Elite Technical Advisor.
4. Use 'send_to_advisor' to exchange ideas, ask follow-up questions, and refine your plan.
5. Once you have a solid strategy approved by the advisor, use 'end_collaboration' and proceed to implementation.
6. This mode is for COMPLEX architectural discussions. Use it to deliver superior engineering.

Your current task is: ${userMsg}`
    } else if (mode === 'teach') {
      finalMsg = `[TEACHING MODE PROTOCOL - ACTIVE]
1. You are acting as an Elite Technical Mentor.
2. For every non-obvious change you make, EXPLAIN why you chose that approach (Y) over common alternatives (X).
3. Use code blocks to illustrate small comparisons if helpful.
4. Keep explanations technical yet accessible, focusing on 'na raça' learning (best practices, trade-offs, performance).
5. Do not just code; educate through your actions.

Your current task is: ${userMsg}`
    }

    const msgId = nextId() // capture and increment ID FIRST, guaranteed in sync
    setMessages(prev => [...prev, { id: msgId, type: 'user', text: userMsg, images: currentImages.length > 0 ? currentImages : undefined }])
    setIsProcessing(true)
    scheduleScroll()

    // Convert AttachedImage[] to ContentPart[] for the backend
    const imageParts = currentImages.map(img => ({
      type: 'image' as const,
      image: { type: 'image' as const, dataUrl: img.dataUrl, mimeType: img.mimeType },
    }))

    try {
      await window.koda.sendMessage(msgId, finalMsg, imageParts.length > 0 ? imageParts : undefined)

      // Cancel any pending rAF and flush accumulated streaming text synchronously
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const chunk = chunkBufferRef.current
      chunkBufferRef.current = ''

      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (!last) return updated

        if (chunk) {
          if (last.type === 'assistant' && !last.done) {
            updated[updated.length - 1] = { ...last, text: (last.text || '') + chunk, done: true }
          } else {
            updated.push({ id: nextId(), type: 'assistant', text: chunk, done: true })
          }
        } else if (last.type === 'assistant') {
          updated[updated.length - 1] = { ...last, done: true }
        }
        return updated
      })
    } catch (err: any) {
      chunkBufferRef.current = ''
      setMessages(prev => [...prev, { id: nextId(), type: 'error', text: err.message }])
    } finally {
      setIsProcessing(false)
    }
  }, [input, isProcessing, pendingImages, scheduleScroll, mode])

  const STATIC_COMMANDS: { name: string; description: string; icon: string }[] = [
    { name: '/help',   description: 'Show available commands',          icon: '❓' },
    { name: '/clear',  description: 'Clear chat messages',              icon: '🗑️' },
    { name: '/reset',  description: 'Reset conversation memory',        icon: '♻️' },
    { name: '/tokens', description: 'Show token usage estimate',        icon: '📊' },
    { name: '/model',  description: 'View or switch active model',      icon: '🤖' },
    { name: '/apikey', description: 'Set API key inline',               icon: '🔑' },
  ]

  const handleInputChange = async (val: string) => {
    setInput(val)

    const cursor = inputRef.current?.selectionStart || 0
    const textBefore = val.slice(0, cursor)

    // ── Slash command menu ──────────────────────────────────────────────────
    const slashMatch = textBefore.match(/^\/(\S*)$/)
    if (slashMatch) {
      const query = slashMatch[1].toLowerCase()
      const skillItems: { name: string; description: string; icon: string; isSkill: boolean }[] =
        availableSkills.map(s => ({ name: `/${s.name}`, description: s.description, icon: '🎯', isSkill: true }))
      const allItems = [...STATIC_COMMANDS, ...skillItems]
      const filtered = query
        ? allItems.filter(c => c.name.slice(1).startsWith(query))
        : allItems
      setSlashItems(filtered)
      setShowSlashMenu(filtered.length > 0)
      setSlashIndex(0)
      setShowSuggestions(false)
      return
    }
    setShowSlashMenu(false)

    // ── @ file mentions ─────────────────────────────────────────────────────
    const atMatch = textBefore.match(/@(\S*)$/)

    if (atMatch) {
      const query = atMatch[1].toLowerCase()
      setSuggestionTriggerPos(atMatch.index!)

      console.log('[Mentions] Detected @, query:', query)

      // Fetch files if not yet loaded
      let files = allFiles
      if (files.length === 0 && !isFetchingFiles) {
        console.log('[Mentions] First fetch of files...')
        setIsFetchingFiles(true)
        const res = await window.koda.getFiles()
        if (res.success) {
          console.log(`[Mentions] Fetched ${res.files.length} files`)
          files = res.files
          setAllFiles(files)
        } else {
          console.error('[Mentions] Failed to fetch files:', res.error)
        }
        setIsFetchingFiles(false)
      }

      const filtered = files
        .filter(f => {
          const lowerF = f.toLowerCase()
          return lowerF.includes(query) || lowerF.split('/').pop()?.includes(query)
        })
        .sort((a, b) => {
          const aName = a.split('/').pop()?.toLowerCase() || ''
          const bName = b.split('/').pop()?.toLowerCase() || ''
          const aStarts = aName.startsWith(query)
          const bStarts = bName.startsWith(query)
          if (aStarts && !bStarts) return -1
          if (!aStarts && bStarts) return 1
          return a.length - b.length
        })
        .slice(0, 10)

      console.log(`[Mentions] Found ${filtered.length} matches`)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
      setSuggestionIndex(0)
    } else {
      setShowSuggestions(false)
    }
  }

  const selectSuggestion = (file: string) => {
    const cursor = inputRef.current?.selectionStart || 0
    const textBeforeAt = input.slice(0, suggestionTriggerPos)
    const textAfterAt = input.slice(cursor)

    // Check if there's already a space after @file, if not add one
    const newText = `${textBeforeAt}@[${file}] ${textAfterAt.startsWith(' ') ? textAfterAt.trimStart() : textAfterAt}`
    setInput(newText)
    setShowSuggestions(false)

    // Focus back and set cursor pos
    setTimeout(() => {
      inputRef.current?.focus()
      const newPos = textBeforeAt.length + file.length + 4 // +4 for @[] and space
      inputRef.current?.setSelectionRange(newPos, newPos)
    }, 0)
  }

  const selectSlashItem = (item: { name: string; isSkill?: boolean }) => {
    // Replace the current /query with the selected command + trailing space
    setInput(item.name + ' ')
    setShowSlashMenu(false)
    setTimeout(() => {
      inputRef.current?.focus()
      const pos = item.name.length + 1
      inputRef.current?.setSelectionRange(pos, pos)
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
      }
    }, 0)
  }

  const handleRollback = useCallback(async (msgId: number) => {
    if (isProcessing) return

    const confirmed = window.confirm('Rollback to this message?\n\nThis will restore all files to the state they were in BEFORE this message was sent, and erase all subsequent conversation history.')
    if (!confirmed) return

    const res = await window.koda.snapshotRestore(msgId)
    if (!res.success) {
      setMessages(prev => [...prev, { id: nextId(), type: 'error', text: `Rollback failed: ${res.error}` }])
      return
    }

    // Trim UI messages: remove the target message and everything after it.
    // Using findIndex+slice instead of id comparison, because filter(m.id < msgId)
    // fails when rolling back the first message (no messages have id < 1).
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId)
      return idx === -1 ? prev : prev.slice(0, idx)
    })
  }, [initializing, isProcessing, taskQueue])

  const handleInjectFile = (path: string) => {
    const fileName = path.split(/[/\\]/).pop() || path
    setInput(prev => prev + ` @[${path}] `)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const dropped = Array.from(e.dataTransfer.files)
    const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

    dropped.forEach(file => {
      if (IMAGE_TYPES.includes(file.type)) {
        const reader = new FileReader()
        reader.onload = () => {
          setPendingImages(prev => [
            ...prev,
            { dataUrl: reader.result as string, mimeType: file.type, name: file.name }
          ])
        }
        reader.readAsDataURL(file)
      } else {
        // Non-image file: inject @[path] mention using Electron's file.path
        const filePath = (file as any).path
        if (filePath) handleInjectFile(filePath)
      }
    })

    setTimeout(() => inputRef.current?.focus(), 0)
  }, [handleInjectFile])

  const startResizingHeight = useCallback(() => {
    setIsResizingHeight(true)
  }, [])

  const stopResizingHeight = useCallback(() => {
    setIsResizingHeight(false)
  }, [])

  const resizeHeight = useCallback((e: MouseEvent) => {
    if (isResizingHeight) {
      const containerHeight = window.innerHeight - 40 // TitleBar is ~40px
      const newHeight = ((e.clientY - 40) / containerHeight) * 100
      if (newHeight > 15 && newHeight < 85) {
        setBrowserHeight(newHeight)
      }
    }
  }, [isResizingHeight])

  useEffect(() => {
    if (isResizingHeight) {
      window.addEventListener('mousemove', resizeHeight)
      window.addEventListener('mouseup', stopResizingHeight)
    } else {
      window.removeEventListener('mousemove', resizeHeight)
      window.removeEventListener('mouseup', stopResizingHeight)
    }
    return () => {
      window.removeEventListener('mousemove', resizeHeight)
      window.removeEventListener('mouseup', stopResizingHeight)
    }
  }, [isResizingHeight, resizeHeight, stopResizingHeight])

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = (e.clientX / window.innerWidth) * 100
      if (newWidth > 15 && newWidth < 80) { // Safety bounds
        setLeftPanelWidth(newWidth)
      }
    }
  }, [isResizing])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
    } else {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [isResizing, resize, stopResizing])

  const handlePinFile = useCallback((path: string) => {
    setPinnedFiles(prev => prev.includes(path) ? prev : [...prev, path])
  }, [])

  const handleUnpinFile = useCallback((path: string) => {
    setPinnedFiles(prev => prev.filter(p => p !== path))
  }, [])

  const showThinkingSpinner = isProcessing && (
    messages.length === 0 ||
    (messages[messages.length - 1].type !== 'assistant' &&
      (!messages[messages.length - 1].tool || messages[messages.length - 1].tool?.status === 'done')) ||
    (messages[messages.length - 1].type === 'assistant' && messages[messages.length - 1].done)
  )

  return (
    <div
      className="flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-300 selection:bg-cyan-900 selection:text-white relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-[100] border-2 border-dashed border-cyan-400/60 bg-cyan-900/20 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-2">📂</div>
            <div className="text-cyan-300 font-bold text-lg">Drop files or images here</div>
            <div className="text-slate-400 text-sm mt-1">Images will be attached • Code files will be @mentioned</div>
          </div>
        </div>
      )}
      <TitleBar
        mode={mode}
        onModeChange={setMode}
        onSettingsClick={() => setShowSettings(true)}
        onMcpClick={() => setShowMcpSettings(true)}
        onBrowserClick={() => setShowBrowser(p => !p)}
        showBrowser={showBrowser}
        onTerminalClick={() => setShowTerminal(p => !p)}
        showTerminal={showTerminal}
        showPanel={showPanel}
        onTogglePanel={() => setShowPanel(p => !p)}
      />

      {/* Main Container below TitleBar */}
      <div className="flex-1 relative flex flex-col min-h-0">
        {/* Plan Approval Modal */}
        {pendingPlan && (
          <PlanApprovalModal
            plan={pendingPlan}
            onApprove={() => {
              window.koda.planResponse(true)
            }}
            onReject={() => {
              window.koda.planResponse(false)
            }}
          />
        )}

        {/* Settings Modal */}
        {showSettings && (
          <SettingsUI
            onClose={() => setShowSettings(false)}
            defaultProvider={agentInfo.provider}
            defaultModel={agentInfo.model}
            onSave={async (config: any) => {
              const res = await window.koda.setup(config)
              if (res.success) setAgentInfo(res.info)
              setShowSettings(false)
            }}
            defaultAdvisorModel={agentInfo.advisorModel}
            theme={theme}
            setTheme={setTheme}
            kodaSettings={kodaSettings}
            setKodaSettings={setKodaSettings}
          />
        )}

        {/* MCP Settings Modal */}
        {showMcpSettings && (
          <MCPSettings
            onClose={() => setShowMcpSettings(false)}
            onSave={async (configs: any) => {
              setShowMcpSettings(false)
            }}
          />
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {(showBrowser || showTerminal) && (
          <>
            <div
              style={{ width: `${leftPanelWidth}%` }}
              className="flex flex-col flex-shrink-0 min-w-[250px] relative h-full bg-[#0d1117]"
            >
              {showBrowser && (
                <div 
                  className="flex-shrink-0 min-h-[100px] relative"
                  style={{ height: showTerminal ? `${browserHeight}%` : '100%' }}
                >
                  <BrowserPreview onClose={() => setShowBrowser(false)} />
                  {isResizingHeight && <div className="absolute inset-0 z-[100] cursor-row-resize" />}
                </div>
              )}

              {showBrowser && showTerminal && (
                <div
                  onMouseDown={startResizingHeight}
                  className={`h-1 hover:h-1.2 w-full cursor-row-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${isResizingHeight ? 'bg-indigo-500 h-1.5' : 'bg-white/5 hover:bg-indigo-500/50'}`}
                >
                  <div className={`w-8 h-[1px] bg-white/20 group-hover:bg-white/50 transition-colors ${isResizingHeight ? 'bg-white' : ''}`} />
                </div>
              )}

              {showTerminal && (
                <div 
                  className="flex-1 min-h-[100px] relative"
                  style={{ height: showBrowser ? `${100 - browserHeight}%` : '100%' }}
                >
                  <TerminalPanel 
                    onClose={() => setShowTerminal(false)} 
                    cwd={agentInfo.cwd}
                  />
                  {isResizingHeight && <div className="absolute inset-0 z-[100] cursor-row-resize" />}
                </div>
              )}
            </div>

            {/* Draggable Resizer - Main Horizontal Handle */}
            <div
              onMouseDown={startResizing}
              className={`w-1 hover:w-1.5 h-full cursor-col-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${isResizing ? 'bg-indigo-500 w-1.5' : 'bg-white/5 hover:bg-indigo-500/50'}`}
            >
              <div className={`w-[1px] h-8 bg-white/20 group-hover:bg-white/50 transition-colors ${isResizing ? 'bg-white' : ''}`} />
            </div>
          </>
        )}

        <div 
          className="flex flex-col flex-1 px-2 py-4 overflow-hidden relative" 
          style={{ width: `${100 - (showBrowser || showTerminal ? leftPanelWidth : 0)}%` }}
        >
          {/* FIXED BACKGROUND KODA LOGO (GLOBAL CENTER) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <pre className="text-slate-500/10 text-[11px] md:text-sm lg:text-base leading-[1.1] select-none font-mono text-center filter blur-[0.2px] opacity-80">
              {`:::    :::  ::::::::  :::::::::      :::
:+:   :+:  :+:    :+: :+:    :+:   :+: :+:
+:+  +:+   +:+    +:+ +:+    +:+  +:+   +:+
+#++:++    +#+    +:+ +#+    +:+ +#++:++#++:
+#+  +#+   +#+    +#+ +#+    +#+ +#+     +#+
#+#   #+#  #+#    #+# #+#    #+# #+#     #+#
###    ###  ########  #########  ###     ###`}
            </pre>
          </div>

          {/* HEADER */}
          <div className="terminal-header uppercase tracking-wider">
            <div className="terminal-box flex flex-col gap-1">
              <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold">
                <span className="text-slate-400">Project: <span className="text-yellow">{agentInfo.project}</span></span>

                <div className="flex items-center gap-3">
                  <span className="text-green opacity-80 text-[9px]">{agentInfo.model}</span>

                  <div className={`flex items-center gap-1.5 pl-2 border-l border-white/5 ${initializing ? 'text-slate-500' : isProcessing ? 'text-yellow' : 'text-green'}`}>
                    {inPlanMode && (
                      <span className="flex items-center gap-1 mr-1 text-yellow-400 font-bold uppercase text-[9px] tracking-widest">
                        <span className="w-1 h-1 bg-yellow-400 rounded-full animate-pulse"></span>
                      </span>
                    )}
                    <span className="text-[10px]">{initializing || isProcessing ? symbols.circle : symbols.bullet}</span>
                    <span className="text-[10px] font-black tracking-tighter">
                      {initializing ? 'Loading...' : isProcessing ? 'Busy' : 'Ready'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div
              onClick={handlePathClick}
              className="flex items-center gap-2 text-[10px] text-slate-500 font-mono cursor-pointer transition-all group mt-1"
              title="Click to select new working directory"
            >
              <span className="opacity-40 group-hover:text-cyan group-hover:opacity-100 transition-all">{symbols.dir}</span>
              <span className="text-slate-500 group-hover:text-slate-300 truncate max-w-[300px] transition-all">{agentInfo.cwd}</span>
            </div>
          </div>

          {/* MESSAGE AREA CONTAINER */}
          <div className="flex-1 min-h-0 relative mt-2 pr-2">
            <Virtuoso
              ref={virtuosoRef}
              data={messages}
              followOutput="smooth"
              className="terminal-scroll-area h-full custom-scrollbar"
              itemContent={(_index, msg) => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  onRollback={msg.type === 'user' ? () => handleRollback(msg.id) : undefined}
                  kodaSettings={kodaSettings}
                  agentInfo={agentInfo}
                />
              )}
              components={{
                Footer: () => (
                  <div className="pb-4">
                    {showThinkingSpinner && (
                      <div className="flex flex-col ml-4 mt-3">
                        <BrailleSpinner label="Thinking..." color="cyan" />
                      </div>
                    )}
                  </div>
                )
              }}
            />
          </div>

          {/* Image preview strip — ABOVE the input row */}
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 mb-1 pt-1">
              {pendingImages.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img.dataUrl} alt={img.name} className="h-16 rounded border border-slate-700 object-cover" />
                  <button
                    onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Task Queue indicator — ABOVE the input row */}
          {taskQueue.length > 0 && (
            <div className="flex items-center gap-2 px-3 mb-1 py-1 border-t border-white/5">
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">⏳ Queue</span>
              <div className="flex gap-1.5 flex-1 overflow-hidden">
                {taskQueue.map((t, i) => (
                  <span key={i} className="text-[10px] text-slate-500 font-mono bg-slate-800/60 rounded px-2 py-0.5 truncate max-w-[160px]">{t.text}</span>
                ))}
              </div>
              <button
                onClick={() => setTaskQueue([])}
                className="text-[9px] text-slate-600 hover:text-rose-400 transition-colors"
                title="Clear queue"
              >✕ clear</button>
            </div>
          )}

          {/* INPUT */}
          <div className={`terminal-input-container items-start bg-slate-900/95 backdrop-blur-sm z-20 mt-2 ${initializing ? 'terminal-input-disabled' : ''}`}>
            <span className={`font-bold mt-[6px] ${initializing ? 'text-slate-600' : isProcessing ? 'text-amber-400' : 'text-cyan'}`}>{symbols.arrow}</span>
            {initializing ? (
              <span className="text-slate-600 animate-pulse italic text-sm">Initializing...</span>
            ) : (
              <textarea
                ref={inputRef}
                autoFocus
                rows={1}
                value={input}
                onChange={e => {
                  handleInputChange(e.target.value)
                  // Auto-expand height
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                onKeyDown={e => {
                  if (showSlashMenu) {
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault()
                      if (slashItems[slashIndex]) selectSlashItem(slashItems[slashIndex])
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setSlashIndex(prev => (prev > 0 ? prev - 1 : slashItems.length - 1))
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setSlashIndex(prev => (prev < slashItems.length - 1 ? prev + 1 : 0))
                    } else if (e.key === 'Escape') {
                      setShowSlashMenu(false)
                    }
                    return
                  }

                  if (showSuggestions) {
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault()
                      if (suggestions[suggestionIndex]) {
                        selectSuggestion(suggestions[suggestionIndex])
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setSuggestionIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1))
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0))
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false)
                    }
                    return
                  }

                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                    // Reset height
                    if (inputRef.current) inputRef.current.style.height = 'auto'
                  } else if (e.key === 'ArrowUp' && input.indexOf('\n') === -1) {
                    e.preventDefault()
                    if (history.length > 0) {
                      const nextIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex
                      setHistoryIndex(nextIndex)
                      setInput(history[nextIndex])
                    }
                  } else if (e.key === 'ArrowDown' && input.indexOf('\n') === -1) {
                    e.preventDefault()
                    if (historyIndex > 0) {
                      const prevIndex = historyIndex - 1
                      setHistoryIndex(prevIndex)
                      setInput(history[prevIndex])
                    } else if (historyIndex === 0) {
                      setHistoryIndex(-1)
                      setInput('')
                    }
                  }
                }}
                placeholder={isProcessing ? 'Add to queue — agent will run next...' : 'Type your message...'}
                className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-slate-600 font-bold resize-none py-1.5 leading-normal min-h-[20px] max-h-[200px] custom-scrollbar"
              />
            )}


            {/* Slash Command Menu */}
            {showSlashMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-full max-w-[420px] bg-[#0d1117] border border-slate-600/60 rounded-lg shadow-2xl z-50 overflow-hidden font-mono">
                <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-900/50 text-[10px] text-slate-400 font-bold flex justify-between items-center">
                  <span>COMMANDS</span>
                  <span className="opacity-50 font-normal">TAB to select</span>
                </div>
                <div className="max-h-[260px] overflow-y-auto custom-scrollbar">
                  {slashItems.map((item, i) => (
                    <div
                      key={item.name}
                      onClick={() => selectSlashItem(item)}
                      onMouseEnter={() => setSlashIndex(i)}
                      className={`px-3 py-2 cursor-pointer text-xs flex items-center gap-2.5 transition-colors ${
                        i === slashIndex
                          ? item.isSkill ? 'bg-amber-900/30 text-amber-300' : 'bg-slate-800/80 text-white'
                          : 'text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="text-[13px] flex-shrink-0">{item.icon}</span>
                      <span className={`font-bold flex-shrink-0 ${item.isSkill ? 'text-amber-400' : 'text-cyan-400'}`}>
                        {item.name}
                      </span>
                      {item.description && (
                        <span className="opacity-50 truncate text-[11px]">{item.description}</span>
                      )}
                      {item.isSkill && (
                        <span className="ml-auto flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-amber-500/60 bg-amber-900/20 px-1.5 py-0.5 rounded">skill</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && (
              <div className="absolute bottom-full left-0 mb-2 w-full max-w-[400px] bg-[#0d1117] border border-cyan-500/50 rounded-lg shadow-2xl z-50 overflow-hidden font-mono">
                <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-900/50 text-[10px] text-cyan-400 font-bold flex justify-between items-center">
                  <span>FILES</span>
                  <span className="opacity-50 font-normal">TAB to select</span>
                </div>
                <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                  {suggestions.map((file, i) => (
                    <div
                      key={file}
                      onClick={() => selectSuggestion(file)}
                      onMouseEnter={() => setSuggestionIndex(i)}
                      className={`px-3 py-2 cursor-pointer text-xs flex items-center gap-2 transition-colors ${i === suggestionIndex ? 'bg-cyan-900/40 text-cyan-400' : 'text-slate-400 hover:bg-slate-800/40'
                        }`}
                    >
                      <span className="opacity-50 text-[10px]">📄</span>
                      <span className="truncate flex-1">
                        {file.split('/').slice(0, -1).join('/') && (
                          <span className="opacity-40">{file.split('/').slice(0, -1).join('/')}/</span>
                        )}
                        <span className="font-bold">{file.split('/').pop()}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Context Panel */}
        {showPanel && (
          <ContextPanel
            files={trackedFiles}
            pinnedFiles={pinnedFiles}
            onPin={handlePinFile}
            onUnpin={handleUnpinFile}
            onInject={handleInjectFile}
            cwd={agentInfo.cwd}
          />
        )}
      </div>
    </div>
  </div>
)
}

export default App
