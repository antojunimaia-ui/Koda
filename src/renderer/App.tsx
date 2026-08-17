import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
// @ts-ignore
import 'highlight.js/styles/tokyo-night-dark.css'
import { VirtuosoHandle } from 'react-virtuoso'

// ─── Types ────────────────────────────────────────────────────────────────────
import { KodaSettings, KodaTheme, AttachedFile, Mode, Workspace } from './types/index.js'

// ─── Hooks ───────────────────────────────────────────────────────────────────
import { useResizable } from './hooks/useResizable.js'
import { useDragDrop } from './hooks/useDragDrop.js'
import { useAgentStream } from './hooks/useAgentStream.js'
import { useSession } from './hooks/useSession.js'
import { sessionStorage as kodaSessionStorage } from './hooks/useSessionStorage.js'
import { useWorkspaces } from './hooks/useWorkspaces.js'
import { useTheme } from './hooks/useTheme.js'
import { useAgentInit } from './hooks/useAgentInit.js'
import { useInputHandlers } from './hooks/useInputHandlers.js'
import { useMessageActions } from './hooks/useMessageActions.js'

// ─── Components ──────────────────────────────────────────────────────────────
import MCPSettings from './components/MCPSettings.js'
import PlanApprovalModal from './components/modals/PlanApprovalModal.js'
import ContextPanel, { ContextPanelOverlay, ExplorerPanelOverlay } from './components/context/ContextPanel.js'
import SettingsUI from './components/settings/SettingsUI.js'
import { WelcomeWizardModal } from './components/modals/WelcomeWizardModal.js'
import { BrailleSpinner } from './components/BrailleSpinner.js'
import ClassicUI from './components/classic/ClassicUI.js'
import ModernUI from './components/modern/ModernUI.js'
import { KoDB } from './db/kodb.js'

// ─── Constants ────────────────────────────────────────────────────────────────
const SYMBOLS = {
  brain: '🧠', bullet: '●', circle: '○', dir: '📂', arrow: '❯',
}

