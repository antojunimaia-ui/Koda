import React, { useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore.js'
import { useAgentStream } from '../../hooks/useAgentStream.js'
import { useMessageActions } from '../../hooks/useMessageActions.js'
import { KoDB } from '../../db/kodb.js'
import { SplitPanel } from '../SplitView.js'
import type { KodaSettings, KodaTheme, Workspace } from '../../types/index.js'
import tokyoNight from '../../themes/tokyo-night.json'

// ─── Modo painel (Fase 1) ───────────────────────────────────────────────────────
// Carregado como documento autônomo com `?mode=panel&ws=<id>` — o que será a URL
// de cada WebContentsView na Fase 2. Roda num renderer próprio, então o store,
// os hooks de stream e de mensagem são instâncias independentes do host; o
// workspace é o único daqui, identificado pelo id (fonte da verdade: main).

const DEFAULT_SETTINGS: Partial<KodaSettings> = {
  toolViewMode: 'compact',
  uiMode: 'modern',
}

function stubWorkspace(id: string): Workspace {
  return {
    id,
    name: 'Workspace',
    cwd: '...',
    messages: [],
    isProcessing: false,
    agentInfo: { provider: '', model: '', advisorModel: '', project: '', cwd: '...' },
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
    currentSessionId: null,
  }
}

const PanelCore: React.FC<{ workspaceId: string | null }> = ({ workspaceId }) => {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace)

  const [settings] = useState<KodaSettings>(() => {
    let loaded: Partial<KodaSettings> = {}
    try {
      loaded = JSON.parse(localStorage.getItem('koda_settings') || '{}')
    } catch {
      /* defaults */
    }
    return { ...DEFAULT_SETTINGS, ...loaded } as KodaSettings
  })
  const [theme] = useState<KodaTheme>(() => KoDB.get('theme') ?? (tokyoNight as unknown as KodaTheme))

  // Registra o workspace na store (se necessário) e inicializa o agente.
  useEffect(() => {
    const id = workspaceId
    if (!id) return
    const st = useWorkspaceStore.getState()
    if (!st.workspaces.some((w) => w.id === id)) {
      st.setWorkspaces([stubWorkspace(id)])
    }
    st.setActiveId(id)
    ;(async () => {
      try {
        const res: any = await window.koda.init(id)
        if (res?.success) {
          const info = res.info
          st.updateWorkspace(id, { agentInfo: info, cwd: info.cwd, name: info.project || 'Workspace' })
        }
      } catch {
        /* mantém o stub */
      }
    })()
  }, [workspaceId])

  const activeId = workspaceId
  const [input, setInput] = useState('')
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [, setInitializing] = useState(false)
  const chunkBuffersRef = useRef<Map<string, string>>(new Map())
  const rafRefs = useRef<Map<string, number | null>>(new Map())
  const taskStartsRef = useRef<Map<string, number | null>>(new Map())

  useAgentStream({
    onUpdate: (wid, upd) => updateWorkspace(wid, (prev) => ({ ...prev, messages: upd(prev.messages) })),
    onAgentInfo: (wid, info) => updateWorkspace(wid, { agentInfo: info, cwd: info.cwd }),
    onProcessing: (wid, processing) => updateWorkspace(wid, { isProcessing: processing }),
    onTrackedFiles: (wid, files) => updateWorkspace(wid, { trackedFiles: files }),
    onPendingPlan: (wid, plan) => updateWorkspace(wid, { pendingPlan: plan }),
    onPendingQuestions: (wid, questions) => updateWorkspace(wid, { pendingQuestions: questions }),
    onPendingShell: (wid, shell) => updateWorkspace(wid, { pendingShell: shell }),
    onPlanMode: (wid, inPlanMode) => updateWorkspace(wid, { inPlanMode }),
    scheduleScroll: () => {},
    activeWorkspaceId: activeId,
  })

  const { handleSendForWs, handlePathClick, handleRollback, handleStop } = useMessageActions({
    activeId,
    workspaces,
    input,
    setInput,
    updateWorkspace,
    setInitializing,
    setAllFiles,
    setShowSlashMenu,
    setShowSuggestions,
    pushHistory: () => {},
    chunkBuffersRef,
    rafRefs,
    taskStartsRef,
    scheduleScroll: () => {},
  })

  const ws = workspaces.find((w) => w.id === activeId)

  if (!ws) {
    return (
      <div className="mui-app items-center justify-center" data-ui-mode="modern">
        <span className="mui-muted text-sm">Carregando workspace…</span>
      </div>
    )
  }

  return (
    <div className="mui-app" data-ui-mode="modern">
      <div className="flex flex-1 min-h-0">
        <SplitPanel
          workspace={ws}
          kodaSettings={settings}
          theme={theme}
          isFocused
          onFocus={() => {}}
          onSend={(text, images, wsId) => handleSendForWs(text, images, wsId)}
          onRollback={(msgId) => handleRollback(msgId)}
          onClose={() => {}}
          handleStop={handleStop}
          uiMode="modern"
        />
      </div>
    </div>
  )
}

const PanelApp: React.FC<{ workspaceId: string | null }> = ({ workspaceId }) => {
  // Em um browser puro (sem preload do Electron) não há window.koda — mostra um
  // fallback em vez de deixar os hooks de stream quebrarem.
  if (typeof window.koda === 'undefined') {
    return (
      <div className="mui-app items-center justify-center" data-ui-mode="modern">
        <span className="mui-muted text-sm">Modo painel requer o runtime do Koda (Electron).</span>
      </div>
    )
  }
  return <PanelCore workspaceId={workspaceId} />
}

export default PanelApp
