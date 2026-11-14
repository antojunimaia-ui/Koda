import { create } from 'zustand'

export type ContextPanelTab = 'context' | 'explorer'

interface UIState {
  showSettings: boolean
  showMcpSettings: boolean
  showBrowser: boolean
  showTerminal: boolean
  showPanel: boolean
  showExplorer: boolean
  showSourceControl: boolean
  contextPanelTab: ContextPanelTab
  showWelcomeWizard: boolean

  setShowSettings: (value: boolean) => void
  setShowMcpSettings: (value: boolean) => void
  setShowBrowser: (value: boolean) => void
  toggleBrowser: () => void
  setShowTerminal: (value: boolean) => void
  toggleTerminal: () => void
  setShowPanel: (value: boolean) => void
  togglePanel: () => void
  setShowExplorer: (value: boolean) => void
  setShowSourceControl: (value: boolean) => void
  toggleSourceControl: () => void
  setContextPanelTab: (tab: ContextPanelTab) => void
  setShowWelcomeWizard: (value: boolean) => void
}

export const useUIStore = create<UIState>()((set) => ({
  showSettings: false,
  showMcpSettings: false,
  showBrowser: false,
  showTerminal: false,
  showPanel: false,
  showExplorer: false,
  showSourceControl: false,
  contextPanelTab: 'context',
  showWelcomeWizard: false,

  setShowSettings: (value) => set({ showSettings: value }),
  setShowMcpSettings: (value) => set({ showMcpSettings: value }),
  setShowBrowser: (value) => set({ showBrowser: value }),
  toggleBrowser: () => set((s) => ({ showBrowser: !s.showBrowser })),
  setShowTerminal: (value) => set({ showTerminal: value }),
  toggleTerminal: () => set((s) => ({ showTerminal: !s.showTerminal })),
  setShowPanel: (value) => set({ showPanel: value }),
  togglePanel: () => set((s) => ({ showPanel: !s.showPanel })),
  setShowExplorer: (value) => set({ showExplorer: value }),
  setShowSourceControl: (value) => set({ showSourceControl: value }),
  toggleSourceControl: () => set((s) => ({ showSourceControl: !s.showSourceControl })),
  setContextPanelTab: (tab) => set({ contextPanelTab: tab }),
  setShowWelcomeWizard: (value) => set({ showWelcomeWizard: value }),
}))
