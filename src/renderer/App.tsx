import React, { useState, useEffect, useRef, useCallback } from 'react'
// @ts-ignore
import 'highlight.js/styles/tokyo-night-dark.css'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

// ─── Types ────────────────────────────────────────────────────────────────────
import { MessageEntry, KodaSettings, KodaTheme, TrackedFile, AttachedFile, AgentInfo, Mode, SlashItem, Workspace } from './types/index.js'

// ─── Hooks ───────────────────────────────────────────────────────────────────
import { useResizable } from './hooks/useResizable.js'
import { useDragDrop } from './hooks/useDragDrop.js'
import { useAgentStream, nextId } from './hooks/useAgentStream.js'
import { useSession } from './hooks/useSession.js'
import { sessionStorage as kodaSessionStorage } from './hooks/useSessionStorage.js'

// ─── Shared Components ──────────────────────────────────────────────────────
import TitleBar from './components/TitleBar.js'
import MCPSettings from './components/MCPSettings.js'
import BrowserPreview from './components/BrowserPreview.js'
import TerminalPanel from './components/TerminalPanel.js'
import { BrailleSpinner } from './components/BrailleSpinner.js'
import MessageRow from './components/messages/MessageRow.js'
import PlanApprovalModal from './components/modals/PlanApprovalModal.js'
import UpdateBanner from './components/UpdateBanner.js'
import ContextPanel, { ContextPanelOverlay, ExplorerTabButton } from './components/context/ContextPanel.js'
import { ExplorerPanelOverlay } from './components/context/ContextPanel.js'
import SettingsUI, { DEFAULT_THEME } from './components/settings/SettingsUI.js'

// ─── UI Modes ───────────────────────────────────────────────────────────────
import ClassicUI from './components/classic/ClassicUI.js'
import ModernUI from './components/modern/ModernUI.js'
import SplitView from './components/SplitView.js'

