import React, { useState, useEffect, useRef, useCallback } from 'react'
// @ts-ignore
import 'highlight.js/styles/tokyo-night-dark.css'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

// ─── Types ────────────────────────────────────────────────────────────────────
import { MessageEntry, KodaSettings, KodaTheme, TrackedFile, AttachedImage, AgentInfo, Mode, SlashItem } from './types/index.js'

// ─── Hooks ───────────────────────────────────────────────────────────────────
import { useResizable } from './hooks/useResizable.js'
import { useDragDrop } from './hooks/useDragDrop.js'
import { useAgentStream, nextId } from './hooks/useAgentStream.js'
import { useSession } from './hooks/useSession.js'

// ─── Components ──────────────────────────────────────────────────────────────
import TitleBar from './components/TitleBar.js'
import MCPSettings from './components/MCPSettings.js'
import BrowserPreview from './components/BrowserPreview.js'
import TerminalPanel from './components/TerminalPanel.js'
import { BrailleSpinner } from './components/BrailleSpinner.js'
import MessageRow from './components/messages/MessageRow.js'
import PlanApprovalModal from './components/modals/PlanApprovalModal.js'
import ContextPanel from './components/context/ContextPanel.js'
import SettingsUI, { DEFAULT_THEME } from './components/settings/SettingsUI.js'

const symbols = {
  brain: '🧠',
  bullet: '●',
  circle: '○',
  dir: '📂',
  arrow: '❯',
}

const STATIC_COMMANDS: { name: string; description: string; icon: string }[] = [
  { name: '/help',   description: 'Show available commands',     icon: '❓' },
  { name: '/clear',  description: 'Clear chat messages',         icon: '🗑️' },
  { name: '/reset',  description: 'Reset conversation memory',   icon: '♻️' },
  { name: '/tokens', description: 'Show token usage estimate',   icon: '📊' },
  { name: '/model',  description: 'View or switch active model', icon: '🤖' },
  { name: '/apikey', description: 'Set API key inline',          icon: '🔑' },
]

