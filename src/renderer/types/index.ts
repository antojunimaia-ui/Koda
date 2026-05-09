// ─── Shared Types ────────────────────────────────────────────────────────────

export type Mode = 'fast' | 'planner' | 'colab' | 'teach'

export interface AttachedFile {
  dataUrl: string
  mimeType: string
  name: string
  isImage?: boolean
}

export interface MessageEntry {
  id: number
  type: 'user' | 'assistant' | 'system' | 'error' | 'tool' | 'pty'
  text?: string
  images?: AttachedFile[]
  done?: boolean
  remote?: boolean
  tool?: {
    name: string
    status: 'running' | 'writing' | 'done' | 'awaiting_approval'
    isNew?: boolean
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
  showPty: boolean
  uiMode: 'classic' | 'modern'
  toolViewMode: 'standard' | 'compact'
  browserPosition: 'left' | 'right'
  terminalPosition: 'left' | 'right'
  showIconBar: boolean
  explorerButtonPosition: 'iconbar' | 'titlebar'
  explorerTabPosition: 'panel' | 'iconbar' | 'titlebar'
  showExplorerPanel: boolean
  showEditorPanel: boolean
  discordRPC?: boolean
}

export interface KodaTheme {
  id: string
  name: string
  colors: {
    // ── Base surfaces ──────────────────────────────
    bg: string           // Main background
    bgAlt: string        // Slightly lighter bg (panels, cards)
    sidebar: string      // Sidebar / left panel bg

    // ── Typography ─────────────────────────────────
    text: string         // Primary text
    textDim: string      // Muted / secondary text
    textFaint: string    // Very faint text (watermarks, placeholders)

    // ── Borders ────────────────────────────────────
    border: string       // Default border
    borderFaint: string  // Subtle dividers

    // ── Accent colors ──────────────────────────────
    accent: string       // Primary accent (cyan / neon)
    accentAlt: string    // Secondary accent (magenta / purple)
    accentGlow: string   // Glow / shadow color for accent (rgba)

    // ── Semantic status colors ──────────────────────
    statusOk: string     // Ready / success (green)
    statusBusy: string   // Processing / busy (yellow/amber)
    statusError: string  // Error (red/rose)
    statusInfo: string   // Info / neutral (blue/indigo)

    // ── Terminal / code ────────────────────────────
    codeBg: string       // Code block background
    codeText: string     // Code block text
    codeSyntax: string   // Syntax highlighting accent
    inlineCode: string   // Inline `code` text color

    // ── Message bubbles ────────────────────────────
    userMsg: string      // User message background (rgba)
    toolMsg: string      // Tool output background (rgba)
  }
}

export interface TrackedFile {
  path: string
  access: 'read' | 'modified'
  timestamp: number
}

export interface AgentInfo {
  providerId?: string
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

export interface QuestionOption {
  label: string
  description: string
}

export interface Question {
  header: string
  multiple: boolean
  question: string
  options: QuestionOption[]
}

export interface QuestionAnswer {
  index: number
  question: string
  selected: string[]
}

export interface Workspace {
  id: string
  name: string
  cwd: string
  messages: MessageEntry[]
  isProcessing: boolean
  agentInfo: AgentInfo
  mode: Mode
  trackedFiles: TrackedFile[]
  pinnedFiles: string[]
  pendingImages: AttachedFile[]
  taskQueue: { text: string; images: AttachedFile[] }[]
  pendingPlan: string | null
  pendingQuestions: Question[] | null
  pendingShell: { command: string; baseCommand: string; description?: string } | null
  inPlanMode: boolean
  terminalOutput: string
  currentSessionId: string | null
}
