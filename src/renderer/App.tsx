import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/tokyo-night-dark.css'
import { BrailleSpinner } from './components/BrailleSpinner'
import TitleBar from './components/TitleBar'

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

interface MessageEntry {
  id: number
  type: 'user' | 'assistant' | 'system' | 'error' | 'tool' | 'pty'
  text?: string
  done?: boolean
    tool?: {
    name: string
    status: 'running' | 'done'
    output?: string
    success: boolean
    pid?: number
  }
  pty?: {
    pid: number
    output: string
    exited?: boolean
  }
}

// ─── Memoized message rows — only re-render when their own data changes ───────

const UserMessage = memo(({ text, onRollback }: { text: string; onRollback?: () => void }) => (
  <div className="flex gap-3 mb-1 mt-2 items-start bg-slate-800/20 p-2 rounded-md group relative">
    <span className="text-cyan-400 font-bold mt-0.5 select-none">{symbols.arrow}</span>
    <span className="text-slate-100 font-medium leading-relaxed flex-1">{text}</span>
    {onRollback && (
      <button
        onClick={onRollback}
        title="Rollback to this point — restores files and memory"
        className="opacity-30 hover:opacity-100 transition-opacity ml-1 mt-0.5 p-1 rounded hover:bg-rose-900/30 text-slate-500 hover:text-rose-400 flex-shrink-0"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
      </button>
    )}
  </div>
))

const AssistantMessage = memo(({ text, done }: { text?: string; done?: boolean }) => {
  let html = ''
  if (text) {
    try {
      html = marked.parse(text) as string
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

const ToolMessage = memo(({ tool }: { tool: MessageEntry['tool'] }) => (
  <div className="flex flex-col ml-4 gap-2 my-2 border-l-2 border-slate-700/50 pl-3 py-1">
    <div className="flex items-center gap-2">
      <span className={tool?.status === 'running' ? 'text-yellow animate-pulse' : 'text-magenta'}>
        {symbols.lightning}
      </span>
      <span className="text-white font-mono text-[13px] bg-slate-800/80 px-2 py-0.5 rounded shadow-sm border border-slate-700/50">
        {tool?.name}
      </span>
      {tool?.status === 'running' ? (
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
      ) : (
        <span className={`text-[11px] flex items-center gap-1 ${tool?.success ? 'text-emerald-400' : 'text-rose-400'}`}>
          {tool?.success ? symbols.check : symbols.cross}
          <span className="opacity-70">{tool?.success ? 'completed' : 'failed'}</span>
        </span>
      )}
    </div>

    {tool?.status === 'done' && tool.output && (
      <div className="mt-1 bg-[#0d1117] border border-slate-700/60 p-3 rounded-md text-[11px] font-mono overflow-hidden shadow-inner relative max-h-[400px] overflow-y-auto custom-scrollbar">
        {tool.output.split('\n').map((line, i) => {
          let lineClass = "text-slate-300 hover:bg-slate-800/20";
          if (line.startsWith('+')) lineClass = "text-cyan-400 bg-cyan-950/40 border-l-2 border-cyan-500/50 pl-2 -ml-2";
          else if (line.startsWith('-')) lineClass = "text-rose-400 bg-rose-950/40 border-l-2 border-rose-500/50 pl-2 -ml-2";

          return (
            <div key={i} className={`whitespace-pre-wrap break-all leading-relaxed px-1 rounded-sm transition-colors ${lineClass}`}>
              {line}
            </div>
          )
        })}
        {/* Fading bottom edge effect for long outputs that aren't scrolled */}
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#0d1117] to-transparent pointer-events-none" />
      </div>
    )}
  </div>
))

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

      <div ref={scrollRef} className="bg-[#0d1117] border border-slate-700 p-3 rounded-md text-[11px] text-[#58a6ff] font-mono max-h-[150px] overflow-y-auto custom-scrollbar">
        {pty?.output.split('\n').map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all leading-relaxed">
            {line}
          </div>
        ))}
      </div>
    </div>
  )
})

