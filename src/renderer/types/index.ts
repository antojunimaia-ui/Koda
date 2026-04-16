// ─── Shared Types ────────────────────────────────────────────────────────────

export type Mode = 'fast' | 'planner' | 'colab' | 'teach'

export interface AttachedImage {
  dataUrl: string
  mimeType: string
  name: string
}

export interface MessageEntry {
  id: number
  type: 'user' | 'assistant' | 'system' | 'error' | 'tool' | 'pty'
  text?: string
  images?: AttachedImage[]
  done?: boolean
  remote?: boolean
  tool?: {
    name: string
    status: 'running' | 'done' | 'awaiting_approval'
    output?: string
    success: boolean
    pid?: number
    command?: string
    baseCommand?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: any
  }
  pty?: {
    pid: number
    output: string
    exited?: boolean
  }
}

export interface KodaSettings {
  showTerminal: boolean
  showShellWait: boolean
  showFileRead: boolean
  showFileEdit: boolean
  showFileWrite: boolean
  showListDir: boolean
  showFileFind: boolean
  showSearch: boolean
  showLspQuery: boolean
  showBrowserAgent: boolean
  showPlanMode: boolean
  showColab: boolean
  uiMode: 'classic' | 'modern'
}

export interface KodaTheme {
  id: string
  name: string
  colors: {
    bg: string
    bgAlt: string
    sidebar: string
    accent: string
    accentAlt: string
    text: string
    textDim: string
    border: string
    userMsg: string
  }
}

export interface TrackedFile {
  path: string
  access: 'read' | 'modified'
  timestamp: number
}

export interface AgentInfo {
  provider: string
  model: string
  advisorModel: string
  project: string
  cwd: string
}

export interface SlashItem {
  name: string
  description: string
  icon: string
  isSkill?: boolean
}
