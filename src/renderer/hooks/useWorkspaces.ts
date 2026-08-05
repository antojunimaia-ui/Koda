import { useState, useCallback, useRef } from 'react'
import { Workspace, AttachedFile, Mode } from '../types/index.js'

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isSplitEnabled, setIsSplitEnabled] = useState(false)
  const [splitViewIds, setSplitViewIds] = useState<[string, string] | null>(null)

  const activeWorkspace = workspaces.find(w => w.id === activeId) || null

  const updateWorkspace = useCallback(
    (id: string, updates: Partial<Workspace> | ((prev: Workspace) => Workspace)) => {
      setWorkspaces(prev =>
        prev.map(w => {
          if (w.id !== id) return w
          if (typeof updates === 'function') return updates(w)
          return { ...w, ...updates }
        })
      )
    },
    []
  )

  const createNewWorkspace = useCallback(
    async (cwd?: string) => {
      const id = Math.random().toString(36).substring(7)
      const newWorkspace: Workspace = {
        id,
        name: `Workspace ${workspaces.length + 1}`,
        cwd: cwd || '...',
        messages: [],
        isProcessing: false,
        agentInfo: {
          providerId: '...', provider: '...', model: '...', advisorModel: '...', project: '...', cwd: cwd || '...',
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
      setWorkspaces(prev => [...prev, newWorkspace])
      setActiveId(id)
      await window.koda.init(id)
      if (cwd) await window.koda.cd(id, cwd)
      const info = await window.koda.getInfo(id)
      updateWorkspace(id, { agentInfo: info, cwd: info.cwd })
    },
    [workspaces.length, updateWorkspace]
  )

  const onCloseWorkspace = useCallback(
    (id: string) => {
      if (workspaces.length <= 1) return
      setWorkspaces(prev => {
        const remaining = prev.filter(w => w.id !== id)
        if (activeId === id) setActiveId(remaining[0]?.id || null)
        if (splitViewIds?.includes(id)) setSplitViewIds(null)
        return remaining
      })
    },
    [workspaces.length, activeId, splitViewIds]
  )

  const onSplitWith = useCallback(
    (id: string) => {
      if (!activeId) return
      if (splitViewIds?.includes(id)) {
        setSplitViewIds(null)
      } else if (id !== activeId) {
        setSplitViewIds([id, activeId])
      }
    },
    [activeId, splitViewIds]
  )

  const handleSwitchWorkspace = useCallback(
    (id: string) => {
      setActiveId(id)
      if (splitViewIds && !splitViewIds.includes(id)) setSplitViewIds(null)
    },
    [splitViewIds]
  )

  const toggleSplit = useCallback(() => setIsSplitEnabled(p => !p), [])

  return {
    workspaces,
    setWorkspaces,
    activeId,
    setActiveId,
    activeWorkspace,
    updateWorkspace,
    createNewWorkspace,
    onCloseWorkspace,
    onSplitWith,
    handleSwitchWorkspace,
    isSplitEnabled,
    setIsSplitEnabled,
    toggleSplit,
    splitViewIds,
    setSplitViewIds,
  }
}
