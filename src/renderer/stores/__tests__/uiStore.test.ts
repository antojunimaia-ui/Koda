import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from '../uiStore.js'

beforeEach(() => {
  useUIStore.setState({
    showSettings: false,
    showMcpSettings: false,
    showBrowser: false,
    showTerminal: false,
    showPanel: false,
    showExplorer: false,
    showSourceControl: false,
    contextPanelTab: 'context',
    showWelcomeWizard: false,
  })
})

describe('uiStore', () => {
  it('starts with sane defaults', () => {
    const s = useUIStore.getState()
    expect(s.showSettings).toBe(false)
    expect(s.showTerminal).toBe(false)
    expect(s.contextPanelTab).toBe('context')
    expect(s.showWelcomeWizard).toBe(false)
  })

  it('setters update individual flags', () => {
    useUIStore.getState().setShowSettings(true)
    useUIStore.getState().setContextPanelTab('explorer')
    expect(useUIStore.getState().showSettings).toBe(true)
    expect(useUIStore.getState().contextPanelTab).toBe('explorer')
  })

  it('toggles flip boolean flags', () => {
    useUIStore.getState().toggleBrowser()
    useUIStore.getState().toggleTerminal()
    useUIStore.getState().togglePanel()
    useUIStore.getState().toggleSourceControl()

    const s = useUIStore.getState()
    expect(s.showBrowser).toBe(true)
    expect(s.showTerminal).toBe(true)
    expect(s.showPanel).toBe(true)
    expect(s.showSourceControl).toBe(true)

    useUIStore.getState().toggleBrowser()
    expect(useUIStore.getState().showBrowser).toBe(false)
  })
})