const MessageRow = memo(({ msg, onRollback }: { msg: MessageEntry; onRollback?: () => void }) => (
  <div className="flex flex-col text-sm">
    {msg.type === 'user' && <UserMessage text={msg.text!} onRollback={onRollback} />}
    {msg.type === 'assistant' && <AssistantMessage text={msg.text} done={msg.done} />}
    {msg.type === 'tool' && <ToolMessage tool={msg.tool} />}
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
const PlanApprovalModal = memo(({ plan, onApprove, onReject }: {
  plan: string
  onApprove: () => void
  onReject: () => void
}) => {
  const html = marked.parse(plan) as string
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col w-[700px] max-h-[80vh] bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 bg-slate-800/50">
          <span className="text-2xl">📋</span>
          <div>
            <h2 className="text-white font-bold text-base">Koda needs your approval</h2>
            <p className="text-slate-400 text-xs mt-0.5">Review the plan below before letting the agent write code</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            <span className="text-yellow-400 text-[10px] font-bold uppercase tracking-widest">Plan Mode</span>
          </div>
        </div>

        {/* Plan Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <div
            className="markdown-body text-slate-300 leading-relaxed text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-700 bg-slate-800/30">
          <button
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-emerald-900/40 border border-emerald-500/50 text-emerald-400 font-bold text-sm hover:bg-emerald-800/60 transition-all hover:scale-[1.02] active:scale-95"
          >
            <span>✔</span> Approve & Execute
          </button>
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-rose-900/20 border border-rose-500/50 text-rose-400 font-bold text-sm hover:bg-rose-900/40 transition-all hover:scale-[1.02] active:scale-95"
          >
            <span>✖</span> Reject & Refine
          </button>
        </div>
      </div>
    </div>
  )
})

// ─── Settings UI Modal ────────────────────────────────────────────────────────
const SettingsUI = memo(({ onClose, onSave, defaultProvider, defaultModel, theme, setTheme }: {
  onClose: () => void
  onSave: (config: { provider: string, model: string, apiKey: string }) => void
  defaultProvider: string
  defaultModel: string
  theme: KodaTheme
  setTheme: React.Dispatch<React.SetStateAction<KodaTheme>>
}) => {
  const [activeTab, setActiveTab] = useState<'api' | 'themes'>('api')
  const [provider, setProvider] = useState(defaultProvider || 'openai')
  const [model, setModel] = useState(defaultModel || 'gpt-4o')
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
    onSave({ provider, model, apiKey })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
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

// ─── App ──────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [input, setInput] = useState('')
  const [initializing, setInitializing] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [agentInfo, setAgentInfo] = useState({ provider: '...', model: '...', project: '...', cwd: '...' })
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [inPlanMode, setInPlanMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [mode, setMode] = useState<'fast' | 'planner'>('fast')
  const [theme, setTheme] = useState<KodaTheme>(() => {
    try {
      const saved = localStorage.getItem('koda_theme')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Basic validation for the new theme structure
        if (parsed && parsed.id && parsed.colors && parsed.colors.bg) {
          return parsed
        }
      }
    } catch (e) {
      console.error('Failed to load theme:', e)
    }
    return DEFAULT_THEME
  })

  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const [allFiles, setAllFiles] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [suggestionTriggerPos, setSuggestionTriggerPos] = useState(-1)
  const [isFetchingFiles, setIsFetchingFiles] = useState(false)

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

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Streaming batch: accumulate chunks in a ref, flush via rAF ──────
  // This completely bypasses React batching drops because string concat is sync.
  const chunkBufferRef = useRef<string>('')
  const rafRef = useRef<number | null>(null)

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
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleScroll = useCallback(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 80)
  }, [])

  useEffect(() => {
    if (!window.koda) return

    window.koda.init().then(async (res: any) => {
      if (res.success) {
        // Hydrate from localStorage if available
        const savedKey = localStorage.getItem('koda_api_key')
        if (savedKey) {
          try {
            const setupRes = await window.koda.setup({ apiKey: savedKey })
            if (setupRes.success) setAgentInfo(setupRes.info)
          } catch (e) { }
        } else {
          setAgentInfo(res.info)
        }
      } else {
        console.error('Failed to initialize agent:', res.error)
        setMessages([{ id: nextId(), type: 'error', text: `System initialization failed: ${res.error}` }])
      }
      setInitializing(false)
    })

    window.koda.onUpdate((update: any) => {
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
          return [...finalized, { id: nextId(), type: 'tool', tool: { name: update.name, status: 'running', success: false } }]
        })
        scheduleScroll()
      } else if (update.type === 'tool_end') {
        setMessages(prev =>
          prev.map(m =>
            m.type === 'tool' && m.tool && m.tool.name === update.name && m.tool.status === 'running'
              ? { ...m, tool: { name: m.tool.name, status: 'done' as const, success: update.success, output: update.result } }
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
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: '📋 Koda entered Plan Mode — exploring the code before writing anything.' }])
        scheduleScroll()
      } else if (update.type === 'plan_approval_requested') {
        setPendingPlan(update.plan)
        scheduleScroll()
      } else if (update.type === 'plan_mode_exited') {
        setInPlanMode(false)
        setPendingPlan(null)
        const msg = update.approved
          ? '✅ Plan approved! Koda will start implementation now.'
          : '❌ Plan rejected. Koda will refine the approach.'
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: msg }])
        scheduleScroll()
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

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return

    const userMsg = input
    setInput('')

    // Update history
    setHistory(prev => {
      // Avoid duplicate consecutive entries
      if (prev[0] === userMsg) return prev;
      return [userMsg, ...prev];
    })
    setHistoryIndex(-1)

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
    }

    const msgId = nextId() // capture and increment ID FIRST, guaranteed in sync
    setMessages(prev => [...prev, { id: msgId, type: 'user', text: userMsg }])
    setIsProcessing(true)
    scheduleScroll()

    try {
      await window.koda.sendMessage(msgId, finalMsg)

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
  }, [input, isProcessing, scheduleScroll, mode])

  const handleInputChange = async (val: string) => {
    setInput(val)

    // Detect @ for suggestions
    const cursor = inputRef.current?.selectionStart || 0
    const textBefore = val.slice(0, cursor)
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
  }, [isProcessing])

  const showThinkingSpinner = isProcessing && (
    messages.length === 0 ||
    (messages[messages.length - 1].type !== 'assistant' &&
      (!messages[messages.length - 1].tool || messages[messages.length - 1].tool?.status === 'done')) ||
    (messages[messages.length - 1].type === 'assistant' && messages[messages.length - 1].done)
  )

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-300 selection:bg-cyan-900 selection:text-white">
      <TitleBar mode={mode} onModeChange={setMode} onSettingsClick={() => setShowSettings(true)} />

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
          onSave={async (config) => {
            const res = await window.koda.setup(config)
            if (res.success) setAgentInfo(res.info)
            setShowSettings(false)
          }}
          theme={theme}
          setTheme={setTheme}
        />
      )}

      <div className="flex flex-col flex-1 px-2 py-4 overflow-hidden relative">
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
        <div className="flex-1 min-h-0 relative">
          {/* MESSAGE LIST (SCROLLABLE) */}
          <div className="terminal-scroll-area h-full mt-2 pr-2 relative z-10 overflow-y-auto">
            <div className="flex flex-col gap-3">
              {messages.map(msg => (
                <MessageRow key={msg.id} msg={msg} onRollback={msg.type === 'user' ? () => handleRollback(msg.id) : undefined} />
              ))}
              {showThinkingSpinner && (
                <div className="flex flex-col ml-4">
                  <BrailleSpinner label="Thinking..." color="cyan" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* INPUT */}
        <div className={`terminal-input-container items-start bg-slate-900/95 backdrop-blur-sm z-20 mt-2 ${isProcessing || initializing ? 'terminal-input-disabled' : ''}`}>
          <span className={`font-bold mt-[6px] ${isProcessing || initializing ? 'text-slate-600' : 'text-cyan'}`}>{symbols.arrow}</span>
          {isProcessing || initializing ? (
            <span className="text-slate-600 animate-pulse italic text-sm">
              {initializing ? 'Initializing...' : 'Processing...'}
            </span>
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
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-slate-600 font-bold resize-none py-1.5 leading-normal min-h-[20px] max-h-[200px] custom-scrollbar"
            />
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
    </div>
  )
}

export default App
