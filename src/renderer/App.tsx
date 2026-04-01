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
  }
  pty?: {
    pid: number
    output: string
    exited?: boolean
  }
}

// ─── Memoized message rows — only re-render when their own data changes ───────

const UserMessage = memo(({ text }: { text: string }) => (
  <div className="flex gap-3 mb-1 mt-2 items-start bg-slate-800/20 p-2 rounded-md">
    <span className="text-cyan-400 font-bold mt-0.5 select-none">{symbols.arrow}</span>
    <span className="text-slate-100 font-medium leading-relaxed">{text}</span>
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
        <span className="text-slate-400 text-[11px] animate-pulse">executing...</span>
      ) : (
        <span className={`text-[11px] flex items-center gap-1 ${tool?.success ? 'text-emerald-400' : 'text-rose-400'}`}>
          {tool?.success ? symbols.check : symbols.cross} 
          <span className="opacity-70">{tool?.success ? 'completed' : 'failed'}</span>
        </span>
      )}
    </div>
    
    {tool?.status === 'done' && tool.output && (
      <div className="mt-1 bg-[#0d1117] border border-slate-700/60 p-3 rounded-md text-[11px] text-slate-300 font-mono overflow-hidden shadow-inner relative max-h-[300px] overflow-y-auto custom-scrollbar">
        {tool.output.split('\n').map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all leading-relaxed hover:bg-slate-800/30 px-1 rounded-sm">
            {line}
          </div>
        ))}
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

const MessageRow = memo(({ msg }: { msg: MessageEntry }) => (
  <div className="flex flex-col text-sm">
    {msg.type === 'user' && <UserMessage text={msg.text!} />}
    {msg.type === 'assistant' && <AssistantMessage text={msg.text} done={msg.done} />}
    {msg.type === 'tool' && <ToolMessage tool={msg.tool} />}
    {msg.type === 'error' && <ErrorMessage text={msg.text!} />}
    {msg.type === 'system' && <SystemMessage text={msg.text!} />}
    {msg.type === 'pty' && <PtyMessage pty={msg.pty} />}
  </div>
))

// ─── Plan Approval Modal ──────────────────────────────────────────────────────
const PlanApprovalModal = memo(({ plan, onApprove, onReject }: {
  plan: string
  onApprove: () => void
  onReject: () => void
}) => {
  const html = marked.parse(plan) as string
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="flex flex-col w-[700px] max-h-[80vh] bg-[#0d1117] border border-slate-700 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 bg-slate-900">
          <span className="text-2xl">📋</span>
          <div>
            <h2 className="text-white font-bold text-base">Koda quer sua aprovação</h2>
            <p className="text-slate-400 text-xs mt-0.5">Revise o plano abaixo antes de deixar o agente escrever código</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest">Plan Mode</span>
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
        <div className="flex gap-3 px-5 py-4 border-t border-slate-700 bg-slate-900">
          <button
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-emerald-900 border border-emerald-700 text-emerald-400 font-bold text-sm hover:bg-emerald-800 transition-colors"
          >
            <span>✔</span> Aprovar e Executar
          </button>
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-slate-800 border border-rose-800 text-rose-400 font-bold text-sm hover:bg-slate-700 transition-colors"
          >
            <span>✖</span> Rejeitar e Refinar
          </button>
        </div>
      </div>
    </div>
  )
})

