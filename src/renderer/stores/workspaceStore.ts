import { create } from 'zustand'
import type { AgentInfo, AttachedFile, Mode, Workspace } from '../types/index.js'

interface WorkspaceState {
  workspaces: Workspace[]
  activeId: string | null
  isSplitEnabled: boolean
  splitViewIds: [string, string] | null

  setWorkspaces: (value: Workspace[] | ((prev: Workspace[]) => Workspace[])) => void
  setActiveId: (id: string | null) => void
  setIsSplitEnabled: (value: boolean | ((prev: boolean) => boolean)) => void
  setSplitViewIds: (ids: [string, string] | null) => void

  updateWorkspace: (id: string, updates: Partial<Workspace> | ((prev: Workspace) => Workspace)) => void
  createNewWorkspace: (cwd?: string) => Promise<void>
  onCloseWorkspace: (id: string) => void
  onSplitWith: (id: string) => void
  handleSwitchWorkspace: (id: string) => void
  toggleSplit: () => void
}

function newWorkspace(id: string, cwd: string, index: number): Workspace {
  return {
    id,
    name: `Workspace ${index}`,
    cwd: cwd || '...',
    messages: [],
    isProcessing: false,
    agentInfo: {
      providerId: '...',
      provider: '...',
      model: '...',
      advisorModel: '...',
      project: '...',
      cwd: cwd || '...',
    },
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

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  workspaces: [],
  activeId: null,
  isSplitEnabled: false,
  splitViewIds: null,

  setWorkspaces: (value) =>
    set((state) => ({
      workspaces: typeof value === 'function' ? value(state.workspaces) : value,
    })),
  setActiveId: (id) => set({ activeId: id }),
  setIsSplitEnabled: (value) =>
    set((state) => ({
      isSplitEnabled: typeof value === 'function' ? value(state.isSplitEnabled) : value,
    })),
  setSplitViewIds: (ids) => set({ splitViewIds: ids }),

  updateWorkspace: (id, updates) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) => {
        if (w.id !== id) return w
        return typeof updates === 'function' ? updates(w) : { ...w, ...updates }
      }),
    })),

  createNewWorkspace: async (cwd) => {
    const id = await window.koda.generateWorkspaceId()
    const ws = newWorkspace(id, cwd || '...', get().workspaces.length + 1)
    set((state) => ({ workspaces: [...state.workspaces, ws], activeId: id }))
    await window.koda.init(id)
    if (cwd) await window.koda.cd(id, cwd)
    const info = await window.koda.getInfo(id)
    get().updateWorkspace(id, { agentInfo: info, cwd: info.cwd })
  },

  onCloseWorkspace: (id) => {
    if (get().workspaces.length <= 1) return
    set((state) => {
      const remaining = state.workspaces.filter((w) => w.id !== id)
      const activeId = state.activeId === id ? remaining[0]?.id || null : state.activeId
      const splitViewIds = state.splitViewIds?.includes(id) ? null : state.splitViewIds
      return { workspaces: remaining, activeId, splitViewIds }
    })
  },

  onSplitWith: (id) => {
    const { activeId, splitViewIds } = get()
    if (!activeId) return
    if (splitViewIds?.includes(id)) {
      set({ splitViewIds: null })
    } else if (id !== activeId) {
      set({ splitViewIds: [id, activeId] })
    }
  },

  handleSwitchWorkspace: (id) => {
    set((state) => ({
      activeId: id,
      splitViewIds: state.splitViewIds && !state.splitViewIds.includes(id) ? null : state.splitViewIds,
    }))
  },

  toggleSplit: () => set((state) => ({ isSplitEnabled: !state.isSplitEnabled })),
}))

// ─── Seletores derivados ───────────────────────────────────────────────────────

/** Workspace ativo (null quando nenhum). */
export function useActiveWorkspace(): Workspace | null {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeId = useWorkspaceStore((s) => s.activeId)
  return workspaces.find((w) => w.id === activeId) || null
}

export type TaskQueueItem = { text: string; images: AttachedFile[] }

const EMPTY_AGENT_INFO: AgentInfo = {
  provider: '',
  model: '',
  advisorModel: '',
  project: '',
  cwd: '',
}

/**
 * Dados do workspace ativo + ações de escrita, para componentes consumirem
 * diretamente da store (sem prop-drilling via App).
 */
export function useActiveWorkspaceData() {
  const ws = useActiveWorkspace()
  const activeId = useWorkspaceStore((s) => s.activeId)
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace)

  const setMode = (mode: Mode) => {
    if (activeId) updateWorkspace(activeId, { mode })
  }

  const setPendingImages: React.Dispatch<React.SetStateAction<AttachedFile[]>> = (imgs) => {
    if (!activeId) return
    updateWorkspace(activeId, (prev) => ({
      ...prev,
      pendingImages: typeof imgs === 'function' ? imgs(prev.pendingImages) : imgs,
    }))
  }

  const setTaskQueue = (queue: TaskQueueItem[] | ((prev: TaskQueueItem[]) => TaskQueueItem[])) => {
    if (!activeId) return
    updateWorkspace(activeId, (prev) => ({
      ...prev,
      taskQueue: typeof queue === 'function' ? queue(prev.taskQueue) : queue,
    }))
  }

  return {
    messages: ws?.messages ?? [],
    isProcessing: ws?.isProcessing ?? false,
    agentInfo: ws?.agentInfo ?? EMPTY_AGENT_INFO,
    mode: ws?.mode ?? ('fast' as Mode),
    setMode,
    pendingImages: ws?.pendingImages ?? [],
    setPendingImages,
    taskQueue: ws?.taskQueue ?? [],
    setTaskQueue,
    pinnedFiles: ws?.pinnedFiles ?? [],
  }
}