const SYMBOLS = {
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
  // ── Multi-Workspace state ───────────────────────────────────────────────────
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isSplitEnabled, setIsSplitEnabled] = useState(false)
  const [splitViewIds, setSplitViewIds] = useState<[string, string] | null>(null)

  // Derived active workspace
  const activeWorkspace = workspaces.find(w => w.id === activeId) || null

  const updateWorkspace = useCallback((id: string, updates: Partial<Workspace> | ((prev: Workspace) => Workspace)) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== id) return w
      if (typeof updates === 'function') return updates(w)
      return { ...w, ...updates }
    }))
  }, [])

  // ── Shared UI state (non-workspace specific) ────────────────────────────────
  const [input, setInput] = useState('')
  const [initializing, setInitializing] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showMcpSettings, setShowMcpSettings] = useState(false)
  const [showBrowser, setShowBrowser] = useState(false)
  // ── Auto-updater state ──────────────────────────────────────────────────────
  const [updateInfo, setUpdateInfo] = useState<{ version?: string; downloaded: boolean } | null>(null)
  const [showTerminal, setShowTerminal] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [contextPanelTab, setContextPanelTab] = useState<'context' | 'explorer'>('context')
  const [showExplorer, setShowExplorer] = useState(false)
  
  // ── Suggestions state (shared) ──────────────────────────────────────────────
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
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // ── Persisted settings & theme ──────────────────────────────────────────────
  const [kodaSettings, setKodaSettings] = useState<KodaSettings>(() => {
    try {
      const saved = localStorage.getItem('koda_settings')
      if (saved) return { browserPosition: 'left', terminalPosition: 'left', showIconBar: true, explorerButtonPosition: 'iconbar', explorerTabPosition: 'panel', showExplorerPanel: false, showEditorPanel: false, ...JSON.parse(saved) }
    } catch { }
    return {
      showTerminal: true, showShellWait: true, showFileRead: true, showFileEdit: true,
      showFileWrite: true, showListDir: true, showFileFind: true, showSearch: true,
      showLspQuery: true, showBrowserAgent: true, showPlanMode: true, showColab: true,
      showPty: true, uiMode: 'modern', toolViewMode: 'standard', browserPosition: 'left', terminalPosition: 'left', showIconBar: true, explorerButtonPosition: 'iconbar', explorerTabPosition: 'panel', showExplorerPanel: false, showEditorPanel: false
    }
  })

  const [theme, setTheme] = useState<KodaTheme>(() => {
    try {
      const saved = localStorage.getItem('koda_theme')
      if (saved) return JSON.parse(saved)
    } catch { }
    return DEFAULT_THEME
  })

  // ── Workspace Actions ───────────────────────────────────────────────────────
  const createNewWorkspace = useCallback(async (cwd?: string) => {
    const id = Math.random().toString(36).substring(7)
    const newWorkspace: Workspace = {
      id,
      name: `Workspace ${workspaces.length + 1}`,
      cwd: cwd || '...',
      messages: [],
      isProcessing: false,
      agentInfo: { providerId: '...', provider: '...', model: '...', advisorModel: '...', project: '...', cwd: cwd || '...' },
      mode: 'fast',
      trackedFiles: [],
      pinnedFiles: [],
      inputFiles: [],
      pendingImages: [],
      taskQueue: [],
      pendingPlan: null,
      pendingQuestions: null,
      pendingShell: null,
      inPlanMode: false,
      terminalOutput: '',
      currentSessionId: null
    }
    
    setWorkspaces(prev => [...prev, newWorkspace])
    setActiveId(id)
    
    // Initialize backend agent
    await window.koda.init(id)
    if (cwd) {
      await window.koda.cd(id, cwd)
    }
    const info = await window.koda.getInfo(id)
    updateWorkspace(id, { agentInfo: info, cwd: info.cwd })
  }, [workspaces.length, updateWorkspace])

  // ── Refs ────────────────────────────────────────────────────────────────────
  const virtuosoRef = useRef<VirtuosoHandle | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref para o sessionId atual — evita re-disparar o auto-save ao atualizar o workspace
  const sessionIdRef = useRef<Map<string, string>>(new Map())

  // ── Debounced scroll ────────────────────────────────────────────────────────
  const scheduleScroll = useCallback((workspaceId: string) => {
    // Removed manual scrollToIndex - let Virtuoso's followOutput handle it
  }, [activeId, activeWorkspace?.messages.length])

  // ── Custom hooks ────────────────────────────────────────────────────────────
  const { 
    leftPanelWidth, 
    rightPanelWidth, 
    browserHeight, 
    contextPanelWidth,
    isResizing, 
    isResizingRight, 
    isResizingHeight,
    isResizingContext,
    startResizing, 
    startResizingRight, 
    startResizingHeight,
    startResizingContext,
  } = useResizable()
  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useDragDrop({ 
    setInput, 
    setPendingImages: (imgs: AttachedFile[] | ((p: AttachedFile[]) => AttachedFile[])) => {
      if (!activeId) return
      updateWorkspace(activeId, (prev: Workspace) => ({
        ...prev,
        pendingImages: typeof imgs === 'function' ? imgs(prev.pendingImages) : imgs
      }))
    }
  })

  // Each workspace keeps its own last-loaded CWD to prevent cross-workspace contamination
  const lastLoadedCwdPerWs = useRef<Map<string, string>>(new Map())

  const { loadSession } = useSession({ 
    setMessages: (msgs: MessageEntry[] | ((p: MessageEntry[]) => MessageEntry[]), wsId?: string) => {
      const targetId = wsId || activeId
      if (!targetId) return
      updateWorkspace(targetId, (prev: Workspace) => ({
        ...prev,
        messages: typeof msgs === 'function' ? msgs(prev.messages) : msgs
      }))
    }, 
    setPinnedFiles: (files: string[] | ((p: string[]) => string[]), wsId?: string) => {
      const targetId = wsId || activeId
      if (!targetId) return
      updateWorkspace(targetId, (prev: Workspace) => ({
        ...prev,
        pinnedFiles: typeof files === 'function' ? files(prev.pinnedFiles) : files
      }))
    }
  })

  const { chunkBuffersRef, rafRefs, taskStartsRef, scheduleFlush } = useAgentStream({
    onUpdate: (id, update) => updateWorkspace(id, (prev: Workspace) => ({ ...prev, messages: update(prev.messages) })),
    onAgentInfo: (id, info) => updateWorkspace(id, { agentInfo: info, cwd: info.cwd }),
    onProcessing: (id, processing) => updateWorkspace(id, { isProcessing: processing }),
    onTrackedFiles: (id, files) => updateWorkspace(id, { trackedFiles: files }),
    onPendingPlan: (id, plan) => updateWorkspace(id, { pendingPlan: plan }),
    onPendingQuestions: (id, questions) => updateWorkspace(id, { pendingQuestions: questions }),
    onPendingShell: (id, shell) => updateWorkspace(id, { pendingShell: shell }),
    onPlanMode: (id, inPlanMode) => updateWorkspace(id, { inPlanMode }),
    scheduleScroll,
    activeWorkspaceId: activeId,
  })

  // ── Session context switch — per-workspace, won't fire on tab switch ─────────
  useEffect(() => {
    if (!activeWorkspace) return
    const cwd = activeWorkspace.agentInfo.cwd
    if (!cwd || cwd === '...') return
    const lastCwd = lastLoadedCwdPerWs.current.get(activeWorkspace.id)
    if (cwd === lastCwd) return   // same CWD — tab switch or re-render, skip
    lastLoadedCwdPerWs.current.set(activeWorkspace.id, cwd)
    const sessionId = loadSession(cwd, activeWorkspace.id)
    if (sessionId) {
      sessionIdRef.current.set(activeWorkspace.id, sessionId)
      updateWorkspace(activeWorkspace.id, { currentSessionId: sessionId })
    }
  }, [activeWorkspace?.id, activeWorkspace?.agentInfo.cwd])

  // ── Auto-save (debounced 1s) ────────────────────────────────────────────────
  useEffect(() => {
    if (initializing || !activeWorkspace || !activeWorkspace.agentInfo.cwd || activeWorkspace.agentInfo.cwd === '...') return
    if (activeWorkspace.messages.length === 0) return

    const wsId = activeWorkspace.id
    const cwd = activeWorkspace.agentInfo.cwd
    const messages = activeWorkspace.messages
    const pinnedFiles = activeWorkspace.pinnedFiles

    const timer = setTimeout(() => {
      // Pega ou gera o sessionId via ref — não dispara re-render
      let sessionId = sessionIdRef.current.get(wsId)
      if (!sessionId) {
        // Verifica se já existe um sessionId no workspace state
        if (activeWorkspace.currentSessionId) {
          sessionId = activeWorkspace.currentSessionId
          sessionIdRef.current.set(wsId, sessionId)
        } else {
          // Só gera novo ID se realmente não existir
          sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          sessionIdRef.current.set(wsId, sessionId)
          updateWorkspace(wsId, { currentSessionId: sessionId })
        }
      }

      // Salva no localStorage — sem IPC, sem race condition
      kodaSessionStorage.save(cwd, { 
        id: sessionId, 
        messages, 
        pinnedFiles, 
        timestamp: Date.now() 
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [activeWorkspace?.messages, activeWorkspace?.pinnedFiles, activeWorkspace?.agentInfo.cwd, initializing])

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

    // Initialize with a default workspace if none exist
    if (workspaces.length === 0) {
      const savedKey = localStorage.getItem('koda_api_key')
      const savedProvider = localStorage.getItem('koda_provider')
      const savedModel = localStorage.getItem('koda_model')
      const savedAdvisor = localStorage.getItem('koda_advisor_model')

      const initialId = Math.random().toString(36).substring(7)
      window.koda.init(initialId).then(async (res: any) => {
        if (res.success) {
          const base = JSON.parse(localStorage.getItem('koda_approved_base') || '[]')
          const full = JSON.parse(localStorage.getItem('koda_approved_full') || '[]')
          window.koda.updateApprovedCommands({ base, full })

          if (savedKey || savedProvider || savedModel) {
            try {
              const setupRes = await window.koda.setup(initialId, { 
                apiKey: savedKey || undefined,
                provider: savedProvider || undefined,
                model: savedModel || undefined,
                advisorModel: savedAdvisor || undefined
              })
              if (setupRes.success) {
                const initialWs: Workspace = {
                  id: initialId,
                  name: 'Main Workspace',
                  cwd: setupRes.info.cwd,
                  messages: [],
                  isProcessing: false,
                  agentInfo: setupRes.info,
                  mode: 'fast',
                  trackedFiles: [],
                  pinnedFiles: [],
                  inputFiles: [],
                  pendingImages: [],
                  taskQueue: [],
                  pendingPlan: null,
                  pendingQuestions: null,
                  pendingShell: null,
                  inPlanMode: false,
                  terminalOutput: '',
                  currentSessionId: null
                }
                setWorkspaces([initialWs])
                setActiveId(initialId)
                const sessionId = loadSession(setupRes.info.cwd, initialId)
                if (sessionId) {
                  sessionIdRef.current.set(initialId, sessionId)
                  setWorkspaces(prev => prev.map(w => w.id === initialId ? { ...w, currentSessionId: sessionId } : w))
                }
              }
            } catch { }
          } else {
             const initialWs: Workspace = {
                id: initialId,
                name: 'Main Workspace',
                cwd: res.info.cwd,
                messages: [],
                isProcessing: false,
                agentInfo: res.info,
                mode: 'fast',
                trackedFiles: [],
                pinnedFiles: [],
                inputFiles: [],
                pendingImages: [],
                taskQueue: [],
                pendingPlan: null,
                pendingQuestions: null,
                pendingShell: null,
                inPlanMode: false,
                terminalOutput: '',
                currentSessionId: null
              }
              setWorkspaces([initialWs])
              setActiveId(initialId)
              const sessionId = loadSession(res.info.cwd, initialId)
              if (sessionId) {
                sessionIdRef.current.set(initialId, sessionId)
                setWorkspaces(prev => prev.map(w => w.id === initialId ? { ...w, currentSessionId: sessionId } : w))
              }
          }
        }
        setInitializing(false)
      })
    }

    window.koda.listSkills().then((r: any) => { 
      if (r.success && r.skills) setAvailableSkills(r.skills)
    })
    if (Notification.permission === 'default') Notification.requestPermission()

    // Auto-updater listener
    const unsubUpdater = window.koda.onUpdaterEvent?.((event, data) => {
      if (event === 'update-available') setUpdateInfo({ version: data?.version, downloaded: false })
      if (event === 'update-downloaded') setUpdateInfo(prev => prev ? { ...prev, downloaded: true } : { downloaded: true })
    })
    return () => { unsubUpdater?.() }
  }, [])

  // ── Refresh skills when marketplace installs/uninstalls ──────────────────────
  useEffect(() => {
    const refresh = () => {
      window.koda.listSkills().then((r: any) => {
        if (r.success && r.skills) setAvailableSkills(r.skills)
      })
    }
    window.addEventListener('koda:skills-changed', refresh)
    return () => window.removeEventListener('koda:skills-changed', refresh)
  }, [])

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
          if (activeWorkspace) window.koda.openFile(activeWorkspace.id, decoded.substring(0, lastColon), parseInt(decoded.substring(lastColon + 1), 10))
        } else {
          if (activeWorkspace) window.koda.openFile(activeWorkspace.id, decoded)
        }
      }
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [activeWorkspace])

  // ── Focus when idle ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeWorkspace?.isProcessing && !initializing) inputRef.current?.focus()
  }, [activeWorkspace?.isProcessing, initializing])

  // ── Session Management ──────────────────────────────────────────────────────
  const handleNewSession = useCallback(() => {
    if (!activeId) return
    sessionIdRef.current.delete(activeId) // limpa o ID da ref pra gerar um novo
    updateWorkspace(activeId, { 
      messages: [], 
      pinnedFiles: [],
      inputFiles: [],
      currentSessionId: null
    })
    window.koda.softReset(activeId)
  }, [activeId, updateWorkspace])

  const handleLoadSession = useCallback(async (sessionId: string) => {
    if (!activeId || !activeWorkspace) return
    try {
      const session = kodaSessionStorage.get(activeWorkspace.agentInfo.cwd, sessionId)
      if (session) {
        sessionIdRef.current.set(activeId, sessionId)
        updateWorkspace(activeId, {
          messages: session.messages || [],
          pinnedFiles: session.pinnedFiles || [],
          inputFiles: [],
          currentSessionId: sessionId
        })
        await window.koda.softReset(activeId)
      }
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  }, [activeId, activeWorkspace, updateWorkspace])

  // ── Auto-dequeue ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeWorkspace && !activeWorkspace.isProcessing && activeWorkspace.taskQueue.length > 0) {
      const [next, ...rest] = activeWorkspace.taskQueue
      updateWorkspace(activeWorkspace.id, { taskQueue: rest })
      setTimeout(() => handleSend(next.text, next.images), 200)
    }
  }, [activeWorkspace?.isProcessing])

  // ── handleSend (workspace-targeted) ─────────────────────────────────────────
  const handleSendForWs = useCallback(async (overrideText?: string, overrideImages?: AttachedFile[], wsId?: string) => {
    const targetId = wsId || activeId
    const ws = workspaces.find(w => w.id === targetId)
    if (!ws) return
    
    // Append inputFiles to the message
    let userMsg = overrideText ?? input
    if ((ws.inputFiles || []).length > 0 && !overrideText) {
      const filesText = ws.inputFiles.map(f => ` @[${f}]`).join('')
      userMsg = userMsg + filesText
    }
    
    const currentImages = overrideImages ?? ws.pendingImages
    if (!userMsg.trim()) return

    if (ws.isProcessing && !overrideText) {
      updateWorkspace(ws.id, (prev: Workspace) => ({
        ...prev,
        taskQueue: [...prev.taskQueue, { text: userMsg, images: currentImages }]
      }))
      if (!wsId) { setInput(''); setShowSlashMenu(false); setShowSuggestions(false) }
      return
    }

    if (!overrideText && !wsId) {
      setInput('')
      updateWorkspace(ws.id, { pendingImages: [], inputFiles: [] })
      setShowSlashMenu(false)
      setShowSuggestions(false)
      setHistory((prev: string[]) => prev[0] === userMsg ? prev : [userMsg, ...prev])
      setHistoryIndex(-1)
    }

    if (userMsg.startsWith('/')) {
      const parts = userMsg.toLowerCase().split(' ')
      const cmd = parts[0]

      if (cmd === '/clear') { updateWorkspace(ws.id, { messages: [] }); return }
      if (cmd === '/help') {
        updateWorkspace(ws.id, (prev: Workspace) => ({
          ...prev,
          messages: [...prev.messages, { id: nextId(), type: 'system', text: 'Available commands:\n/help - Show this help\n/clear - Clear messages\n/reset - Reset conversation\n/model [--name] - View or switch model' }]
        }))
        return
      }
      if (cmd === '/reset') {
        await window.koda.reset(ws.id)
        updateWorkspace(ws.id, (prev: Workspace) => ({
          ...prev,
          messages: [...prev.messages, { id: nextId(), type: 'system', text: 'Conversation reset!' }]
        }))
        return
      }
      if (cmd === '/model') {
        const modelArg = parts[1]
        if (modelArg?.startsWith('--')) {
          const res = await window.koda.setModel(ws.id, modelArg.slice(2))
          if (res.success) {
            updateWorkspace(ws.id, { agentInfo: res.info })
            updateWorkspace(ws.id, (prev: Workspace) => ({
              ...prev,
              messages: [...prev.messages, { id: nextId(), type: 'system', text: `🤖 Model updated to: ${res.info.model} (${res.info.provider})` }]
            }))
          } else {
            updateWorkspace(ws.id, (prev: Workspace) => ({
              ...prev,
              messages: [...prev.messages, { id: nextId(), type: 'error', text: res.error }]
            }))
          }
          return
        }
        const info = await window.koda.getInfo(ws.id)
        updateWorkspace(ws.id, (prev: Workspace) => ({
          ...prev,
          messages: [...prev.messages, { id: nextId(), type: 'system', text: `Provider: ${info.provider} | Model: ${info.model}` }]
        }))
        return
      }
      if (cmd === '/apikey') {
        const key = parts[1]
        if (!key) { 
          updateWorkspace(ws.id, (prev: Workspace) => ({
            ...prev,
            messages: [...prev.messages, { id: nextId(), type: 'error', text: 'Usage: /apikey <key>' }]
          }))
          return 
        }
        const res = await window.koda.setApiKey(ws.id, key)
        if (res.success) {
          updateWorkspace(ws.id, { agentInfo: res.info })
          updateWorkspace(ws.id, (prev: Workspace) => ({
            ...prev,
            messages: [...prev.messages, { id: nextId(), type: 'system', text: '🔑 API Key updated successfully!' }]
          }))
        } else {
          updateWorkspace(ws.id, (prev: Workspace) => ({
            ...prev,
            messages: [...prev.messages, { id: nextId(), type: 'error', text: res.error }]
          }))
        }
        return
      }

      const knownCmds = ['/clear', '/help', '/reset', '/model', '/apikey', '/tokens', '/cost', '/debug']
      const skillName = cmd.slice(1)
      if (!knownCmds.includes(cmd)) {
        updateWorkspace(ws.id, (prev: Workspace) => ({
          ...prev,
          messages: [...prev.messages, { id: nextId(), type: 'system', text: `🎯 Activating skill: ${skillName}...` }]
        }))
      }
    }

    let finalMsg = userMsg
    if (ws.mode === 'planner') {
      finalMsg = `[PLANNER MODE PROTOCOL - MANDATORY]\n1. Use 'enter_plan_mode' IMMEDIATELY.\n2. Explore the codebase using read-only tools ONLY.\n3. DESIGN a complete implementation strategy.\n4. Call 'exit_plan_mode' with your Markdown plan to get my approval.\n5. DO NOT ATTEMPT TO EDIT ANY FILES OR RUN EVOLUTIVE SHELL COMMANDS UNTIL I APPROVE THE PLAN.\n\nYour current task is: ${userMsg}`
    } else if (ws.mode === 'colab') {
      finalMsg = `[COLLABORATIVE MODE PROTOCOL - ACTIVE]\n1. You are working in COLLABORATIVE MODE.\n2. You have access to a suite of collaboration tools: 'start_collaboration', 'send_to_advisor', and 'end_collaboration'.\n3. Use 'start_collaboration' to initialize a discussion with an Elite Technical Advisor.\n4. Use 'send_to_advisor' to exchange ideas, ask follow-up questions, and refine your plan.\n5. Once you have a solid strategy approved by the advisor, use 'end_collaboration' and proceed to implementation.\n6. This mode is for COMPLEX architectural discussions. Use it to deliver superior engineering.\n\nYour current task is: ${userMsg}`
    } else if (ws.mode === 'teach') {
      finalMsg = `[TEACH & CODE MODE — ACTIVE]\nYou are now a hands-on programming instructor. You will BUILD the solution live, as if teaching a class. Follow this structure for every meaningful step:\n\n📖 CONCEPT FIRST — Before writing code, briefly introduce the concept or technique you are about to use. One or two sentences max. Why does it exist? What problem does it solve?\n\n💻 CODE — Write the code. Keep it clean and intentional.\n\n🔍 BREAKDOWN — After each block, explain what each key part does. Point out non-obvious decisions. If you chose approach A over B, say why (performance, readability, correctness, convention).\n\n⚠️ WATCH OUT — Flag common mistakes, gotchas, or edge cases a student might miss.\n\n🎯 LESSON — End each major step with one clear takeaway sentence. What should the student remember from this?\n\nRules:\n- Write as if the student is watching your screen and learning in real time.\n- Never just dump code without explanation.\n- Use analogies when a concept is abstract.\n- Keep a natural teaching rhythm — not every line needs a lecture, only the meaningful ones.\n- Respond in the same language the student used.\n\nYour current task is: ${userMsg}`
    }

    const msgId = nextId()
    updateWorkspace(ws.id, (prev: Workspace) => ({
      ...prev,
      messages: [...prev.messages, { id: msgId, type: 'user', text: userMsg, images: currentImages.length > 0 ? currentImages : undefined }],
      isProcessing: true
    }))
    
    taskStartsRef.current.set(ws.id, Date.now())
    scheduleScroll(ws.id)

    const imageParts = currentImages.map(img => ({
      type: 'image' as const,
      image: { type: 'image' as const, dataUrl: img.dataUrl, mimeType: img.mimeType },
    }))

    try {
      await window.koda.sendMessage(ws.id, msgId, finalMsg, imageParts.length > 0 ? imageParts : undefined)

      const raf = rafRefs.current.get(ws.id)
      if (raf !== null && raf !== undefined) {
        cancelAnimationFrame(raf)
        rafRefs.current.set(ws.id, null)
      }
      const chunk = chunkBuffersRef.current.get(ws.id)
      chunkBuffersRef.current.set(ws.id, '')

      updateWorkspace(ws.id, (prev: Workspace) => {
        const updated = [...prev.messages]
        const last = updated[updated.length - 1]
        if (!last) return prev
        if (chunk) {
          if (last.type === 'assistant' && !last.done) {
            updated[updated.length - 1] = { ...last, text: (last.text || '') + chunk, done: true }
          } else {
            updated.push({ id: nextId(), type: 'assistant', text: chunk, done: true })
          }
        } else if (last.type === 'assistant') {
          updated[updated.length - 1] = { ...last, done: true }
        }
        return { ...prev, messages: updated }
      })
    } catch (err: any) {
      chunkBuffersRef.current.set(ws.id, '')
      const message = err.message || String(err)
      updateWorkspace(ws.id, (prev: Workspace) => ({
        ...prev,
        messages: [...prev.messages, { id: nextId(), type: 'error', text: message }]
      }))
    } finally {
      updateWorkspace(ws.id, { isProcessing: false })
    }
  }, [activeId, workspaces, input, updateWorkspace, scheduleScroll, chunkBuffersRef, rafRefs, taskStartsRef])

  // Legacy wrapper — used by ClassicUI/ModernUI which don't pass wsId
  const handleSend = useCallback((overrideText?: string, overrideImages?: AttachedFile[]) => {
    return handleSendForWs(overrideText, overrideImages, undefined)
  }, [handleSendForWs])


  // ── handlePathClick ──────────────────────────────────────────────────────────
  const handlePathClick = async () => {
    if (!activeWorkspace) return
    const newPath = await window.koda.selectDirectory()
    if (newPath) {
      setInitializing(true)
      const res = await window.koda.cd(activeWorkspace.id, newPath)
      if (res.success) {
        setAllFiles([]) // Limpa o cache de arquivos para o novo projeto
        updateWorkspace(activeWorkspace.id, { agentInfo: res.info, cwd: res.info.cwd })
        updateWorkspace(activeWorkspace.id, (prev: Workspace) => ({
          ...prev,
          messages: [...prev.messages, { id: nextId(), type: 'system', text: `📂 Working directory changed to: ${newPath}. Context reset.` }]
        }))
      } else {
        updateWorkspace(activeWorkspace.id, (prev: Workspace) => ({
          ...prev,
          messages: [...prev.messages, { id: nextId(), type: 'error', text: `❌ Failed to change directory: ${res.error}` }]
        }))
      }
      setInitializing(false)
    }
  }

  // ── handleRollback ───────────────────────────────────────────────────────────
  const handleRollback = useCallback(async (msgId: number) => {
    if (!activeWorkspace || activeWorkspace.isProcessing) return
    const confirmed = window.confirm('Rollback to this message?\n\nThis will restore all files to the state they were in BEFORE this message was sent, and erase all subsequent conversation history.')
    if (!confirmed) return

    const res = await window.koda.snapshotRestore(activeWorkspace.id, msgId)
    if (!res.success) {
      updateWorkspace(activeWorkspace.id, (prev: Workspace) => ({
        ...prev,
        messages: [...prev.messages, { id: nextId(), type: 'error', text: `Rollback failed: ${res.error}` }]
      }))
      return
    }
    updateWorkspace(activeWorkspace.id, (prev: Workspace) => {
      const idx = prev.messages.findIndex(m => m.id === msgId)
      return {
        ...prev,
        messages: idx === -1 ? prev.messages : prev.messages.slice(0, idx)
      }
    })
  }, [activeWorkspace, updateWorkspace])

  const handleInjectFile = (path: string) => setInput((prev: string) => prev + ` @[${path}] `)
  const handleAddToInput = (path: string) => {
    // Add file as a pill instead of text
    if (!activeId) return
    updateWorkspace(activeId, (prev: Workspace) => ({
      ...prev,
      inputFiles: [...(prev.inputFiles || []), path]
    }))
  }
  const handlePinFile = (path: string) => {
    if (!activeId) return
    updateWorkspace(activeId, (prev: Workspace) => ({
      ...prev,
      pinnedFiles: prev.pinnedFiles.includes(path) ? prev.pinnedFiles : [...prev.pinnedFiles, path]
    }))
  }
  const handleUnpinFile = (path: string) => {
    if (!activeId) return
    updateWorkspace(activeId, (prev: Workspace) => ({
      ...prev,
      pinnedFiles: prev.pinnedFiles.filter(p => p !== path)
    }))
  }

  // ── handleStop ───────────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    if (!activeWorkspace) return
    const raf = rafRefs.current.get(activeWorkspace.id)
    if (raf !== null && raf !== undefined) { 
      cancelAnimationFrame(raf)
      rafRefs.current.set(activeWorkspace.id, null)
    }
    chunkBuffersRef.current.set(activeWorkspace.id, '')
    updateWorkspace(activeWorkspace.id, { isProcessing: false })
    await window.koda.softReset(activeWorkspace.id)
  }, [activeWorkspace, updateWorkspace, chunkBuffersRef, rafRefs])

  // ── handlePaste ─────────────────────────────────────────────────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!activeId) return
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = () => updateWorkspace(activeId, (prev: Workspace) => ({
            ...prev,
            pendingImages: [...prev.pendingImages, { 
                dataUrl: reader.result as string, 
                mimeType: file.type, 
                name: file.name || 'pasted.png',
                isImage: file.type.startsWith('image/')
            }]
          }))
          reader.readAsDataURL(file)
        }
      }
    }
  }, [activeId, updateWorkspace])

  // ── handleInputChange ────────────────────────────────────────────────────────
  const handleInputChange = async (val: string) => {
    setInput(val)
    const cursor = inputRef.current?.selectionStart ?? val.length
    const textBefore = val.slice(0, cursor)

    // Detecta / no início do input (com ou sem texto depois)
    const slashMatch = val.match(/^\/(\S*)/)
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

  const onCloseWorkspace = useCallback((id: string) => {
    if (workspaces.length <= 1) return
    setWorkspaces((prev: Workspace[]) => {
      const remaining = prev.filter(w => w.id !== id)
      if (activeId === id) setActiveId(remaining[0]?.id || null)
      // If closing a split participant, clear split
      if (splitViewIds?.includes(id)) setSplitViewIds(null)
      return remaining
    })
  }, [workspaces.length, activeId, setWorkspaces, setActiveId, splitViewIds])

  // ── onSplitWith: toggle split view for a tab ─────────────────────────────────
  const onSplitWith = useCallback((id: string) => {
    if (!activeId) return
    if (splitViewIds?.includes(id)) {
      // Already in split — close it
      setSplitViewIds(null)
    } else if (id === activeId) {
      // Splitting a workspace with itself is a no-op
    } else {
      setSplitViewIds([id, activeId])
    }
  }, [activeId, splitViewIds])

  const handleSwitchWorkspace = (id: string) => {
    setActiveId(id)
    if (splitViewIds && !splitViewIds.includes(id)) {
      setSplitViewIds(null)
    }
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const showThinkingSpinner = !!(activeWorkspace && activeWorkspace.isProcessing && (
    activeWorkspace.messages.length === 0 ||
    (activeWorkspace.messages[activeWorkspace.messages.length - 1].type !== 'assistant' &&
      (!activeWorkspace.messages[activeWorkspace.messages.length - 1].tool || activeWorkspace.messages[activeWorkspace.messages.length - 1].tool?.status === 'done')) ||
    (activeWorkspace.messages[activeWorkspace.messages.length - 1].type === 'assistant' && activeWorkspace.messages[activeWorkspace.messages.length - 1].done)
  ))

  if (!activeWorkspace) return <div className="h-screen bg-slate-900 flex items-center justify-center"><BrailleSpinner label="Initializing Workspace..." /></div>

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full relative overflow-hidden bg-slate-950">
      {/* Overlays & Modals */}
      {showSettings && (
        <SettingsUI
          onClose={() => setShowSettings(false)}
          defaultProvider={activeWorkspace.agentInfo.providerId || activeWorkspace.agentInfo.provider}
          defaultModel={activeWorkspace.agentInfo.model}
          onSave={async (config: any) => {
            const res = await window.koda.setup(activeWorkspace.id, config)
            if (res.success) updateWorkspace(activeWorkspace.id, { agentInfo: res.info })
            setShowSettings(false)
          }}
          defaultAdvisorModel={activeWorkspace.agentInfo.advisorModel}
          theme={theme}
          setTheme={setTheme}
          kodaSettings={kodaSettings}
          setKodaSettings={setKodaSettings}
          uiMode={kodaSettings.uiMode ?? 'classic'}
        />
      )}

      {showMcpSettings && (
        <MCPSettings
          onClose={() => setShowMcpSettings(false)}
          onSave={async () => setShowMcpSettings(false)}
        />
      )}

      {activeWorkspace.pendingPlan && (
        <PlanApprovalModal
          plan={activeWorkspace.pendingPlan}
          onApprove={() => window.koda.planResponse(true)}
          onReject={() => window.koda.planResponse(false)}
        />
      )}


      {/* Main UI Switch */}
      {kodaSettings.uiMode === 'modern' ? (
        <ModernUI
          messages={activeWorkspace.messages}
          input={input}
          setInput={setInput}
          isProcessing={activeWorkspace.isProcessing}
          agentInfo={activeWorkspace.agentInfo}
          mode={activeWorkspace.mode}
          setMode={(m) => updateWorkspace(activeWorkspace.id, { mode: m })}
          pendingImages={activeWorkspace.pendingImages}
          setPendingImages={(imgs) => updateWorkspace(activeWorkspace.id, (prev: Workspace) => ({ ...prev, pendingImages: typeof imgs === 'function' ? imgs(prev.pendingImages) : imgs }))}
          handleSend={handleSend}
          handleStop={handleStop}
          handlePathClick={handlePathClick}
          handleInputChange={handleInputChange}
          handleRollback={handleRollback}
          handlePaste={handlePaste}
          inputRef={inputRef}
          virtuosoRef={virtuosoRef}
          theme={theme}
          kodaSettings={kodaSettings}
          setKodaSettings={setKodaSettings}
          onSettingsClick={() => setShowSettings(true)}
          onMcpClick={() => setShowMcpSettings(true)}
          onBrowserClick={() => setShowBrowser(p => !p)}
          showBrowser={showBrowser}
          onTerminalClick={() => setShowTerminal(p => !p)}
          showTerminal={showTerminal}
          showPanel={showPanel}
          onTogglePanel={() => setShowPanel(p => !p)}
          showExplorer={showExplorer}
          setShowExplorer={setShowExplorer}
          contextPanelWidth={contextPanelWidth}
          contextPanelTab={contextPanelTab}
          onContextPanelTabChange={(t) => { setContextPanelTab(t); if (!showPanel) setShowPanel(true) }}
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
          isSplitEnabled={isSplitEnabled}
          onToggleSplit={() => setIsSplitEnabled(!isSplitEnabled)}
          workspaces={workspaces}
          activeId={activeId}
          setActiveId={handleSwitchWorkspace}
          onAddWorkspace={() => createNewWorkspace()}
          onCloseWorkspace={onCloseWorkspace}
          splitViewIds={splitViewIds}
          onSplitWith={onSplitWith}
          handleSendForWs={handleSendForWs}
          handleRollbackForWs={handleRollback}
          pendingQuestions={activeWorkspace.pendingQuestions}
          onQuestionsSubmit={(answers) => {
            updateWorkspace(activeWorkspace.id, { pendingQuestions: null })
            window.koda.questionsResponse(answers)
          }}
          pendingShell={activeWorkspace.pendingShell}
          updateInfo={updateInfo}
          onUpdateDismiss={() => setUpdateInfo(null)}
          onNewSession={handleNewSession}
          onLoadSession={handleLoadSession}
          onAddToInput={handleAddToInput}
          onInject={handleInjectFile}
          pinnedFiles={activeWorkspace.pinnedFiles}
          onPin={handlePinFile}
          inputFiles={activeWorkspace.inputFiles || []}
          onRemoveInputFile={(path) => {
            if (!activeId) return
            updateWorkspace(activeId, (prev: Workspace) => ({
              ...prev,
              inputFiles: (prev.inputFiles || []).filter(f => f !== path)
            }))
          }}
        />
      ) : (
        <ClassicUI
          // State
          messages={activeWorkspace.messages}
          input={input}
          setInput={setInput}
          initializing={initializing}
          isProcessing={activeWorkspace.isProcessing}
          agentInfo={activeWorkspace.agentInfo}
          mode={activeWorkspace.mode}
          setMode={(m: Mode) => updateWorkspace(activeWorkspace.id, { mode: m })}
          pendingImages={activeWorkspace.pendingImages}
          setPendingImages={(imgs: any) => updateWorkspace(activeWorkspace.id, (prev: Workspace) => ({ ...prev, pendingImages: typeof imgs === 'function' ? imgs(prev.pendingImages) : imgs }))}
          taskQueue={activeWorkspace.taskQueue}
          setTaskQueue={(queue: any) => updateWorkspace(activeWorkspace.id, (prev: Workspace) => ({ ...prev, taskQueue: typeof queue === 'function' ? queue(prev.taskQueue) : queue }))}
          
          // Callbacks
          handleSend={handleSend}
          handlePathClick={handlePathClick}
          handleInputChange={handleInputChange}
          handleRollback={handleRollback}
          handleStop={handleStop}
          handlePaste={handlePaste}
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
          inPlanMode={activeWorkspace.inPlanMode}
          showThinkingSpinner={showThinkingSpinner}
          symbols={SYMBOLS}
          
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

          // Multi-Workspace
          isSplitEnabled={isSplitEnabled}
          onToggleSplit={() => setIsSplitEnabled(!isSplitEnabled)}
          workspaces={workspaces}
          activeId={activeId}
          setActiveId={handleSwitchWorkspace}
          onAddWorkspace={() => createNewWorkspace()}
          onCloseWorkspace={onCloseWorkspace}
          splitViewIds={splitViewIds}
          onSplitWith={onSplitWith}
          handleSendForWs={handleSendForWs}
          handleRollbackForWs={handleRollback}
          pendingQuestions={activeWorkspace.pendingQuestions}
          onQuestionsSubmit={(answers) => {
            updateWorkspace(activeWorkspace.id, { pendingQuestions: null })
            window.koda.questionsResponse(answers)
          }}
          pendingShell={activeWorkspace.pendingShell}
          updateInfo={updateInfo}
          onUpdateDismiss={() => setUpdateInfo(null)}
        />
      )}

      {/* Universal Context Panel Overlay */}
      {showPanel && (
        <ContextPanelOverlay
          files={activeWorkspace.trackedFiles}
          pinnedFiles={activeWorkspace.pinnedFiles}
          onPin={handlePinFile}
          onUnpin={handleUnpinFile}
          onInject={handleInjectFile}
          onAddToInput={handleAddToInput}
          cwd={activeWorkspace.agentInfo.cwd}
          width={contextPanelWidth}
          isResizing={isResizingContext}
          onStartResize={startResizingContext}
          explorerTabPosition={kodaSettings.explorerTabPosition ?? 'panel'}
          onExplorerTabPositionChange={(pos) => setKodaSettings(prev => ({ ...prev, explorerTabPosition: pos }))}
          showExplorerTab={(kodaSettings.explorerTabPosition ?? 'panel') === 'panel'}
          activeTab={contextPanelTab}
          onTabChange={setContextPanelTab}
        />
      )}

      {/* Standalone Explorer Panel Overlay */}
      {showExplorer && (kodaSettings.explorerTabPosition === 'iconbar' || kodaSettings.explorerTabPosition === 'titlebar') && (
        <ExplorerPanelOverlay
          cwd={activeWorkspace.agentInfo.cwd}
          pinnedFiles={activeWorkspace.pinnedFiles}
          onPin={handlePinFile}
          onInject={handleInjectFile}
          onAddToInput={handleAddToInput}
          onClose={() => setShowExplorer(false)}
          explorerTabPosition={kodaSettings.explorerTabPosition as 'iconbar' | 'titlebar'}
          onMoveTo={(pos) => {
            setKodaSettings(prev => ({ ...prev, explorerTabPosition: pos }))
            if (pos === 'panel') {
              setShowExplorer(false)
              setShowPanel(true)
              setContextPanelTab('explorer')
            }
          }}
        />
      )}
    </div>
  )
}

export default App
