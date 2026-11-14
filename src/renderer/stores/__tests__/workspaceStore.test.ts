import { beforeEach, describe, expect, it } from 'vitest'
import type { Workspace } from '../../types/index.js'
import { useWorkspaceStore } from '../workspaceStore.js'

function makeWs(id: string): Workspace {
  return {
    id,
    name: `Ws ${id}`,
    cwd: '/repo',
    messages: [],
    isProcessing: false,
    agentInfo: {
      providerId: undefined,
      provider: 'openai',
      model: 'm',
      advisorModel: 'm',
      project: 'p',
      cwd: '/repo',
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

beforeEach(() => {
  useWorkspaceStore.setState({ workspaces: [], activeId: null, isSplitEnabled: false, splitViewIds: null })
})

describe('workspaceStore', () => {
  it('updateWorkspace applies partial updates and updater functions', () => {
    useWorkspaceStore.setState({ workspaces: [makeWs('a')] })
    useWorkspaceStore.getState().updateWorkspace('a', { mode: 'planner' })
    expect(useWorkspaceStore.getState().workspaces[0].mode).toBe('planner')

    useWorkspaceStore.getState().updateWorkspace('a', (prev) => ({ ...prev, terminalOutput: 'x' }))
    expect(useWorkspaceStore.getState().workspaces[0].terminalOutput).toBe('x')
  })

  it('onCloseWorkspace does not close the last workspace', () => {
    useWorkspaceStore.setState({ workspaces: [makeWs('a')], activeId: 'a' })
    useWorkspaceStore.getState().onCloseWorkspace('a')
    expect(useWorkspaceStore.getState().workspaces).toHaveLength(1)
  })

  it('onCloseWorkspace removes the workspace and fixes activeId', () => {
    useWorkspaceStore.setState({ workspaces: [makeWs('a'), makeWs('b')], activeId: 'a', splitViewIds: ['a', 'b'] })
    useWorkspaceStore.getState().onCloseWorkspace('a')
    const state = useWorkspaceStore.getState()
    expect(state.workspaces.map((w) => w.id)).toEqual(['b'])
    expect(state.activeId).toBe('b')
    expect(state.splitViewIds).toBeNull()
  })

  it('onSplitWith sets a pair and toggles off when repeated', () => {
    useWorkspaceStore.setState({ workspaces: [makeWs('a'), makeWs('b')], activeId: 'a' })
    useWorkspaceStore.getState().onSplitWith('b')
    expect(useWorkspaceStore.getState().splitViewIds).toEqual(['b', 'a'])

    useWorkspaceStore.getState().onSplitWith('b')
    expect(useWorkspaceStore.getState().splitViewIds).toBeNull()
  })

  it('handleSwitchWorkspace changes the active workspace and clears unrelated split', () => {
    useWorkspaceStore.setState({
      workspaces: [makeWs('a'), makeWs('b'), makeWs('c')],
      activeId: 'a',
      splitViewIds: ['a', 'b'],
    })
    useWorkspaceStore.getState().handleSwitchWorkspace('c')
    const state = useWorkspaceStore.getState()
    expect(state.activeId).toBe('c')
    expect(state.splitViewIds).toBeNull()
  })

  it('toggleSplit flips the split flag', () => {
    expect(useWorkspaceStore.getState().isSplitEnabled).toBe(false)
    useWorkspaceStore.getState().toggleSplit()
    expect(useWorkspaceStore.getState().isSplitEnabled).toBe(true)
  })
})