const App: React.FC = () => {
  // ── Core workspace state ─────────────────────────────────────────────────
  const {
    workspaces, setWorkspaces, activeId, setActiveId,
    activeWorkspace, updateWorkspace, createNewWorkspace,
    onCloseWorkspace, onSplitWith, handleSwitchWorkspace,
    isSplitEnabled, toggleSplit, splitViewIds,
  } = useWorkspaces()

  // ── Theme ────────────────────────────────────────────────────────────────
  const { theme, setTheme } = useTheme()

  // ── Settings ─────────────────────────────────────────────────────────────
  const [kodaSettings, setKodaSettings] = useState<KodaSettings>(() => {
    try {
      const saved = localStorage.getItem('koda_settings')
      if (saved) return {
        browserPosition: 'left', terminalPosition: 'left',
        explorerButtonPosition: 'iconbar', explorerTabPosition: 'panel',
        showExplorerPanel: false, showEditorPanel: false,
        ...JSON.parse(saved), showIconBar: true,
      }
    } catch { }
    return {
      showTerminal: true, showShellWait: true, showFileRead: true,
      showFileEdit: true, showFileWrite: true, showListDir: true,
      showFileFind: true, showSearch: true, showLspQuery: true,
      showBrowserAgent: true, showPlanMode: true, showColab: true,
      showPty: true, uiMode: 'modern', toolViewMode: 'standard',
      browserPosition: 'left', terminalPosition: 'left', showIconBar: true,
      explorerButtonPosition: 'iconbar', explorerTabPosition: 'panel',
      showExplorerPanel: false, showEditorPanel: false,
    }
  })

  useEffect(() => {
    localStorage.setItem('koda_settings', JSON.stringify(kodaSettings))
  }, [kodaSettings])

  // ── IDE window detection ──────────────────────────────────────────────────
  const isIDEWindow = useMemo(
    () => new URLSearchParams(window.location.search).get('window') === 'ide',
    []
  )
  const activeSettings = useMemo(
    () => ({ ...kodaSettings, showExplorerPanel: isIDEWindow, showEditorPanel: isIDEWindow }),
    [kodaSettings, isIDEWindow]
  )
  const handleToggleIDEMode = useCallback(() => {
    isIDEWindow ? window.koda?.openAgent?.() : window.koda?.openIDE?.()
  }, [isIDEWindow])

  // ── UI visibility ─────────────────────────────────────────────────────────
  const [showSettings, setShowSettings]         = useState(false)
  const [showMcpSettings, setShowMcpSettings]   = useState(false)
  const [showBrowser, setShowBrowser]           = useState(false)
  const [showTerminal, setShowTerminal]         = useState(false)
  const [showPanel, setShowPanel]               = useState(false)
  const [showExplorer, setShowExplorer]         = useState(false)
  const [showSourceControl, setShowSourceControl] = useState(false)
  const [contextPanelTab, setContextPanelTab]   = useState<'context' | 'explorer'>('context')
  const [showWelcomeWizard, setShowWelcomeWizard] = useState(
    () => !localStorage.getItem('koda_welcome_wizard_done')
  )

  // ── Refs ──────────────────────────────────────────────────────────────────
  const virtuosoRef  = useRef<VirtuosoHandle | null>(null)
  const inputRef     = useRef<HTMLTextAreaElement | null>(null)
  const sessionIdRef = useRef<Map<string, string>>(new Map())
  const lastLoadedCwdPerWs = useRef<Map<string, string>>(new Map())

  // ── Input state ───────────────────────────────────────────────────────────
  const [input, setInput] = useState('')

  // ── Resizable panels ──────────────────────────────────────────────────────
  const {
    leftPanelWidth, rightPanelWidth, browserHeight,
    contextPanelWidth, explorerWidth,
    isResizing, isResizingRight, isResizingHeight,
    isResizingContext, isResizingExplorer,
    startResizing, startResizingRight, startResizingHeight,
    startResizingContext, startResizingExplorer,
  } = useResizable()

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useDragDrop({
    setInput,
    setPendingImages: (imgs: AttachedFile[] | ((p: AttachedFile[]) => AttachedFile[])) => {
      if (!activeId) return
      updateWorkspace(activeId, (prev: Workspace) => ({
        ...prev,
        pendingImages: typeof imgs === 'function' ? imgs(prev.pendingImages) : imgs,
      }))
    },
  })

  // ── Agent init + models + updater ─────────────────────────────────────────
  const {
    initializing, setInitializing,
    availableSkills, updateInfo, setUpdateInfo,
    loadedModels, loadingState, fetchModelsForProvider,
  } = useAgentInit({ workspaces, setWorkspaces, setActiveId, updateWorkspace, lastLoadedCwdPerWs })

  // ── Scroll helper (Virtuoso alignToBottom handles it; kept as no-op) ──────
  const scheduleScroll = useCallback((_wsId: string) => {}, [])

  // ── Agent stream ──────────────────────────────────────────────────────────
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

  // ── Input handlers ────────────────────────────────────────────────────────
  const {
    allFiles, setAllFiles,
    suggestions, showSuggestions, suggestionIndex, setSuggestionIndex,
    slashItems, showSlashMenu, slashIndex, setSlashIndex,
    handleInputChange, selectSuggestion, selectSlashItem, pushHistory,
    setShowSuggestions, setShowSlashMenu,
  } = useInputHandlers({ input, setInput, inputRef, availableSkills })

  // ── Message actions ───────────────────────────────────────────────────────
  const { handleSend, handleSendForWs, handlePathClick, handleRollback, handleStop, handlePaste } =
    useMessageActions({
      activeId, workspaces, input, setInput, updateWorkspace,
      setInitializing, setAllFiles, setShowSlashMenu, setShowSuggestions, pushHistory,
      chunkBuffersRef, rafRefs, taskStartsRef, scheduleScroll,
    })

  // ── Session: load when CWD changes ───────────────────────────────────────
  const { loadSession } = useSession({
    setMessages: (msgs, wsId) => {
      const id = wsId || activeId
      if (!id) return
      updateWorkspace(id, (prev: Workspace) => ({
        ...prev, messages: typeof msgs === 'function' ? msgs(prev.messages) : msgs,
      }))
    },
    setPinnedFiles: (files, wsId) => {
      const id = wsId || activeId
      if (!id) return
      updateWorkspace(id, (prev: Workspace) => ({
        ...prev, pinnedFiles: typeof files === 'function' ? files(prev.pinnedFiles) : files,
      }))
    },
  })

  useEffect(() => {
    if (!activeWorkspace) return
    const cwd = activeWorkspace.agentInfo.cwd
    if (!cwd || cwd === '...') return
    if (cwd === lastLoadedCwdPerWs.current.get(activeWorkspace.id)) return
    lastLoadedCwdPerWs.current.set(activeWorkspace.id, cwd)
    const sessionId = loadSession(cwd, activeWorkspace.id)
    if (sessionId) {
      sessionIdRef.current.set(activeWorkspace.id, sessionId)
      updateWorkspace(activeWorkspace.id, { currentSessionId: sessionId })
    }
  }, [activeWorkspace?.id, activeWorkspace?.agentInfo.cwd, initializing])

  // ── Auto-save (debounced 1s) ──────────────────────────────────────────────
  useEffect(() => {
    if (initializing || !activeWorkspace?.agentInfo.cwd || activeWorkspace.agentInfo.cwd === '...') return
    if (activeWorkspace.messages.length === 0) return
    const { id: wsId, agentInfo: { cwd }, messages, pinnedFiles, currentSessionId } = activeWorkspace
    const timer = setTimeout(() => {
      let sessionId = sessionIdRef.current.get(wsId)
      if (!sessionId) {
        sessionId = currentSessionId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        sessionIdRef.current.set(wsId, sessionId)
        if (!currentSessionId) updateWorkspace(wsId, { currentSessionId: sessionId })
      }
      kodaSessionStorage.save(cwd, { id: sessionId, messages, pinnedFiles, timestamp: Date.now() })
    }, 1000)
    return () => clearTimeout(timer)
  }, [activeWorkspace?.messages, activeWorkspace?.pinnedFiles, activeWorkspace?.agentInfo.cwd, initializing])

  // ── Auto-dequeue ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeWorkspace && !activeWorkspace.isProcessing && activeWorkspace.taskQueue.length > 0) {
      const [next, ...rest] = activeWorkspace.taskQueue
      updateWorkspace(activeWorkspace.id, { taskQueue: rest })
      setTimeout(() => handleSend(next.text, next.images), 200)
    }
  }, [activeWorkspace?.isProcessing])

  // ── Global koda-open:// link handler ─────────────────────────────────────
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a')
      if (!link?.href.startsWith('koda-open://')) return
      e.preventDefault()
      const decoded = decodeURIComponent(link.href.replace('koda-open://', ''))
      const lastColon = decoded.lastIndexOf(':')
      if (lastColon !== -1 && !isNaN(parseInt(decoded.substring(lastColon + 1)))) {
        if (activeWorkspace) window.koda.openFile(activeWorkspace.id, decoded.substring(0, lastColon), parseInt(decoded.substring(lastColon + 1), 10))
      } else {
        if (activeWorkspace) window.koda.openFile(activeWorkspace.id, decoded)
      }
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [activeWorkspace])

  // ── Focus when idle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeWorkspace?.isProcessing && !initializing) inputRef.current?.focus()
  }, [activeWorkspace?.isProcessing, initializing])

  // ── Session management ────────────────────────────────────────────────────
  const handleNewSession = useCallback(() => {
    if (!activeId) return
    sessionIdRef.current.delete(activeId)
    updateWorkspace(activeId, { messages: [], pinnedFiles: [], inputFiles: [], currentSessionId: null })
    window.koda.softReset(activeId)
  }, [activeId, updateWorkspace])

  const handleLoadSession = useCallback(async (sessionId: string, targetProjectPath?: string) => {
    if (!activeId || !activeWorkspace) return
    const pPath = targetProjectPath || activeWorkspace.agentInfo.cwd
    const session = kodaSessionStorage.get(pPath, sessionId)
    if (session) {
      sessionIdRef.current.set(activeId, sessionId)
      
      if (targetProjectPath && targetProjectPath !== activeWorkspace.agentInfo.cwd) {
        const cdRes = await window.koda.cd(activeId, targetProjectPath)
        const updatedInfo = cdRes?.info || { ...activeWorkspace.agentInfo, cwd: targetProjectPath }
        updateWorkspace(activeId, {
          agentInfo: updatedInfo,
          messages: session.messages || [],
          pinnedFiles: session.pinnedFiles || [],
          inputFiles: [],
          currentSessionId: sessionId
        })
      } else {
        await window.koda.softReset(activeId)
        updateWorkspace(activeId, {
          messages: session.messages || [],
          pinnedFiles: session.pinnedFiles || [],
          inputFiles: [],
          currentSessionId: sessionId
        })
      }
    }
  }, [activeId, activeWorkspace, updateWorkspace])


  // ── File context helpers ──────────────────────────────────────────────────
  const handleInjectFile  = (path: string) => setInput(prev => prev + ` @[${path}] `)
  const handleAddToInput  = (path: string) => {
    if (!activeId) return
    updateWorkspace(activeId, prev => ({ ...prev, inputFiles: [...(prev.inputFiles || []), path] }))
  }
  const handlePinFile     = (path: string) => {
    if (!activeId) return
    updateWorkspace(activeId, prev => ({ ...prev, pinnedFiles: prev.pinnedFiles.includes(path) ? prev.pinnedFiles : [...prev.pinnedFiles, path] }))
  }
  const handleUnpinFile   = (path: string) => {
    if (!activeId) return
    updateWorkspace(activeId, prev => ({ ...prev, pinnedFiles: prev.pinnedFiles.filter(p => p !== path) }))
  }
  const handleRemoveInputFile = (path: string) => {
    if (!activeId) return
    updateWorkspace(activeId, prev => ({ ...prev, inputFiles: (prev.inputFiles || []).filter(f => f !== path) }))
  }

  // ── selectActiveModel (ModernUI inline model switcher) ────────────────────
  const handleSelectActiveModel = useCallback(async (providerId: string, model: string, advisorModel: string, apiKey: string) => {
    if (!activeWorkspace) return
    const res = await window.koda.setup(activeWorkspace.id, { provider: providerId, model, advisorModel, apiKey })
    if (res.success) {
      updateWorkspace(activeWorkspace.id, { agentInfo: res.info })
      KoDB.set('provider', providerId); KoDB.set('model', model); KoDB.set('apiKey', apiKey)
      if (advisorModel) KoDB.set('advisorModel', advisorModel)
      try {
        const config = KoDB.get('providersConfig')
        if (config[providerId]) {
          config[providerId].model = model
          if (advisorModel) config[providerId].advisorModel = advisorModel
          KoDB.set('providersConfig', config)
        }
      } catch (e) { console.error('Error syncing provider model selection:', e) }
    }
  }, [activeWorkspace, updateWorkspace])

  // ── Derived UI state ──────────────────────────────────────────────────────
  const showThinkingSpinner = !!(activeWorkspace?.isProcessing && (
    activeWorkspace.messages.length === 0 ||
    (activeWorkspace.messages[activeWorkspace.messages.length - 1].type !== 'assistant' &&
      (!activeWorkspace.messages[activeWorkspace.messages.length - 1].tool ||
        activeWorkspace.messages[activeWorkspace.messages.length - 1].tool?.status === 'done')) ||
    (activeWorkspace.messages[activeWorkspace.messages.length - 1].type === 'assistant' &&
      activeWorkspace.messages[activeWorkspace.messages.length - 1].done)
  ))

  if (!activeWorkspace) {
    return <div className="h-screen bg-slate-900 flex items-center justify-center"><BrailleSpinner label="Initializing Workspace..." /></div>
  }

  // ── Common props shared by both UIs ───────────────────────────────────────
  const sharedUIProps = {
    input, setInput,
    isProcessing: activeWorkspace.isProcessing,
    agentInfo: activeWorkspace.agentInfo,
    mode: activeWorkspace.mode,
    setMode: (m: Mode) => updateWorkspace(activeWorkspace.id, { mode: m }),
    pendingImages: activeWorkspace.pendingImages,
    setPendingImages: (imgs: any) => updateWorkspace(activeWorkspace.id, (prev: Workspace) => ({ ...prev, pendingImages: typeof imgs === 'function' ? imgs(prev.pendingImages) : imgs })),
    handleSend, handleStop, handlePathClick, handleInputChange,
    handleRollback, handlePaste, inputRef, virtuosoRef,
    theme, kodaSettings,
    onSettingsClick: () => setShowSettings(true),
    onMcpClick: () => setShowMcpSettings(true),
    onBrowserClick: () => setShowBrowser(p => !p),
    showBrowser,
    onTerminalClick: () => setShowTerminal(p => !p),
    showTerminal, showPanel,
    onTogglePanel: () => setShowPanel(p => !p),
    showExplorer, setShowExplorer,
    explorerWidth, leftPanelWidth, rightPanelWidth,
    startResizing, isResizing, startResizingRight, isResizingRight,
    browserHeight, isResizingHeight, startResizingHeight,
    slashItems, showSlashMenu, slashIndex, selectSlashItem, setSlashIndex,
    suggestions, showSuggestions, suggestionIndex, selectSuggestion, setSuggestionIndex,
    isSplitEnabled, onToggleSplit: toggleSplit,
    workspaces, activeId, setActiveId: handleSwitchWorkspace,
    onAddWorkspace: () => createNewWorkspace(),
    onCloseWorkspace, splitViewIds, onSplitWith,
    handleSendForWs, handleRollbackForWs: handleRollback,
    pendingQuestions: activeWorkspace.pendingQuestions,
    onQuestionsSubmit: (answers: any) => {
      updateWorkspace(activeWorkspace.id, { pendingQuestions: null })
      window.koda.questionsResponse(answers)
    },
    pendingShell: activeWorkspace.pendingShell,
    updateInfo, onUpdateDismiss: () => setUpdateInfo(null),
  }

  // Props exclusivas do ClassicUI (ModernUI gerencia internamente)
  const classicOnlyProps = {
    isDragging, handleDragOver, handleDragLeave, handleDrop,
    inPlanMode: activeWorkspace.inPlanMode,
    showThinkingSpinner,
    symbols: SYMBOLS,
  }

  return (
    <div className="h-screen w-full relative overflow-hidden bg-slate-950">

      {/* ── Modals & Overlays ─────────────────────────────────────────────── */}
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
          theme={theme} setTheme={setTheme}
          kodaSettings={kodaSettings} setKodaSettings={setKodaSettings}
          uiMode={kodaSettings.uiMode ?? 'classic'}
          loadedModels={loadedModels} loadingState={loadingState}
          fetchModelsForProvider={fetchModelsForProvider}
        />
      )}

      {showMcpSettings && (
        <MCPSettings onClose={() => setShowMcpSettings(false)} onSave={async () => setShowMcpSettings(false)} />
      )}

      {activeWorkspace.pendingPlan && (
        <PlanApprovalModal
          plan={activeWorkspace.pendingPlan}
          onApprove={() => window.koda.planResponse(true)}
          onReject={() => window.koda.planResponse(false)}
        />
      )}

      {showWelcomeWizard && (
        <WelcomeWizardModal
          currentTheme={theme} setTheme={setTheme}
          loadedModels={loadedModels} fetchModelsForProvider={fetchModelsForProvider}
          onComplete={async (config) => {
            setTheme(config.theme)
            KoDB.set('theme', config.theme)
            const kodaCloudBaseUrl = (config as any).kodaCloudBaseUrl || ''
            if (kodaCloudBaseUrl) {
              KoDB.set('kodaCloudBaseUrl', kodaCloudBaseUrl)
              KoDB.set('kodaCloudAccepted', true)
            }
            const res = await window.koda.setup(activeWorkspace.id, {
              provider: config.provider, model: config.model,
              advisorModel: config.advisorModel, apiKey: config.apiKey,
              kodaCloudBaseUrl: kodaCloudBaseUrl || undefined,
            })
            if (res.success) updateWorkspace(activeWorkspace.id, { agentInfo: res.info })
            KoDB.set('provider', config.provider)
            KoDB.set('model', config.model)
            KoDB.set('apiKey', config.apiKey)
            if (config.advisorModel) KoDB.set('advisorModel', config.advisorModel)
            try {
              const pc = KoDB.get('providersConfig') || {}
              pc[config.provider] = { apiKey: config.apiKey, model: config.model, advisorModel: config.advisorModel || config.model }
              KoDB.set('providersConfig', pc)
            } catch { }
            localStorage.setItem('koda_welcome_wizard_done', 'true')
            setShowWelcomeWizard(false)
          }}
        />
      )}

      {/* ── Main UI ───────────────────────────────────────────────────────── */}
      {kodaSettings.uiMode === 'modern' ? (
        <ModernUI
          {...sharedUIProps}
          messages={activeWorkspace.messages}
          kodaSettings={activeSettings}
          setKodaSettings={setKodaSettings}
          isIDEWindow={isIDEWindow}
          onToggleIDEMode={handleToggleIDEMode}
          showSourceControl={showSourceControl}
          onToggleSourceControl={() => setShowSourceControl(p => !p)}
          onStartResizeSourceControl={startResizingExplorer}
          contextPanelWidth={contextPanelWidth}
          contextPanelTab={contextPanelTab}
          onContextPanelTabChange={(t) => { setContextPanelTab(t); if (!showPanel) setShowPanel(true) }}
          loadedModels={loadedModels}
          fetchModelsForProvider={fetchModelsForProvider}
          onSelectActiveModel={handleSelectActiveModel}
          onNewSession={handleNewSession}
          onLoadSession={handleLoadSession}
          onAddToInput={handleAddToInput}
          onInject={handleInjectFile}
          pinnedFiles={activeWorkspace.pinnedFiles}
          onPin={handlePinFile}
          inputFiles={activeWorkspace.inputFiles || []}
          onRemoveInputFile={handleRemoveInputFile}
        />
      ) : (
        <ClassicUI
          {...sharedUIProps}
          {...classicOnlyProps}
          messages={activeWorkspace.messages}
          initializing={initializing}
          taskQueue={activeWorkspace.taskQueue}
          setTaskQueue={(queue: any) => updateWorkspace(activeWorkspace.id, (prev: Workspace) => ({ ...prev, taskQueue: typeof queue === 'function' ? queue(prev.taskQueue) : queue }))}
        />
      )}

      {/* ── Context Panel overlay ─────────────────────────────────────────── */}
      {showPanel && (
        <ContextPanelOverlay
          files={activeWorkspace.trackedFiles}
          pinnedFiles={activeWorkspace.pinnedFiles}
          onPin={handlePinFile} onUnpin={handleUnpinFile}
          onInject={handleInjectFile} onAddToInput={handleAddToInput}
          cwd={activeWorkspace.agentInfo.cwd}
          width={contextPanelWidth} isResizing={isResizingContext}
          onStartResize={startResizingContext}
          activeTab={contextPanelTab} onTabChange={setContextPanelTab}
        />
      )}

      {/* ── Explorer Panel overlay ────────────────────────────────────────── */}
      {showExplorer && (
        <ExplorerPanelOverlay
          cwd={activeWorkspace.agentInfo.cwd}
          pinnedFiles={activeWorkspace.pinnedFiles}
          onPin={handlePinFile} onInject={handleInjectFile}
          onAddToInput={handleAddToInput}
          onClose={() => setShowExplorer(false)}
          explorerTabPosition="titlebar" onMoveTo={() => {}}
          width={explorerWidth} onStartResize={startResizingExplorer}
          zIndex={100}
        />
      )}
    </div>
  )
}

export default App
