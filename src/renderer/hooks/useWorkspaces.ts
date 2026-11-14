import { useWorkspaceStore } from '../stores/workspaceStore.js'

/**
 * Fachada fina sobre a Zustand store de workspaces.
 * Mantém a mesma API do hook original para não quebrar consumidores;
 * novos consumidores podem usar `useWorkspaceStore` diretamente.
 */
export function useWorkspaces() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces)
  const activeId = useWorkspaceStore((s) => s.activeId)
  const setActiveId = useWorkspaceStore((s) => s.setActiveId)
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace)
  const createNewWorkspace = useWorkspaceStore((s) => s.createNewWorkspace)
  const onCloseWorkspace = useWorkspaceStore((s) => s.onCloseWorkspace)
  const onSplitWith = useWorkspaceStore((s) => s.onSplitWith)
  const handleSwitchWorkspace = useWorkspaceStore((s) => s.handleSwitchWorkspace)
  const isSplitEnabled = useWorkspaceStore((s) => s.isSplitEnabled)
  const setIsSplitEnabled = useWorkspaceStore((s) => s.setIsSplitEnabled)
  const toggleSplit = useWorkspaceStore((s) => s.toggleSplit)
  const splitViewIds = useWorkspaceStore((s) => s.splitViewIds)
  const setSplitViewIds = useWorkspaceStore((s) => s.setSplitViewIds)

  const activeWorkspace = workspaces.find((w) => w.id === activeId) || null

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