const App: React.FC = () => {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [input, setInput] = useState('')
  const [initializing, setInitializing] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [agentInfo, setAgentInfo] = useState<AgentInfo>({ provider: '...', model: '...', advisorModel: '...', project: '...', cwd: '...' })
  const [mode, setMode] = useState<Mode>('fast')

  // ── Panel visibility ────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false)
  const [showMcpSettings, setShowMcpSettings] = useState(false)
  const [showBrowser, setShowBrowser] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const [showPanel, setShowPanel] = useState(false)

  // ── Agent state ─────────────────────────────────────────────────────────────
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [inPlanMode, setInPlanMode] = useState(false)
  const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([])
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([])
  const [pendingImages, setPendingImages] = useState<AttachedImage[]>([])
  const [taskQueue, setTaskQueue] = useState<{ text: string; images: AttachedImage[] }[]>([])

  // ── Input state ─────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [isFetchingFiles, setIsFetchingFiles] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [suggestionTriggerPos, setSuggestionTriggerPos] = useState(-1)
  const [slashItems, setSlashItems] = useState<SlashItem[]>([])
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  const [availableSkills, setAvailableSkills] = useState<Array<{ name: string; description: string }>>([])

  // ── Persisted settings & theme ──────────────────────────────────────────────
  const [kodaSettings, setKodaSettings] = useState<KodaSettings>(() => {
    try {
      const saved = localStorage.getItem('koda_settings')
      if (saved) return JSON.parse(saved)
    } catch { }
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
    } catch { }
    return DEFAULT_THEME
  })

  // ── Refs ────────────────────────────────────────────────────────────────────
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Debounced scroll ────────────────────────────────────────────────────────
  const scheduleScroll = useCallback(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' })
    }, 80)
  }, [messages.length])

  // ── Custom hooks ────────────────────────────────────────────────────────────
  const { leftPanelWidth, browserHeight, isResizing, isResizingHeight, startResizing, startResizingHeight } = useResizable()
  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useDragDrop({ setInput, setPendingImages })
  const { loadSession, lastSavedCwd } = useSession({ setMessages, setPinnedFiles })
  const { chunkBufferRef, rafRef, taskStartRef } = useAgentStream({
    setMessages, setAgentInfo, setIsProcessing,
    setTrackedFiles, setPendingPlan, setInPlanMode, scheduleScroll
  })

  // ── Session context switch ───────────────────────────────────────────────────
  useEffect(() => {
    if (agentInfo.cwd && agentInfo.cwd !== '...' && agentInfo.cwd !== lastSavedCwd.current) {
      loadSession(agentInfo.cwd)
    }
  }, [agentInfo.cwd, loadSession, lastSavedCwd])

  // ── Auto-save (debounced 1s) ────────────────────────────────────────────────
  useEffect(() => {
    if (initializing || !agentInfo.cwd || agentInfo.cwd === '...') return
    const timer = setTimeout(async () => {
      await window.koda.saveProjectSession(agentInfo.cwd, {
        rendererMessages: messages,
        backendMessages: null,
        pinnedFiles,
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [messages, pinnedFiles, agentInfo.cwd, initializing])

  // ── Theme & settings persistence ────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('koda_settings', JSON.stringify(kodaSettings))
  }, [kodaSettings])

  useEffect(() => {
    localStorage.setItem('koda_theme', JSON.stringify(theme))
    const root = document.documentElement
    const { colors } = theme
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

  // ── Agent initialization ────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.koda) return

    window.koda.init().then(async (res: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (res.success) {
        const base = JSON.parse(localStorage.getItem('koda_approved_base') || '[]')
        const full = JSON.parse(localStorage.getItem('koda_approved_full') || '[]')
        window.koda.updateApprovedCommands({ base, full })

        window.koda.listSkills().then((r: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          if (r.success && r.skills) setAvailableSkills(r.skills)
        })

        if (Notification.permission === 'default') Notification.requestPermission()

        const savedKey = localStorage.getItem('koda_api_key')
        if (savedKey) {
          try {
            const setupRes = await window.koda.setup({ apiKey: savedKey })
            if (setupRes.success) {
              setAgentInfo(setupRes.info)
              loadSession(setupRes.info.cwd)
            }
          } catch { }
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

    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [loadSession]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global koda-open:// link handler ────────────────────────────────────────
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      if (link && link.href.startsWith('koda-open://')) {
        e.preventDefault()
        const raw = link.href.replace('koda-open://', '')
        const decoded = decodeURIComponent(raw)
        const lastColon = decoded.lastIndexOf(':')
        if (lastColon !== -1 && !isNaN(parseInt(decoded.substring(lastColon + 1)))) {
          window.koda.openFile(decoded.substring(0, lastColon), parseInt(decoded.substring(lastColon + 1), 10))
        } else {
          window.koda.openFile(decoded)
        }
      }
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [])

  // ── Focus when idle ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isProcessing && !initializing) inputRef.current?.focus()
  }, [isProcessing, initializing])

  // ── Auto-dequeue ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isProcessing && taskQueue.length > 0) {
      const [next, ...rest] = taskQueue
      setTaskQueue(rest)
      setTimeout(() => handleSend(next.text, next.images), 200)
    }
  }, [isProcessing]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── handleSend ───────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (overrideText?: string, overrideImages?: AttachedImage[]) => {
    const userMsg = overrideText ?? input
    const currentImages = overrideImages ?? pendingImages
    if (!userMsg.trim()) return

    if (isProcessing && !overrideText) {
      setTaskQueue(prev => [...prev, { text: userMsg, images: currentImages }])
      setInput('')
      setPendingImages([])
      return
    }

    if (!overrideText) {
      setInput('')
      setPendingImages([])
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
      if (cmd === '/debug' && parts[1] === 'loading') { setInitializing(true); return }

      const skillName = cmd.slice(1)
      const knownCmds = ['/clear', '/help', '/reset', '/model', '/apikey', '/tokens', '/cost', '/debug']
      if (!knownCmds.includes(cmd)) {
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: `🎯 Activating skill: ${skillName}...` }])
      }
    }

    let finalMsg = userMsg
    if (mode === 'planner') {
      finalMsg = `[PLANNER MODE PROTOCOL - MANDATORY]\n1. Use 'enter_plan_mode' IMMEDIATELY.\n2. Explore the codebase using read-only tools ONLY.\n3. DESIGN a complete implementation strategy.\n4. Call 'exit_plan_mode' with your Markdown plan to get my approval.\n5. DO NOT ATTEMPT TO EDIT ANY FILES OR RUN EVOLUTIVE SHELL COMMANDS UNTIL I APPROVE THE PLAN.\n\nYour current task is: ${userMsg}`
    } else if (mode === 'colab') {
      finalMsg = `[COLLABORATIVE MODE PROTOCOL - ACTIVE]\n1. You are working in COLLABORATIVE MODE.\n2. You have access to a suite of collaboration tools: 'start_collaboration', 'send_to_advisor', and 'end_collaboration'.\n3. Use 'start_collaboration' to initialize a discussion with an Elite Technical Advisor.\n4. Use 'send_to_advisor' to exchange ideas, ask follow-up questions, and refine your plan.\n5. Once you have a solid strategy approved by the advisor, use 'end_collaboration' and proceed to implementation.\n6. This mode is for COMPLEX architectural discussions. Use it to deliver superior engineering.\n\nYour current task is: ${userMsg}`
    } else if (mode === 'teach') {
      finalMsg = `[TEACHING MODE PROTOCOL - ACTIVE]\n1. You are acting as an Elite Technical Mentor.\n2. For every non-obvious change you make, EXPLAIN why you chose that approach (Y) over common alternatives (X).\n3. Use code blocks to illustrate small comparisons if helpful.\n4. Keep explanations technical yet accessible, focusing on 'na raça' learning (best practices, trade-offs, performance).\n5. Do not just code; educate through your actions.\n\nYour current task is: ${userMsg}`
    }

    const msgId = nextId()
    setMessages(prev => [...prev, { id: msgId, type: 'user', text: userMsg, images: currentImages.length > 0 ? currentImages : undefined }])
    setIsProcessing(true)
    taskStartRef.current = Date.now()
    scheduleScroll()

    const imageParts = currentImages.map(img => ({
      type: 'image' as const,
      image: { type: 'image' as const, dataUrl: img.dataUrl, mimeType: img.mimeType },
    }))

    try {
      await window.koda.sendMessage(msgId, finalMsg, imageParts.length > 0 ? imageParts : undefined)

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
    } catch (err: unknown) {
      chunkBufferRef.current = ''
      const message = err instanceof Error ? err.message : String(err)
      setMessages(prev => [...prev, { id: nextId(), type: 'error', text: message }])
    } finally {
      setIsProcessing(false)
    }
  }, [input, isProcessing, pendingImages, scheduleScroll, mode, chunkBufferRef, rafRef, taskStartRef])

  // ── handlePathClick ──────────────────────────────────────────────────────────
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

  // ── handleRollback ───────────────────────────────────────────────────────────
  const handleRollback = useCallback(async (msgId: number) => {
    if (isProcessing) return
    const confirmed = window.confirm('Rollback to this message?\n\nThis will restore all files to the state they were in BEFORE this message was sent, and erase all subsequent conversation history.')
    if (!confirmed) return

    const res = await window.koda.snapshotRestore(msgId)
    if (!res.success) {
      setMessages(prev => [...prev, { id: nextId(), type: 'error', text: `Rollback failed: ${res.error}` }])
      return
    }
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId)
      return idx === -1 ? prev : prev.slice(0, idx)
    })
  }, [isProcessing])

  // ── handleInjectFile ─────────────────────────────────────────────────────────
  const handleInjectFile = (path: string) => {
    setInput(prev => prev + ` @[${path}] `)
  }

  // ── handlePinFile / handleUnpinFile ──────────────────────────────────────────
  const handlePinFile = useCallback((path: string) => {
    setPinnedFiles(prev => prev.includes(path) ? prev : [...prev, path])
  }, [])

  const handleUnpinFile = useCallback((path: string) => {
    setPinnedFiles(prev => prev.filter(p => p !== path))
  }, [])

  // ── handleInputChange (slash menu + @mentions) ───────────────────────────────
  const handleInputChange = async (val: string) => {
    setInput(val)
    const cursor = inputRef.current?.selectionStart || 0
    const textBefore = val.slice(0, cursor)

    // Slash command menu
    const slashMatch = textBefore.match(/^\/(\S*)$/)
    if (slashMatch) {
      const query = slashMatch[1].toLowerCase()
      const skillItems = availableSkills.map(s => ({ name: `/${s.name}`, description: s.description, icon: '🎯', isSkill: true as const }))
      const allItems = [...STATIC_COMMANDS, ...skillItems]
      const filtered = query ? allItems.filter(c => c.name.slice(1).startsWith(query)) : allItems
      setSlashItems(filtered)
      setShowSlashMenu(filtered.length > 0)
      setSlashIndex(0)
      setShowSuggestions(false)
      return
    }
    setShowSlashMenu(false)

    // @file mentions
    const atMatch = textBefore.match(/@(\S*)$/)
    if (atMatch) {
      const query = atMatch[1].toLowerCase()
      setSuggestionTriggerPos(atMatch.index!)

      let files = allFiles
      if (files.length === 0 && !isFetchingFiles) {
        setIsFetchingFiles(true)
        const res = await window.koda.getFiles()
        if (res.success) { files = res.files; setAllFiles(files) }
        setIsFetchingFiles(false)
      }

      const filtered = files
        .filter(f => {
          const lf = f.toLowerCase()
          return lf.includes(query) || lf.split('/').pop()?.includes(query)
        })
        .sort((a, b) => {
          const an = a.split('/').pop()?.toLowerCase() || ''
          const bn = b.split('/').pop()?.toLowerCase() || ''
          if (an.startsWith(query) && !bn.startsWith(query)) return -1
          if (!an.startsWith(query) && bn.startsWith(query)) return 1
          return a.length - b.length
        })
        .slice(0, 10)

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
    const newText = `${textBeforeAt}@[${file}] ${textAfterAt.startsWith(' ') ? textAfterAt.trimStart() : textAfterAt}`
    setInput(newText)
    setShowSuggestions(false)
    setTimeout(() => {
      inputRef.current?.focus()
      const newPos = textBeforeAt.length + file.length + 4
      inputRef.current?.setSelectionRange(newPos, newPos)
    }, 0)
  }

  const selectSlashItem = (item: { name: string; isSkill?: boolean }) => {
    setInput(item.name + ' ')
    setShowSlashMenu(false)
    setTimeout(() => {
      inputRef.current?.focus()
      const pos = item.name.length + 1
      inputRef.current?.setSelectionRange(pos, pos)
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
      }
    }, 0)
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const showThinkingSpinner = isProcessing && (
    messages.length === 0 ||
    (messages[messages.length - 1].type !== 'assistant' &&
      (!messages[messages.length - 1].tool || messages[messages.length - 1].tool?.status === 'done')) ||
    (messages[messages.length - 1].type === 'assistant' && messages[messages.length - 1].done)
  )

  // ────────────────────────────────────────────────────────────────────────────
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
        {pendingPlan && (
          <PlanApprovalModal
            plan={pendingPlan}
            onApprove={() => window.koda.planResponse(true)}
            onReject={() => window.koda.planResponse(false)}
          />
        )}

        {showSettings && (
          <SettingsUI
            onClose={() => setShowSettings(false)}
            defaultProvider={agentInfo.provider}
            defaultModel={agentInfo.model}
            onSave={async (config: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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

        {showMcpSettings && (
          <MCPSettings
            onClose={() => setShowMcpSettings(false)}
            onSave={async () => setShowMcpSettings(false)}
          />
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {(showBrowser || showTerminal) && (
            <>
              <div style={{ width: `${leftPanelWidth}%` }} className="flex flex-col flex-shrink-0 min-w-[250px] relative h-full bg-[#0d1117]">
                {showBrowser && (
                  <div className="flex-shrink-0 min-h-[100px] relative" style={{ height: showTerminal ? `${browserHeight}%` : '100%' }}>
                    <BrowserPreview onClose={() => setShowBrowser(false)} />
                    {isResizingHeight && <div className="absolute inset-0 z-[100] cursor-row-resize" />}
                  </div>
                )}
                {showBrowser && showTerminal && (
                  <div
                    onMouseDown={startResizingHeight}
                    className={`h-1 w-full cursor-row-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${isResizingHeight ? 'bg-indigo-500 h-1.5' : 'bg-white/5 hover:bg-indigo-500/50'}`}
                  >
                    <div className={`w-8 h-[1px] bg-white/20 group-hover:bg-white/50 transition-colors ${isResizingHeight ? 'bg-white' : ''}`} />
                  </div>
                )}
                {showTerminal && (
                  <div className="flex-1 min-h-[100px] relative" style={{ height: showBrowser ? `${100 - browserHeight}%` : '100%' }}>
                    <TerminalPanel onClose={() => setShowTerminal(false)} cwd={agentInfo.cwd} />
                    {isResizingHeight && <div className="absolute inset-0 z-[100] cursor-row-resize" />}
                  </div>
                )}
              </div>

              <div
                onMouseDown={startResizing}
                className={`w-1 h-full cursor-col-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${isResizing ? 'bg-indigo-500 w-1.5' : 'bg-white/5 hover:bg-indigo-500/50'}`}
              >
                <div className={`w-[1px] h-8 bg-white/20 group-hover:bg-white/50 transition-colors ${isResizing ? 'bg-white' : ''}`} />
              </div>
            </>
          )}

          {/* Chat panel */}
          <div
            className="flex flex-col flex-1 px-2 py-4 overflow-hidden relative"
            style={{ width: `${100 - (showBrowser || showTerminal ? leftPanelWidth : 0)}%` }}
          >
            {/* Watermark */}
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

            {/* Header */}
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

            {/* Message area */}
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

            {/* Pending images strip */}
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

            {/* Task Queue indicator */}
            {taskQueue.length > 0 && (
              <div className="flex items-center gap-2 px-3 mb-1 py-1 border-t border-white/5">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">⏳ Queue</span>
                <div className="flex gap-1.5 flex-1 overflow-hidden">
                  {taskQueue.map((t, i) => (
                    <span key={i} className="text-[10px] text-slate-500 font-mono bg-slate-800/60 rounded px-2 py-0.5 truncate max-w-[160px]">{t.text}</span>
                  ))}
                </div>
                <button onClick={() => setTaskQueue([])} className="text-[9px] text-slate-600 hover:text-rose-400 transition-colors" title="Clear queue">✕ clear</button>
              </div>
            )}

            {/* Input */}
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
                    e.target.style.height = 'auto'
                    e.target.style.height = `${e.target.scrollHeight}px`
                  }}
                  onKeyDown={e => {
                    if (showSlashMenu) {
                      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (slashItems[slashIndex]) selectSlashItem(slashItems[slashIndex]) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(prev => (prev > 0 ? prev - 1 : slashItems.length - 1)) }
                      else if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(prev => (prev < slashItems.length - 1 ? prev + 1 : 0)) }
                      else if (e.key === 'Escape') setShowSlashMenu(false)
                      return
                    }
                    if (showSuggestions) {
                      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (suggestions[suggestionIndex]) selectSuggestion(suggestions[suggestionIndex]) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1)) }
                      else if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0)) }
                      else if (e.key === 'Escape') setShowSuggestions(false)
                      return
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
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
                        className={`px-3 py-2 cursor-pointer text-xs flex items-center gap-2.5 transition-colors ${i === slashIndex ? (item.isSkill ? 'bg-amber-900/30 text-amber-300' : 'bg-slate-800/80 text-white') : 'text-slate-400 hover:bg-slate-800/40'}`}
                      >
                        <span className="text-[13px] flex-shrink-0">{item.icon}</span>
                        <span className={`font-bold flex-shrink-0 ${item.isSkill ? 'text-amber-400' : 'text-cyan-400'}`}>{item.name}</span>
                        {item.description && <span className="opacity-50 truncate text-[11px]">{item.description}</span>}
                        {item.isSkill && <span className="ml-auto flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-amber-500/60 bg-amber-900/20 px-1.5 py-0.5 rounded">skill</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File Suggestions Dropdown */}
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
                        className={`px-3 py-2 cursor-pointer text-xs flex items-center gap-2 transition-colors ${i === suggestionIndex ? 'bg-cyan-900/40 text-cyan-400' : 'text-slate-400 hover:bg-slate-800/40'}`}
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

          {/* Context panel */}
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
