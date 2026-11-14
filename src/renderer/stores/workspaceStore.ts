import { create } from 'zustand'
import type { Workspace } from '../types/index.js'

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
    const id = Math.random().toString(36).substring(7)
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
