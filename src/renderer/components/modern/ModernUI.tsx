import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { 
  Paperclip, 
  ArrowUpIcon,
} from "lucide-react"
import { getIconForFile } from 'vscode-icons-js'
import { MessageEntry, AttachedFile, AgentInfo, Mode, KodaTheme, KodaSettings } from '../../types/index.js'

import TitleBar from '../TitleBar.js'
import { BrailleSpinner } from '../BrailleSpinner.js'
import MessageRow from '../messages/MessageRow.js'
import BrowserPreview from '../BrowserPreview.js'
import TerminalPanel from '../TerminalPanel.js'
import WorkspaceTabs from '../WorkspaceTabs.js'
import { ModelDropdown } from './ModelDropdown.js'
import { formatModelName } from '../../utils/formatModelName.js'
import SplitView from '../SplitView.js'
import CompactToolView from '../messages/CompactToolView.js'
import QuestionsModal from '../modals/QuestionsModal.js'
import ShellApprovalPanel from '../modals/ShellApprovalPanel.js'
import UpdateBanner from '../UpdateBanner.js'
import ChatHistory from './ChatHistory.js'
import OnboardingTour from './OnboardingTour.js'
import { PromptBox } from './PromptBox.js'
import { ExplorerTabButton } from '../context/ContextPanel.js'
import IDELayout from '../IDELayout.js'
import StatusBar from '../StatusBar.js'
import SourceControlPanel from '../SourceControlPanel.js'

// ─── Explorer Button with context menu ───────────────────────────────────────
const ExplorerButton: React.FC<{
  showPanel: boolean
  onTogglePanel: () => void
  position: 'iconbar' | 'titlebar'
  onMoveToIconbar: () => void
  onMoveToTitlebar: () => void
}> = ({ showPanel, onTogglePanel, position, onMoveToIconbar, onMoveToTitlebar }) => {
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const icon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h12M3 18h8"/>
    </svg>
  )

  return (
    <>
      {position === 'iconbar' ? (
        <button
          onClick={onTogglePanel}
          onContextMenu={onContextMenu}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${showPanel ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
          title="Toggle Context Panel (right-click to move)"
        >
          {icon}
        </button>
      ) : (
        <button
          onClick={onTogglePanel}
          onContextMenu={onContextMenu}
          className={`w-7 h-7 flex items-center justify-center rounded transition-all no-drag ml-1 ${showPanel ? 'text-cyan-400 bg-cyan-400/10' : 'text-slate-500 hover:text-cyan-400 hover:bg-white/5'}`}
          title="Toggle Context Panel (right-click to move)"
        >
          {icon}
        </button>
      )}

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-9999 bg-[#141414] border border-white/10 rounded-xl shadow-2xl py-1 w-52"
          style={{ top: menu.y, left: menu.x }}
        >
          <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-600">Move to</div>
          <button
            onClick={() => { onMoveToIconbar(); setMenu(null) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${position === 'iconbar' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300 hover:bg-white/5'}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="4" height="18" rx="1"/><path d="M7 12h14"/>
            </svg>
            Iconbar
            {position === 'iconbar' && <span className="ml-auto text-[9px] text-indigo-400">✓</span>}
          </button>
          <button
            onClick={() => { onMoveToTitlebar(); setMenu(null) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${position === 'titlebar' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300 hover:bg-white/5'}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="4" rx="1"/><path d="M12 7v14"/>
            </svg>
            Title Bar
            {position === 'titlebar' && <span className="ml-auto text-[9px] text-indigo-400">✓</span>}
          </button>
        </div>
      )}
    </>
  )
}

interface ModernUIProps {
  messages: MessageEntry[]
  input: string
  setInput: (val: string) => void
  isProcessing: boolean
  agentInfo: AgentInfo
  mode: Mode
  setMode: (m: Mode) => void
  pendingImages: AttachedFile[]
  setPendingImages: React.Dispatch<React.SetStateAction<AttachedFile[]>>
  handleSend: (overrideText?: string, overrideImages?: AttachedFile[]) => void
  handleStop: () => void
  handlePathClick: () => void
  handleInputChange: (val: string) => void
  handleRollback: (id: number) => void
  handlePaste: (e: React.ClipboardEvent) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>

  virtuosoRef: React.RefObject<VirtuosoHandle | null>
  theme: KodaTheme
  kodaSettings: KodaSettings
  setKodaSettings: React.Dispatch<React.SetStateAction<KodaSettings>>
  onSettingsClick: () => void

  onMcpClick: () => void
  onBrowserClick: () => void
  showBrowser: boolean
  onTerminalClick: () => void
  showTerminal: boolean
  showPanel: boolean
  onTogglePanel: () => void
  showExplorer: boolean
  setShowExplorer: (show: boolean) => void
  showSourceControl?: boolean
  onToggleSourceControl?: () => void
  onStartResizeSourceControl?: (e: React.MouseEvent) => void
  explorerWidth?: number
  contextPanelWidth?: number
  contextPanelTab?: 'context' | 'explorer'
  onContextPanelTabChange?: (tab: 'context' | 'explorer') => void
  slashItems: import('../../types/index.js').SlashItem[]
  showSlashMenu: boolean
  slashIndex: number
  selectSlashItem: (item: any) => void
  setSlashIndex: React.Dispatch<React.SetStateAction<number>>
  suggestions: string[]
  showSuggestions: boolean
  suggestionIndex: number
  selectSuggestion: (f: string) => void
  setSuggestionIndex: React.Dispatch<React.SetStateAction<number>>
  leftPanelWidth: number
  rightPanelWidth: number
  startResizing: (e: React.MouseEvent) => void
  isResizing: boolean
  startResizingRight: (e: React.MouseEvent) => void
  isResizingRight: boolean
  browserHeight: number
  isResizingHeight: boolean
  startResizingHeight: (e: React.MouseEvent) => void
  isSplitEnabled?: boolean
  onToggleSplit?: () => void
  workspaces?: import('../../types/index.js').Workspace[]
  activeId?: string | null
  setActiveId?: (id: string) => void
  onAddWorkspace?: () => void
  onCloseWorkspace?: (id: string) => void
  splitViewIds?: [string, string] | null
  onSplitWith?: (id: string) => void
  handleSendForWs?: (text: string, images: AttachedFile[], wsId: string) => void
  onNewSession?: () => void
  onLoadSession?: (sessionId: string, targetProjectPath?: string) => void
  handleRollbackForWs?: (msgId: number, wsId: string) => void
  pendingQuestions?: import('../../types/index.js').Question[] | null
  onQuestionsSubmit?: (answers: import('../../types/index.js').QuestionAnswer[]) => void
  pendingShell?: { command: string; baseCommand: string; description?: string } | null
  onShellDismiss?: () => void
  onAddToInput?: (path: string) => void
  onInject?: (path: string) => void
  pinnedFiles: string[]
  onPin: (path: string) => void
  inputFiles: string[]
  onRemoveInputFile: (path: string) => void
  updateInfo?: { version?: string; downloaded: boolean } | null
  onUpdateDismiss?: () => void
  onSelectActiveModel?: (providerId: string, model: string, advisorModel: string, apiKey: string) => void
  loadedModels?: Record<string, string[]>
  fetchModelsForProvider?: (provId: string, apiKey: string) => Promise<void>
  isIDEWindow?: boolean
  onToggleIDEMode?: () => void
}

// ─── Auto Resize Hook ────────────────────────────────────────────────────────
interface UseAutoResizeTextareaProps {
  minHeight: number
  maxHeight?: number
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current
      if (!textarea) return

      if (reset) {
        textarea.style.height = `${minHeight}px`
        return
      }

      textarea.style.height = `${minHeight}px`
      const newHeight = Math.max(
        minHeight,
        Math.min(
          textarea.scrollHeight,
          maxHeight ?? Number.POSITIVE_INFINITY
        )
      )
      textarea.style.height = `${newHeight}px`
    },
    [minHeight, maxHeight]
  )

  // Use a callback ref to capture when the DOM node is mounted or unmounted
  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node
      if (node) {
        node.style.height = `${minHeight}px`
        // Force an adjustment in the next tick to fit any pre-existing content
        setTimeout(() => {
          if (textareaRef.current) {
            adjustHeight()
          }
        }, 0)
      }
    },
    [minHeight, adjustHeight]
  )

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight()
    }
  }, [minHeight, adjustHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [adjustHeight])

  return { localRef: setRef, textareaRef, adjustHeight }
}

