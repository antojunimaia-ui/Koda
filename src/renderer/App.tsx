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

// ─── Shared Components ──────────────────────────────────────────────────────
import TitleBar from './components/TitleBar.js'
import MCPSettings from './components/MCPSettings.js'
import BrowserPreview from './components/BrowserPreview.js'
import TerminalPanel from './components/TerminalPanel.js'
import { BrailleSpinner } from './components/BrailleSpinner.js'
import MessageRow from './components/messages/MessageRow.js'
import PlanApprovalModal from './components/modals/PlanApprovalModal.js'
import ContextPanel from './components/context/ContextPanel.js'
import SettingsUI, { DEFAULT_THEME } from './components/settings/SettingsUI.js'

// ─── UI Modes ───────────────────────────────────────────────────────────────
import ClassicUI from './components/classic/ClassicUI.js'
import ModernUI from './components/modern/ModernUI.js'

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
  const [agentInfo, setAgentInfo] = useState<AgentInfo>({ providerId: '...', provider: '...', model: '...', advisorModel: '...', project: '...', cwd: '...' })
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
      if (saved) {
        const parsed = JSON.parse(saved)
        // Set defaults for new settings if missing
        return {
          browserPosition: 'left',
          terminalPosition: 'left',
          showIconBar: true,
          ...parsed
        }
      }
    } catch { }
    return {
      showTerminal: true, showShellWait: true, showFileRead: true, showFileEdit: true,
      showFileWrite: true, showListDir: true, showFileFind: true, showSearch: true,
      showLspQuery: true, showBrowserAgent: true, showPlanMode: true, showColab: true,
      showPty: true,
      uiMode: 'classic',
      browserPosition: 'left',
      terminalPosition: 'left',
      showIconBar: true
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
  const virtuosoRef = useRef<VirtuosoHandle | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Debounced scroll ────────────────────────────────────────────────────────
  // Only used for discrete events (new tool message, error, etc.)
  // Text streaming scroll is handled by Virtuoso's followOutput prop.
  const scheduleScroll = useCallback(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'auto' })
    }, 80)
  }, [messages.length])

  // ── Custom hooks ────────────────────────────────────────────────────────────
  const { 
    leftPanelWidth, 
    rightPanelWidth, 
    browserHeight, 
    isResizing, 
    isResizingRight, 
    isResizingHeight, 
    startResizing, 
    startResizingRight, 
    startResizingHeight 
  } = useResizable()
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
    const { colors: c } = theme

    // Base surfaces
    root.style.setProperty('--koda-bg',           c.bg)
    root.style.setProperty('--koda-bg-alt',       c.bgAlt)
    root.style.setProperty('--koda-sidebar',      c.sidebar)

    // Typography
    root.style.setProperty('--koda-text',         c.text)
    root.style.setProperty('--koda-text-dim',     c.textDim)
    root.style.setProperty('--koda-text-faint',   c.textFaint)

    // Borders
    root.style.setProperty('--koda-border',       c.border)
    root.style.setProperty('--koda-border-faint', c.borderFaint)

    // Accents
    root.style.setProperty('--koda-accent',       c.accent)
    root.style.setProperty('--koda-accent-alt',   c.accentAlt)
    root.style.setProperty('--koda-accent-glow',  c.accentGlow)

    // Status
    root.style.setProperty('--koda-status-ok',    c.statusOk)
    root.style.setProperty('--koda-status-busy',  c.statusBusy)
    root.style.setProperty('--koda-status-error', c.statusError)
    root.style.setProperty('--koda-status-info',  c.statusInfo)

    // Code / terminal
    root.style.setProperty('--koda-code-bg',      c.codeBg)
    root.style.setProperty('--koda-code-text',    c.codeText)
    root.style.setProperty('--koda-code-syntax',  c.codeSyntax)
    root.style.setProperty('--koda-inline-code',  c.inlineCode)

    // Message bubbles
    root.style.setProperty('--koda-user-msg',     c.userMsg)
    root.style.setProperty('--koda-tool-msg',     c.toolMsg)
  }, [theme])

  // ── Agent initialization ────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.koda) return

    window.koda.init().then(async (res: any) => { 
      if (res.success) {
        const base = JSON.parse(localStorage.getItem('koda_approved_base') || '[]')
        const full = JSON.parse(localStorage.getItem('koda_approved_full') || '[]')
        window.koda.updateApprovedCommands({ base, full })

        window.koda.listSkills().then((r: any) => { 
          if (r.success && r.skills) setAvailableSkills(r.skills)
        })

        if (Notification.permission === 'default') Notification.requestPermission()

        const savedKey = localStorage.getItem('koda_api_key')
        const savedProvider = localStorage.getItem('koda_provider')
        const savedModel = localStorage.getItem('koda_model')
        const savedAdvisor = localStorage.getItem('koda_advisor_model')

        if (savedKey || savedProvider || savedModel) {
          try {
            const setupRes = await window.koda.setup({ 
              apiKey: savedKey || undefined,
              provider: savedProvider || undefined,
              model: savedModel || undefined,
              advisorModel: savedAdvisor || undefined
            })
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
  }, [loadSession])

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
  }, [isProcessing])

  // ── handleSend ───────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (overrideText?: string, overrideImages?: AttachedImage[]) => {
    const userMsg = overrideText ?? input
    const currentImages = overrideImages ?? pendingImages
    if (!userMsg.trim()) return

    if (isProcessing && !overrideText) {
      setTaskQueue(prev => [...prev, { text: userMsg, images: currentImages }])
      setInput('')
      setPendingImages([])
      setShowSlashMenu(false)
      setShowSuggestions(false)
      return
    }


    if (!overrideText) {
      setInput('')
      setPendingImages([])
      setShowSlashMenu(false)
      setShowSuggestions(false)
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

      const knownCmds = ['/clear', '/help', '/reset', '/model', '/apikey', '/tokens', '/cost', '/debug']
      const skillName = cmd.slice(1)
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
    } catch (err: any) {
      chunkBufferRef.current = ''
      const message = err.message || String(err)
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

  const handleInjectFile = (path: string) => setInput(prev => prev + ` @[${path}] `)
  const handlePinFile = (path: string) => setPinnedFiles(prev => prev.includes(path) ? prev : [...prev, path])
  const handleUnpinFile = (path: string) => setPinnedFiles(prev => prev.filter(p => p !== path))

  // ── handleStop ───────────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    chunkBufferRef.current = ''
    setIsProcessing(false)
    await window.koda.softReset()
  }, [chunkBufferRef, rafRef])

  // ── handlePaste ─────────────────────────────────────────────────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = () => setPendingImages(prev => [...prev, { dataUrl: reader.result as string, mimeType: file.type, name: file.name || 'pasted.png' }])
          reader.readAsDataURL(file)
        }
      }
    }
  }, [])

  // ── handleInputChange ────────────────────────────────────────────────────────
  const handleInputChange = async (val: string) => {
    setInput(val)
    const cursor = inputRef.current?.selectionStart || 0
    const textBefore = val.slice(0, cursor)

    const slashMatch = textBefore.match(/^\/(\S*)$/)
    if (slashMatch) {
      const query = slashMatch[1].toLowerCase()
      const skillItems = availableSkills.map(s => ({ name: `/${s.name}`, description: s.description, icon: '🎯', isSkill: true as const }))
      const allItems = [...STATIC_COMMANDS, ...skillItems]
      const filtered = query ? allItems.filter(c => c.name.slice(1).startsWith(query)) : allItems
      setSlashItems(filtered)
      setShowSlashMenu(filtered.length > 0)
      setSlashIndex(0)
      return
    }
    setShowSlashMenu(false)

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
      const filtered = files.filter(f => f.toLowerCase().includes(query)).slice(0, 10)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
      setSuggestionIndex(0)
    } else {
      setShowSuggestions(false)
    }
  }

  const selectSuggestion = (file: string) => {
    const textBeforeAt = input.slice(0, suggestionTriggerPos)
    const textAfterAt = input.slice(inputRef.current?.selectionStart || 0)
    setInput(`${textBeforeAt}@[${file}] ${textAfterAt.trimStart()}`)
    setShowSuggestions(false)
  }

  const selectSlashItem = (item: any) => {
    setInput(item.name + ' ')
    setShowSlashMenu(false)
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const showThinkingSpinner = !!(isProcessing && (
    messages.length === 0 ||
    (messages[messages.length - 1].type !== 'assistant' &&
      (!messages[messages.length - 1].tool || messages[messages.length - 1].tool?.status === 'done')) ||
    (messages[messages.length - 1].type === 'assistant' && messages[messages.length - 1].done)
  ))

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full relative overflow-hidden bg-slate-950">
      {/* Overlays & Modals */}
      {showSettings && (
        <SettingsUI
          onClose={() => setShowSettings(false)}
          defaultProvider={agentInfo.providerId || agentInfo.provider}
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

      {showMcpSettings && (
        <MCPSettings
          onClose={() => setShowMcpSettings(false)}
          onSave={async () => setShowMcpSettings(false)}
        />
      )}

      {pendingPlan && (
        <PlanApprovalModal
          plan={pendingPlan}
          onApprove={() => window.koda.planResponse(true)}
          onReject={() => window.koda.planResponse(false)}
        />
      )}

      {/* Main UI Switch */}
      {kodaSettings.uiMode === 'modern' ? (
        <ModernUI
          messages={messages}
          input={input}
          setInput={setInput}
          isProcessing={isProcessing}
          agentInfo={agentInfo}
          mode={mode}
          setMode={setMode}
          pendingImages={pendingImages}
          setPendingImages={setPendingImages}
          handleSend={handleSend}
          handleStop={handleStop}
          handlePathClick={handlePathClick}
          handleInputChange={handleInputChange}
          handleRollback={handleRollback}
          inputRef={inputRef}
          virtuosoRef={virtuosoRef}
          theme={theme}
          kodaSettings={kodaSettings}
          onSettingsClick={() => setShowSettings(true)}
          onMcpClick={() => setShowMcpSettings(true)}
          onBrowserClick={() => setShowBrowser(p => !p)}
          showBrowser={showBrowser}
          onTerminalClick={() => setShowTerminal(p => !p)}
          showTerminal={showTerminal}
          showPanel={showPanel}
          onTogglePanel={() => setShowPanel(p => !p)}
          
          // Layout state
          leftPanelWidth={leftPanelWidth}
          rightPanelWidth={rightPanelWidth}
          startResizing={startResizing}
          isResizing={isResizing}
          startResizingRight={startResizingRight}
          isResizingRight={isResizingRight}
          browserHeight={browserHeight}
          isResizingHeight={isResizingHeight}
          startResizingHeight={startResizingHeight}

          slashItems={slashItems}
          showSlashMenu={showSlashMenu}
          slashIndex={slashIndex}
          selectSlashItem={selectSlashItem}
          setSlashIndex={setSlashIndex}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          suggestionIndex={suggestionIndex}
          selectSuggestion={selectSuggestion}
          setSuggestionIndex={setSuggestionIndex}
        />
      ) : (
        <ClassicUI
          // State
          messages={messages}
          input={input}
          setInput={setInput}
          initializing={initializing}
          isProcessing={isProcessing}
          agentInfo={agentInfo}
          mode={mode}
          setMode={setMode}
          pendingImages={pendingImages}
          setPendingImages={setPendingImages}
          taskQueue={taskQueue}
          setTaskQueue={setTaskQueue}
          
          // Callbacks
          handleSend={handleSend}
          handlePathClick={handlePathClick}
          handleInputChange={handleInputChange}
          handleRollback={handleRollback}
          inputRef={inputRef}
          virtuosoRef={virtuosoRef}
          
          // Config
          theme={theme}
          kodaSettings={kodaSettings}
          
          // Toolbar Actions
          onSettingsClick={() => setShowSettings(true)}
          onMcpClick={() => setShowMcpSettings(true)}
          onBrowserClick={() => setShowBrowser(p => !p)}
          showBrowser={showBrowser}
          onTerminalClick={() => setShowTerminal(p => !p)}
          showTerminal={showTerminal}
          showPanel={showPanel}
          onTogglePanel={() => setShowPanel(p => !p)}
          
          // Layout state
          leftPanelWidth={leftPanelWidth}
          rightPanelWidth={rightPanelWidth}
          startResizing={startResizing}
          isResizing={isResizing}
          startResizingRight={startResizingRight}
          isResizingRight={isResizingRight}
          browserHeight={browserHeight}
          isResizingHeight={isResizingHeight}
          startResizingHeight={startResizingHeight}
          
          // Drag & Drop
          isDragging={isDragging}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          
          // Internal flags
          inPlanMode={inPlanMode}
          showThinkingSpinner={showThinkingSpinner}
          symbols={symbols}
          
          // Slash Menu & Suggestions
          slashItems={slashItems}
          showSlashMenu={showSlashMenu}
          slashIndex={slashIndex}
          selectSlashItem={selectSlashItem}
          setSlashIndex={setSlashIndex}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          suggestionIndex={suggestionIndex}
          selectSuggestion={selectSuggestion}
          setSuggestionIndex={setSuggestionIndex}
        />
      )}


      {/* Universal Context Panel Overlay */}
      {showPanel && (
        <div 
          className="absolute top-10 bottom-0 right-0 z-50 animate-in slide-in-from-right duration-200 shadow-2xl flex"
          style={{ backgroundColor: 'var(--koda-sidebar)' }}
        >
           <ContextPanel 
             files={trackedFiles} 
             pinnedFiles={pinnedFiles} 
             onPin={handlePinFile} 
             onUnpin={handleUnpinFile} 
             onInject={handleInjectFile}
             cwd={agentInfo.cwd}
           />
        </div>
      )}
    </div>
  )
}

export default App