// ─── Settings UI Modal ────────────────────────────────────────────────────────
const SettingsUI = memo(({ onClose, onSave, defaultProvider, defaultModel }: {
  onClose: () => void
  onSave: (config: { provider: string, model: string, apiKey: string }) => void
  defaultProvider: string
  defaultModel: string
}) => {
  const [provider, setProvider] = useState(defaultProvider || 'openai')
  const [model, setModel] = useState(defaultModel || 'gpt-4o')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('koda_api_key') || '')

  const handleSave = () => {
    localStorage.setItem('koda_api_key', apiKey)
    onSave({ provider, model, apiKey })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="flex flex-col w-[500px] bg-[#0d1117] border border-cyan-500 rounded-lg overflow-hidden font-mono text-sm">
        <div className="px-5 py-4 border-b border-cyan-500 bg-slate-900 flex justify-between items-center">
          <div className="flex items-center gap-3 text-cyan-400 font-bold">
            <span className="text-xl">⚙️</span> Configuração da API
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        
        <div className="flex flex-col gap-6 p-6 font-sans">
          <div className="flex flex-col gap-2">
            <label className="text-slate-300 font-bold text-xs uppercase tracking-wider">Provider</label>
            <select 
              value={provider} 
              onChange={e => setProvider(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded p-2 outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google Gemini</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-slate-300 font-bold text-xs uppercase tracking-wider">Modelo</label>
            <input 
              type="text" 
              value={model} 
              onChange={e => setModel(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded p-2 outline-none focus:border-cyan-500 transition-colors"
              placeholder="ex: claude-3-7-sonnet-20250219"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-slate-300 font-bold text-xs uppercase tracking-wider">API Key</label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded p-2 outline-none focus:border-cyan-500 transition-colors"
              placeholder="Sua chave de API secreta..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-900/50">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded font-bold border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 rounded font-bold bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
})

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

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
          } catch(e) {}
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
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: '📋 Koda entrou em Plan Mode — explorando o código antes de escrever qualquer coisa.' }])
        scheduleScroll()
      } else if (update.type === 'plan_approval_requested') {
        setPendingPlan(update.plan)
        scheduleScroll()
      } else if (update.type === 'plan_mode_exited') {
        setInPlanMode(false)
        setPendingPlan(null)
        const msg = update.approved
          ? '✅ Plano aprovado! Koda começará a implementação agora.'
          : '❌ Plano rejeitado. Koda vai refinar a abordagem.'
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: msg }])
        scheduleScroll()
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

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return

    const userMsg = input
    setInput('')

    if (userMsg.startsWith('/')) {
      const parts = userMsg.toLowerCase().split(' ')
      const cmd = parts[0]

      if (cmd === '/clear') { setMessages([]); return }
      if (cmd === '/help') {
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: 'Comandos disponíveis:\n/help - Mostrar esta ajuda\n/clear - Limpar mensagens\n/reset - Resetar conversa\n/plan - Ativar Plan Mode na próxima tarefa\n/agent - Configurar API Key e Modelo\n/model [--nome] - Ver ou trocar modelo\n/cd <caminho> - Mudar diretório' }])
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
      if (cmd === '/cd') {
        const pathArg = userMsg.slice(3).trim()
        if (!pathArg) { setMessages(prev => [...prev, { id: nextId(), type: 'error', text: 'Usage: /cd <path>' }]); return }
        const res = await window.koda.cd(pathArg)
        if (res.success) {
          setAgentInfo(res.info)
          setMessages(prev => [...prev, { id: nextId(), type: 'system', text: `📂 Changed directory to: ${res.info.cwd}` }])
        } else {
          setMessages(prev => [...prev, { id: nextId(), type: 'error', text: res.error }])
        }
        return
      }
      if (cmd === '/debug' && parts[1] === 'loading') {
        setInitializing(true)
        return
      }
      if (cmd === '/plan') {
        const taskDescription = userMsg.slice(5).trim()
        if (!taskDescription) {
          setMessages(prev => [...prev, { id: nextId(), type: 'system', text: '📋 Plan Mode: envie uma tarefa junto com o comando.\nExemplo: /plan Adicionar autenticação com JWT' }])
          return
        }
        // Inject a planning instruction — forces the agent to enter plan mode
        const planMsg = `[INSTRUÇÃO DO USUÁRIO: Antes de fazer qualquer coisa, entre em Plan Mode usando a ferramenta enter_plan_mode. Depois explore o código e apresente um plano completo para aprovação antes de escrever qualquer arquivo.]\n\nTarefa: ${taskDescription}`
        setMessages(prev => [...prev, { id: nextId(), type: 'user', text: `📋 /plan: ${taskDescription}` }])
        setIsProcessing(true)
        scheduleScroll()
        try {
          await window.koda.sendMessage(planMsg)
        } catch (err: any) {
          setMessages(prev => [...prev, { id: nextId(), type: 'error', text: err.message }])
        } finally {
          setIsProcessing(false)
        }
        return
      }
      if (cmd === '/agent') {
        setShowSettings(true)
        return
      }
    }

    setMessages(prev => [...prev, { id: nextId(), type: 'user', text: userMsg }])
    setIsProcessing(true)
    scheduleScroll()

    try {
      await window.koda.sendMessage(userMsg)

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
  }, [input, isProcessing, scheduleScroll])

  const showThinkingSpinner = isProcessing && (
    messages.length === 0 ||
    (messages[messages.length - 1].type !== 'assistant' &&
      (!messages[messages.length - 1].tool || messages[messages.length - 1].tool?.status === 'done')) ||
    (messages[messages.length - 1].type === 'assistant' && messages[messages.length - 1].done)
  )

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden select-none">
      <TitleBar />

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
          defaultProvider={agentInfo.provider}
          defaultModel={agentInfo.model}
          onClose={() => setShowSettings(false)}
          onSave={async (config) => {
            setShowSettings(false)
            setMessages(prev => [...prev, { id: nextId(), type: 'system', text: 'Aplicando novas configurações...' }])
            try {
              const res = await window.koda.setup(config)
              if (res.success) {
                setAgentInfo(res.info)
                setMessages(prev => [...prev, { id: nextId(), type: 'system', text: `✅ Configurações salvas e aplicadas! Modelo atual: ${res.info.model}` }])
              } else {
                setMessages(prev => [...prev, { id: nextId(), type: 'error', text: res.error }])
              }
            } catch (err: any) {
              setMessages(prev => [...prev, { id: nextId(), type: 'error', text: err.message }])
            }
          }}
        />
      )}

      <div className="flex flex-col flex-1 p-4 overflow-hidden">
        {/* HEADER */}
        <div className="terminal-header">
          <div className="terminal-box flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="font-bold text-white">{symbols.brain} Koda CLI</span>
              <span className="text-green text-xs font-bold">{agentInfo.model}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <div className="flex gap-4">
                <span className="text-slate-400">Provider: <span className="text-green">{agentInfo.provider}</span></span>
                <span className="text-slate-400">Project: <span className="text-yellow">{agentInfo.project}</span></span>
              </div>
              <div className={`flex items-center gap-1 ${initializing ? 'text-slate-500' : isProcessing ? 'text-yellow' : 'text-green'}`}>
                {inPlanMode && (
                  <span className="flex items-center gap-1 mr-2 text-yellow-400 font-bold uppercase text-[10px] tracking-widest">
                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                    Plan Mode
                  </span>
                )}
                <span>{initializing || isProcessing ? symbols.circle : symbols.bullet}</span>
                <span className="font-bold uppercase tracking-tighter">
                  {initializing ? 'Loading...' : isProcessing ? 'Busy' : 'Ready'}
                </span>
              </div>
            </div>
          </div>
          <div className="px-1 text-[11px] text-slate-500 mt-1">
            {symbols.dir} {agentInfo.cwd}
          </div>
        </div>

        {/* MESSAGE LIST */}
        <div className="terminal-scroll-area pr-2 mt-2">
          <div className="flex flex-col gap-3">
            {messages.map(msg => (
              <MessageRow key={msg.id} msg={msg} />
            ))}
            {showThinkingSpinner && (
              <div className="flex flex-col ml-4">
                <BrailleSpinner label="Thinking..." color="cyan" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* INPUT */}
        <div className={`terminal-input-container ${isProcessing || initializing ? 'terminal-input-disabled' : ''}`}>
          <span className={`font-bold ${isProcessing || initializing ? 'text-slate-600' : 'text-cyan'}`}>{symbols.arrow}</span>
          {isProcessing || initializing ? (
            <span className="text-slate-600 animate-pulse italic text-sm">
              {initializing ? 'Initializing...' : 'Processing...'}
            </span>
          ) : (
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-slate-600 font-bold"
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