const ModernUI: React.FC<ModernUIProps> = ({
  messages, input, setInput, isProcessing, agentInfo, mode, setMode,
  pendingImages, setPendingImages, handleSend, handleStop, handlePathClick, handleInputChange, handleRollback, handlePaste,

  inputRef: externalInputRef, virtuosoRef, theme, kodaSettings, setKodaSettings, onSettingsClick, onMcpClick, onBrowserClick,

  showBrowser, onTerminalClick, showTerminal, showPanel, onTogglePanel, showExplorer, setShowExplorer, explorerWidth = 256, contextPanelWidth = 256, contextPanelTab, onContextPanelTabChange,
  slashItems, showSlashMenu, slashIndex, selectSlashItem, setSlashIndex,
  suggestions, showSuggestions, suggestionIndex, selectSuggestion, setSuggestionIndex,
  leftPanelWidth, rightPanelWidth, startResizing, isResizing, startResizingRight, isResizingRight, browserHeight, isResizingHeight, startResizingHeight,
  isSplitEnabled = false, onToggleSplit,
  workspaces = [], activeId, setActiveId, onAddWorkspace, onCloseWorkspace,
  splitViewIds, onSplitWith, handleSendForWs, handleRollbackForWs,
  pendingQuestions, onQuestionsSubmit,
  pendingShell, onShellDismiss,
  updateInfo, onUpdateDismiss,
  onNewSession, onLoadSession, onAddToInput, onInject, pinnedFiles, onPin,
  inputFiles, onRemoveInputFile, onSelectActiveModel, loadedModels = {},
  fetchModelsForProvider,
  isIDEWindow = false,
  onToggleIDEMode,
  showSourceControl = false,
  onToggleSourceControl,
  onStartResizeSourceControl,
}) => {
  
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const PROVIDER_NAMES: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google Gemini',
    openrouter: 'OpenRouter',
    deepseek: 'DeepSeek',
    groq: 'Groq',
    ollama: 'Ollama',
    llamacpp: 'Llama.cpp',
    mistral: 'Mistral AI',
    together: 'Together AI',
    xai: 'xAI',
    fireworks: 'Fireworks AI',
    zhipu: 'Zhipu AI',
    maritaca: 'Maritaca AI',
    'koda-cloud': 'Koda Cloud',
  }

  const modelDropdownOptions = useMemo(() => {
    // Free providers that should always show in the dropdown list
    const defaultFreeProviders = [
      { id: 'koda-cloud', name: 'Koda Cloud', model: 'gemini-1.5-flash', advisorModel: 'gemini-1.5-flash', apiKey: '' },
      { id: 'ollama', name: 'Ollama (Local)', model: 'llama3', advisorModel: 'llama3', apiKey: '' },
      { id: 'llamacpp', name: 'Llama.cpp (Local)', model: 'local-model', advisorModel: 'local-model', apiKey: '' },
    ]

    try {
      const saved = localStorage.getItem('koda_providers_config')
      let config: Record<string, { apiKey: string, model: string, advisorModel: string }> = {}
      if (saved) {
        config = JSON.parse(saved)
      }

      // Merge using Map to ensure uniqueness
      const optionsMap = new Map<string, { providerId: string, providerName: string, model: string, advisorModel: string, apiKey: string }>()

      // 1. Add free/local providers
      defaultFreeProviders.forEach(p => {
        const savedData = config[p.id] || {}
        optionsMap.set(p.id, {
          providerId: p.id,
          providerName: PROVIDER_NAMES[p.id] || p.name,
          model: savedData.model || p.model,
          advisorModel: savedData.advisorModel || p.advisorModel,
          apiKey: savedData.apiKey || p.apiKey,
        })
      })

      // 2. Add other providers that have an API key configured
      Object.entries(config).forEach(([provId, data]) => {
        if (!optionsMap.has(provId) && data.apiKey) {
          optionsMap.set(provId, {
            providerId: provId,
            providerName: PROVIDER_NAMES[provId] || provId,
            model: data.model,
            advisorModel: data.advisorModel,
            apiKey: data.apiKey,
          })
        }
      })

      // 3. Ensure currently active provider is present in the list
      const activeProv = agentInfo.providerId || agentInfo.provider || 'openai'
      if (!optionsMap.has(activeProv)) {
        optionsMap.set(activeProv, {
          providerId: activeProv,
          providerName: PROVIDER_NAMES[activeProv] || activeProv,
          model: agentInfo.model,
          advisorModel: agentInfo.advisorModel || '',
          apiKey: '',
        })
      }

      return Array.from(optionsMap.values()).map(opt => ({
        ...opt,
        availableModels: loadedModels[opt.providerId] || [],
      }))
    } catch (e) {
      console.error('Error parsing providers config for dropdown:', e)
    }

    return [{
      providerId: agentInfo.providerId || agentInfo.provider || 'openai',
      providerName: PROVIDER_NAMES[agentInfo.providerId || agentInfo.provider || 'openai'] || 'OpenAI',
      model: agentInfo.model,
      advisorModel: agentInfo.advisorModel || '',
      apiKey: '',
      availableModels: loadedModels[agentInfo.providerId || agentInfo.provider || 'openai'] || [],
    }]
  }, [agentInfo, loadedModels])

  const renderModelDropdown = () => {
    const currentProv = agentInfo.providerId || agentInfo.provider || 'openai'
    const currentModel = agentInfo.model

    return (
      <ModelDropdown
        currentProviderId={currentProv}
        currentModel={currentModel}
        options={modelDropdownOptions}
        onSelect={(providerId, model, advisorModel, apiKey) => {
          if (onSelectActiveModel) onSelectActiveModel(providerId, model, advisorModel, apiKey)
        }}
        onManageProviders={onSettingsClick}
        onFetchModels={fetchModelsForProvider}
      />
    )
  }
  
  const { localRef: textareaRef, textareaRef: rawTextareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: kodaSettings.showEditorPanel ? 40 : 60,  // Smaller when editor/full mode is active, normal in explorer-only or non-IDE mode
    maxHeight: kodaSettings.showEditorPanel ? 200 : 300,  // Also reduce max height when editor/full mode is active
  })

  // Sync refs: we need both the one from App.tsx (for focus/etc) and the local one for resizing
  useEffect(() => {
    if (externalInputRef && rawTextareaRef.current) {
      (externalInputRef as any).current = rawTextareaRef.current
    }
  }, [externalInputRef, rawTextareaRef.current])

  const scheduleScroll = () => {
    // Removed manual scrollToIndex - let Virtuoso's followOutput handle it
  }

  const renderableMessages = useMemo(() => {
    if (kodaSettings.toolViewMode !== 'compact') return messages;
    
    const groups: any[] = [];
    let currentToolGroup: any[] = [];
    
    messages.forEach((msg, idx) => {
      if (msg.type === 'tool') {
        currentToolGroup.push(msg);
      } else {
        if (currentToolGroup.length > 0) {
          groups.push({ type: 'tool_group', tools: [...currentToolGroup], id: `group-${idx}` });
          currentToolGroup = [];
        }
        groups.push(msg);
      }
    });
    
    if (currentToolGroup.length > 0) {
      groups.push({ type: 'tool_group', tools: [...currentToolGroup], id: 'group-last' });
    }
    
    return groups;
  }, [messages, kodaSettings.toolViewMode]);

  const thinkingLabel = React.useMemo(() => {
    if (!isProcessing) return "";
    const lastMsg = messages[messages.length - 1];
    let label = "Composing...";

    if (lastMsg?.type === 'assistant' && !lastMsg.done) {
      const text = (lastMsg.text || "").toLowerCase();
      
      if (text.includes('edit') || text.includes('write') || text.includes('replace')) {
        const fileMatch = text.match(/path\s*[=:]\s*["']([^"']+)["']/) || text.match(/["'](?:targetfile|path)["']\s*:\s*["']([^"']+)["']/i);
        label = fileMatch ? `Editing: ${fileMatch[1].split(/[/\\]/).pop()}...` : "Editing...";
      } else if (text.includes('shell') || text.includes('run') || text.includes('command')) {
        label = "Running...";
      } else if (text.includes('list') || text.includes('read') || text.includes('view') || text.includes('dir')) {
        label = "Analyzing...";
      } else if (text.includes('browser') || text.includes('http') || text.includes('url')) {
        label = "Browsing...";
      } else if (text.includes('<') || text.includes('{')) {
        label = "Processing tool...";
      }
    } else if (lastMsg?.type === 'tool' && (lastMsg.tool?.status === 'running' || lastMsg.tool?.status === 'writing')) {
      const t = lastMsg.tool;
      const tName = (t.name || '').toLowerCase();
      if (tName.includes('edit') || tName.includes('write')) {
        label = `Editing: ${t.args?.path?.split(/[/\\]/).pop() || 'file'}...`;
      } else if (tName.includes('shell') || tName.includes('command')) {
        label = "Running command...";
      } else if (tName.includes('read') || tName.includes('list')) {
        label = "Analyzing...";
      } else {
        return ""; // Let ToolMessage handle it
      }
    }
    return label;
  }, [messages, isProcessing]);

  const VirtuosoFooter = useCallback(() => {
    // Show the animated avatar in the footer only when the agent is working
    // but there are no tool messages at the end (avatar is shown inside CompactToolView in that case)
    const lastMsg = messages[messages.length - 1];
    const lastIsAssistant = lastMsg?.type === 'assistant';
    const lastIsTool = lastMsg?.type === 'tool';
    const showAvatar = isProcessing && !lastIsAssistant && !lastIsTool;

    return (
      <div className="pb-8">
        {showAvatar && (
          <div className="flex items-center gap-2 ml-4 mt-2 animate-in fade-in duration-300">
            <video
              src="/Loading.webm"
              autoPlay
              loop
              muted
              className="w-7 h-7 object-contain"
              style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
            />
            <span className="font-bold text-slate-300 text-sm">Koda</span>
          </div>
        )}
      </div>
    );
  }, [isProcessing, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isProcessing) {
        handleSend()
        adjustHeight(true)
      }
    }
  }

  const onFileAttach = () => {
    const inputChild = document.createElement('input')
    inputChild.type = 'file'
    inputChild.multiple = true
    inputChild.onchange = (e: any) => {
      const files = e.target.files
      if (!files) return
      Array.from(files as FileList).forEach(file => {
        const reader = new FileReader()
        reader.onload = () => {
            const isImage = file.type.startsWith('image/')
            setPendingImages(prev => [...prev, { 
                dataUrl: reader.result as string, 
                mimeType: file.type, 
                name: file.name,
                isImage
            }])
        }
        reader.readAsDataURL(file)
      })
    }
    inputChild.click()
  }

  // Drag & Drop handlers for PromptBox
  const handlePromptBoxDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }

  const handlePromptBoxDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  const handlePromptBoxDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)

    const filePath = e.dataTransfer.getData('text/plain')
    if (filePath && onAddToInput) {
      onAddToInput(filePath)
    }
  }

  // Layout Logic
  const showLeft = (showBrowser && kodaSettings.browserPosition === 'left') || (showTerminal && kodaSettings.terminalPosition === 'left');
  const showRight = (showBrowser && kodaSettings.browserPosition === 'right') || (showTerminal && kodaSettings.terminalPosition === 'right');

  const renderPanelStack = (pos: 'left' | 'right') => {
    const hasBrowser = showBrowser && kodaSettings.browserPosition === pos;
    const hasTerminal = showTerminal && kodaSettings.terminalPosition === pos;
    
    if (!hasBrowser && !hasTerminal) return null;

    return (
      <div 
        style={{ width: pos === 'left' ? `${leftPanelWidth}%` : `${rightPanelWidth}%` }} 
        className={`flex flex-col shrink-0 min-w-50 relative h-full bg-[#141414] ${pos === 'left' ? 'border-r' : 'border-l'} border-white/5`}
      >
        {hasBrowser && (
          <div className="shrink-0 min-h-25 relative" style={{ height: hasTerminal ? `${browserHeight}%` : '100%' }}>
            <BrowserPreview onClose={() => onBrowserClick()} />
            {(isResizingHeight || isResizing || isResizingRight) && (
                <div className={`absolute inset-0 z-100 ${isResizingHeight ? 'cursor-row-resize' : 'cursor-col-resize'}`} />
            )}
          </div>
        )}
        {hasBrowser && hasTerminal && (
          <div
            onMouseDown={startResizingHeight}
            className={`h-1 w-full cursor-row-resize transition-all z-100 shrink-0 flex items-center justify-center group ${isResizingHeight ? 'bg-indigo-500 h-1.5' : 'bg-white/5 hover:bg-indigo-500/50'}`}
          >
          </div>
        )}
        {hasTerminal && (
          <div className="flex-1 min-h-25 relative" style={{ height: hasBrowser ? `${100 - browserHeight}%` : '100%' }}>
            <TerminalPanel onClose={() => onTerminalClick()} cwd={agentInfo.cwd} />
            {(isResizingHeight || isResizing || isResizingRight) && (
                <div className={`absolute inset-0 z-100 ${isResizingHeight ? 'cursor-row-resize' : 'cursor-col-resize'}`} />
            )}
          </div>
        )}
      </div>
    );
  };

  // IDE Mode Logic
  const isIDEMode = kodaSettings.showExplorerPanel || kodaSettings.showEditorPanel

  return (
    <div className="flex flex-col h-screen bg-[#141414] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-white">
      
      <TitleBar 
        mode={mode} 
        onModeChange={setMode} 
        onSettingsClick={onSettingsClick}
        onMcpClick={onMcpClick}
        onBrowserClick={onBrowserClick}
        showBrowser={showBrowser}
        onTerminalClick={onTerminalClick}
        showTerminal={showTerminal}
        showPanel={showPanel}
        onTogglePanel={onTogglePanel}
        uiMode="modern"
        showIconBar={kodaSettings.showIconBar}
        onToggleIconBar={() => setKodaSettings(prev => ({ ...prev, showIconBar: !prev.showIconBar }))}
        isSplitEnabled={isSplitEnabled}
        onToggleSplit={onToggleSplit || (() => {})}
        showExplorer={showExplorer}
        onToggleExplorer={() => setShowExplorer(!showExplorer)}
        isIDEWindow={isIDEWindow}
        onToggleIDEMode={onToggleIDEMode}
        showSourceControl={showSourceControl}
        onToggleSourceControl={onToggleSourceControl}
        extraButton={
          <>
            {kodaSettings.explorerButtonPosition === 'titlebar' && (
              <ExplorerButton
                showPanel={showPanel}
                onTogglePanel={onTogglePanel}
                position="titlebar"
                onMoveToIconbar={() => setKodaSettings(prev => ({ ...prev, explorerButtonPosition: 'iconbar' }))}
                onMoveToTitlebar={() => setKodaSettings(prev => ({ ...prev, explorerButtonPosition: 'titlebar' }))}
              />
            )}
          </>
        }
      />



      <div className="flex flex-1 min-h-0 relative flex-row">
        {/* ── Left Sidebar (Modern Only) ── */}
        {kodaSettings.showIconBar && (
          <div
            id="tour-iconbar"
            className="w-64 bg-[#141414] border-r border-white/5 flex flex-col shrink-0 z-1100 overflow-hidden"
          >
            {/* Sessions — inline, sempre visível */}
            <ChatHistory
              projectPath={agentInfo?.cwd || ''}
              onNewSession={() => onNewSession?.()}
              onLoadSession={(sessionId, targetPath) => onLoadSession?.(sessionId, targetPath)}
              isVisible={true}
            />

            {/* Todos os botões na parte inferior */}
            <div className="border-t border-white/5 py-2 px-2 flex flex-row gap-0.5 justify-center mt-auto">
              <button
                onClick={onSettingsClick}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-zinc-200 hover:bg-white/5 transition-all"
                title="Settings"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button
                onClick={() => onTerminalClick()}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${showTerminal ? 'bg-amber-500/10 text-amber-400' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
                title="Toggle Terminal"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
              </button>
              <button
                onClick={() => onBrowserClick()}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${showBrowser ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
                title="Toggle Browser"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              </button>
              {kodaSettings.explorerButtonPosition !== 'titlebar' && (
                <ExplorerButton
                  showPanel={showPanel}
                  onTogglePanel={onTogglePanel}
                  position={kodaSettings.explorerButtonPosition ?? 'iconbar'}
                  onMoveToIconbar={() => setKodaSettings(prev => ({ ...prev, explorerButtonPosition: 'iconbar' }))}
                  onMoveToTitlebar={() => setKodaSettings(prev => ({ ...prev, explorerButtonPosition: 'titlebar' }))}
                />
              )}
              <button
                onClick={onMcpClick}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-white/5 transition-all"
                title="MCP Systems"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              </button>
            </div>
          </div>
        )}


        <div className="flex-1 flex flex-col min-w-0">
          {/* Workspace tabs — inside the chat column, naturally right of the Iconbar */}
          {isSplitEnabled && setActiveId && onAddWorkspace && onCloseWorkspace && (
            <WorkspaceTabs
              variant="modern"
              workspaces={workspaces}
              activeId={activeId || null}
              onSwitch={setActiveId}
              onAdd={onAddWorkspace}
              onClose={onCloseWorkspace}
              splitIds={splitViewIds}
              onSplitWith={onSplitWith}
            />
          )}
          
          {/* IDE Layout or Normal Layout */}
          {isIDEMode ? (
            <IDELayout
              showExplorerPanel={kodaSettings.showExplorerPanel || false}
              cwd={agentInfo.cwd}
              pinnedFiles={pinnedFiles}
              onPin={onPin}
              onInject={onInject || (() => {})}
              onAddToInput={onAddToInput || (() => {})}
              onSend={handleSendForWs || (() => {})}
              showEditorPanel={kodaSettings.showEditorPanel || false}
              showBrowser={showBrowser}
              showTerminal={showTerminal}
              onBrowserClose={onBrowserClick}
              onTerminalClose={onTerminalClick}
            >
              {/* Chat Panel Content */}
              <div className="flex flex-col h-full">
                {/* IDE Agent Panel Header */}
                <div className="flex items-center justify-end px-3 py-1.5 shrink-0">
                  {showChatHistory ? (
                    <button
                      onClick={() => setShowChatHistory(false)}
                      className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors mr-auto"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                      </svg>
                      <span className="text-[11px] font-medium">Sessions</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowChatHistory(true)}
                      className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all"
                      title="Session history"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Sessions view or Chat view */}
                {showChatHistory ? (
                  <ChatHistory
                    projectPath={agentInfo?.cwd || ''}
                    onNewSession={() => { onNewSession?.(); setShowChatHistory(false) }}
                    onLoadSession={(id, targetPath) => { onLoadSession?.(id, targetPath); setShowChatHistory(false) }}
                    isVisible={true}
                  />
                ) : (
                <div className={`flex-1 flex flex-col ${isIDEMode && kodaSettings.showEditorPanel ? 'max-w-full' : 'max-w-5xl mx-auto'} w-full relative ${messages.length === 0 ? 'justify-center' : 'pt-4'}`}>
                  {/* Message List */}
                  <div className={`min-h-0 ${isIDEMode && kodaSettings.showEditorPanel ? 'px-2' : 'px-4'} ${messages.length === 0 ? 'hidden' : 'flex-1'}`}>
                    <Virtuoso
                      ref={virtuosoRef}
                      data={renderableMessages}
                      alignToBottom
                      increaseViewportBy={{ top: 200, bottom: 200 }}
                      className="custom-scrollbar pr-2"
                      itemContent={(index, item: any) => (
                        <div className="mb-6">
                          {item.type === 'tool_group' ? (
                            <CompactToolView 
                              tools={item.tools} 
                              settings={kodaSettings} 
                              agentInfo={agentInfo} 
                              uiMode="modern" 
                              isLastAndActive={isProcessing && index === renderableMessages.length - 1}
                            />
                          ) : (
                            <MessageRow 
                              msg={item} 
                              agentInfo={agentInfo}
                              kodaSettings={kodaSettings} 
                              uiMode="modern"
                              onRollback={item.type === 'user' ? () => handleRollback && handleRollback(item.id) : undefined}
                            />
                          )}
                        </div>
                      )}
                      components={{
                        Footer: VirtuosoFooter
                      }}
                    />
                  </div>

                  {/* Input Area */}
                  <div className={`${isIDEMode && kodaSettings.showEditorPanel ? 'px-2' : 'px-6'} ${messages.length === 0 ? 'pt-0 pb-6' : 'pt-2 pb-2'}`}>
                    {messages.length === 0 && (
                      <p className="text-center text-slate-600 text-sm font-medium mb-4 tracking-wide">
                        What are we building today?
                      </p>
                    )}
                    {updateInfo && onUpdateDismiss && (
                      <div className="mb-0">
                        <UpdateBanner
                          version={updateInfo.version}
                          downloaded={updateInfo.downloaded}
                          onInstall={() => window.koda.updaterInstall()}
                          onDismiss={onUpdateDismiss}
                          variant="modern"
                        />
                      </div>
                    )}
                    {pendingShell && (
                      <div className="mx-4">
                        <ShellApprovalPanel
                          command={pendingShell.command}
                          baseCommand={pendingShell.baseCommand}
                          variant="modern"
                        />
                      </div>
                    )}
                    {pendingQuestions && pendingQuestions.length > 0 && onQuestionsSubmit && (
                      <div className="mx-4">
                        <QuestionsModal
                          questions={pendingQuestions}
                          onSubmit={onQuestionsSubmit}
                        />
                      </div>
                    )}

                    {/* Slash Menu */}
                    {showSlashMenu && slashItems.length > 0 && (
                      <div className="w-full bg-neutral-900/90 border border-neutral-700/60 backdrop-blur-xl rounded-2xl rounded-b-none border-b-0 overflow-hidden -mb-4 animate-in fade-in slide-in-from-bottom-1 duration-150">
                        <div className="px-2 pt-2 pb-6 max-h-52 overflow-y-auto custom-scrollbar">
                          {slashItems.map((item, idx) => (
                            <button
                              key={item.name}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left group ${idx === slashIndex ? 'bg-white/5' : 'hover:bg-white/5'}`}
                              onClick={() => selectSlashItem(item)}
                            >
                              <span className="text-sm shrink-0">{item.icon}</span>
                              <div className="flex flex-col min-w-0">
                                <span className={`text-[11px] font-bold tracking-wide ${idx === slashIndex ? 'text-white' : 'text-slate-300 group-hover:text-white'} transition-colors`}>
                                  {item.name}
                                </span>
                                {item.description && (
                                  <span className="text-[10px] text-slate-600 group-hover:text-slate-500 transition-colors truncate">
                                    {item.description}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showSuggestions && suggestions.length > 0 && (
                      <div className="w-full bg-neutral-900/90 border border-neutral-700/60 backdrop-blur-xl rounded-2xl rounded-b-none border-b-0 overflow-hidden -mb-4 animate-in fade-in slide-in-from-bottom-1 duration-150">
                        <div className="px-2 pt-2 pb-6 max-h-52 overflow-y-auto custom-scrollbar">
                          {suggestions.map((file, idx) => (
                            <button
                              key={file}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left group ${idx === suggestionIndex ? 'bg-white/5' : 'hover:bg-white/5'}`}
                              onClick={() => selectSuggestion(file)}
                            >
                              <span className="text-sm shrink-0">📄</span>
                              <span className={`text-[11px] font-bold tracking-wide truncate ${idx === suggestionIndex ? 'text-white' : 'text-slate-300 group-hover:text-white'} transition-colors`}>
                                {file}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <PromptBox
                      isDraggingOver={isDraggingOver}
                      onDragOver={handlePromptBoxDragOver}
                      onDragLeave={handlePromptBoxDragLeave}
                      onDrop={handlePromptBoxDrop}
                      pendingImages={pendingImages}
                      setPendingImages={setPendingImages}
                      inputFiles={inputFiles}
                      onRemoveInputFile={onRemoveInputFile}
                      textareaRef={textareaRef}
                      input={input}
                      onChange={(e) => {
                        handleInputChange(e.target.value)
                        adjustHeight()
                      }}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      onFileAttach={onFileAttach}
                      handlePathClick={handlePathClick}
                      agentInfo={agentInfo}
                      isProcessing={isProcessing}
                      handleStop={handleStop}
                      handleSend={handleSend}
                      renderModelDropdown={renderModelDropdown}
                      mode={mode}
                      onModeChange={setMode}
                      variant="ide"
                    />
                  </div>
                </div>
                )}
              </div>
            </IDELayout>
          ) : (
            <div className="flex-1 relative flex flex-row min-h-0">
            {/* ── Left Panel Area ── */}
          {showLeft && renderPanelStack('left')}
          
          {showLeft && (
            <div
              onMouseDown={startResizing}
              className={`w-1 h-full cursor-col-resize transition-all z-100 shrink-0 flex items-center justify-center group ${isResizing ? 'bg-indigo-500 w-1.5' : 'bg-transparent hover:bg-indigo-500/50'}`}
            >
            </div>
          )}

          {/* ── Chat Central Area (Normal or Split) ── */}
          {splitViewIds && handleSendForWs && handleRollbackForWs ? (
            <div className="flex-1 flex flex-col relative min-h-0">
              <SplitView
                workspaces={workspaces}
                splitIds={splitViewIds}
                focusedId={activeId || splitViewIds[1]}
                onFocus={(id: string) => setActiveId && setActiveId(id)}
                onCloseSplit={() => onSplitWith && onSplitWith(splitViewIds[0])}
                onSend={handleSendForWs}
                onRollback={handleRollbackForWs}
                kodaSettings={kodaSettings}
                theme={theme}
                handleStop={handleStop}
                uiMode="modern"
              />
            </div>
          ) : (
            <div className="flex flex-col flex-1 relative min-h-0">
              <div className={`flex-1 flex flex-col max-w-5xl mx-auto w-full relative ${messages.length === 0 ? 'justify-center' : 'pt-4'}`}>
                {/* Message List */}
                <div className={`min-h-0 px-4 ${messages.length === 0 ? 'hidden' : 'flex-1'}`}>
                  <Virtuoso
                    ref={virtuosoRef}
                    data={renderableMessages}
                    alignToBottom
                    increaseViewportBy={{ top: 200, bottom: 200 }}
                    className="custom-scrollbar pr-2"
                    itemContent={(index, item: any) => (
                      <div className="mb-6">
                        {item.type === 'tool_group' ? (
                          <CompactToolView 
                            tools={item.tools} 
                            settings={kodaSettings} 
                            agentInfo={agentInfo} 
                            uiMode="modern" 
                            isLastAndActive={isProcessing && index === renderableMessages.length - 1}
                          />
                        ) : (
                          <MessageRow 
                            msg={item} 
                            agentInfo={agentInfo}
                            kodaSettings={kodaSettings} 
                            uiMode="modern"
                            onRollback={item.type === 'user' ? () => handleRollback && handleRollback(item.id) : undefined}
                          />
                        )}
                      </div>
                    )}
                    components={{
                      Footer: VirtuosoFooter
                    }}
                  />
                </div>

                {/* Input Area */}
                <div className={`px-6 pb-6 ${messages.length === 0 ? 'pt-0' : 'pt-2'}`}>
                  {messages.length === 0 && (
                    <p className="text-center text-slate-600 text-sm font-medium mb-4 tracking-wide">
                      What are we building today?
                    </p>
                  )}
                  {updateInfo && onUpdateDismiss && (
                    <div className="mb-0">
                      <UpdateBanner
                        version={updateInfo.version}
                        downloaded={updateInfo.downloaded}
                        onInstall={() => window.koda.updaterInstall()}
                        onDismiss={onUpdateDismiss}
                        variant="modern"
                      />
                    </div>
                  )}
                  {pendingShell && (
                    <div className="mx-4">
                      <ShellApprovalPanel
                        command={pendingShell.command}
                        baseCommand={pendingShell.baseCommand}
                        variant="modern"
                      />
                    </div>
                  )}
                  {pendingQuestions && pendingQuestions.length > 0 && onQuestionsSubmit && (
                    <div className="mx-4">
                      <QuestionsModal
                        questions={pendingQuestions}
                        onSubmit={onQuestionsSubmit}
                      />
                    </div>
                  )}

                  {/* Slash Menu — estilo UpdateBanner */}
                  {showSlashMenu && slashItems.length > 0 && (
                    <div className="w-full bg-neutral-900/90 border border-neutral-700/60 backdrop-blur-xl rounded-2xl rounded-b-none border-b-0 overflow-hidden -mb-4 animate-in fade-in slide-in-from-bottom-1 duration-150">
                      <div className="px-2 pt-2 pb-6 max-h-52 overflow-y-auto custom-scrollbar">
                        {slashItems.map((item, idx) => (
                          <button
                            key={item.name}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left group ${idx === slashIndex ? 'bg-white/5' : 'hover:bg-white/5'}`}
                            onClick={() => selectSlashItem(item)}
                          >
                            <span className="text-sm shrink-0">{item.icon}</span>
                            <div className="flex flex-col min-w-0">
                              <span className={`text-[11px] font-bold tracking-wide ${idx === slashIndex ? 'text-white' : 'text-slate-300 group-hover:text-white'} transition-colors`}>
                                {item.name}
                              </span>
                              {item.description && (
                                <span className="text-[10px] text-slate-600 group-hover:text-slate-500 transition-colors truncate">
                                  {item.description}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showSuggestions && suggestions.length > 0 && (
                    <div className="w-full bg-neutral-900/90 border border-neutral-700/60 backdrop-blur-xl rounded-2xl rounded-b-none border-b-0 overflow-hidden -mb-4 animate-in fade-in slide-in-from-bottom-1 duration-150">
                      <div className="px-2 pt-2 pb-6 max-h-52 overflow-y-auto custom-scrollbar">
                        {suggestions.map((file, idx) => (
                          <button
                            key={file}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left group ${idx === suggestionIndex ? 'bg-white/5' : 'hover:bg-white/5'}`}
                            onClick={() => selectSuggestion(file)}
                          >
                            <img 
                              src={`https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons/icons/${getIconForFile(file.split(/[/\\]/).pop() || '')}`}
                              width="16" 
                              height="16" 
                              className="shrink-0 object-contain"
                              alt="file icon"
                            />
                            <span className={`text-[11px] font-bold tracking-wide truncate ${idx === suggestionIndex ? 'text-white' : 'text-slate-300 group-hover:text-white'} transition-colors`}>
                              {file}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <PromptBox
                    isDraggingOver={isDraggingOver}
                    onDragOver={handlePromptBoxDragOver}
                    onDragLeave={handlePromptBoxDragLeave}
                    onDrop={handlePromptBoxDrop}
                    pendingImages={pendingImages}
                    setPendingImages={setPendingImages}
                    inputFiles={inputFiles}
                    onRemoveInputFile={onRemoveInputFile}
                    textareaRef={textareaRef}
                    input={input}
                    onChange={(e) => {
                      handleInputChange(e.target.value)
                      adjustHeight()
                    }}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onFileAttach={onFileAttach}
                    handlePathClick={handlePathClick}
                    agentInfo={agentInfo}
                    isProcessing={isProcessing}
                    handleStop={handleStop}
                    handleSend={handleSend}
                    renderModelDropdown={renderModelDropdown}
                    mode={mode}
                    onModeChange={setMode}
                    variant="normal"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Right Panel Area ── */}
          {showRight && (
            <div
              onMouseDown={startResizingRight}
              className={`w-1 h-full cursor-col-resize transition-all z-100 shrink-0 flex items-center justify-center group ${isResizingRight ? 'bg-indigo-500 w-1.5' : 'bg-transparent hover:bg-indigo-500/50'}`}
            >
            </div>
          )}
          {showRight && renderPanelStack('right')}

            {/* Space for ContextPanel overlay */}
            {showPanel && <div className="shrink-0" style={{ width: contextPanelWidth }} />}

            {/* Space for Standalone Explorer overlay */}
            {showExplorer && <div className="shrink-0 border-l border-white/5 bg-[#141414]" style={{ width: explorerWidth }} />}

            {/* Space for Source Control overlay */}
            {showSourceControl && <div className="shrink-0 border-l border-white/5 bg-[#141414]" style={{ width: explorerWidth }} />}
          </div>
          )}
        </div>
      </div>

      {/* StatusBar - only in IDE mode */}
      {isIDEWindow && <StatusBar onSettingsClick={onSettingsClick} onToggleSplit={onToggleSplit} isSplitEnabled={isSplitEnabled} />}

      {/* Source Control overlay */}
      {showSourceControl && (
        <SourceControlPanel
          cwd={agentInfo.cwd}
          width={explorerWidth}
          onStartResize={onStartResizeSourceControl || (() => {})}
          isResizing={isResizingRight}
        />
      )}

      <OnboardingTour show={messages.length === 0} />
    </div>
  )
}

export default ModernUI
