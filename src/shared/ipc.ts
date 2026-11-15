// ─── Contrato IPC compartilhado ────────────────────────────────────────────────
// Fonte única de verdade para o barramento IPC do Koda.
//
// - `IPC_CHANNELS`: nomes canônicos de todos os canais (main, preload, renderer).
// - `KodaApi`: forma completa de `window.koda` exposta pelo preload.
//
// Importado por:
//   src/main/ipc/*            (handlers — usam IPC_CHANNELS)
//   src/preload/index.ts      (implementa KodaApi)
//   src/renderer/global.d.ts  (declara window.koda: KodaApi)

import type { KoClawStartConfig, SetupConfig } from './schemas.js'

// ─── Tipos de domínio ─────────────────────────────────────────────────────────

export interface AgentInfo {
  providerId?: string
  provider: string
  model: string
  advisorModel: string
  project: string
  cwd: string
}

export interface SlashCommand {
  name: string
  description: string
  icon: string
}

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

export interface SkillInfo {
  name: string
  description: string
  triggers: string[]
  filePath: string
}

export interface ApprovedCommands {
  base: string[]
  full: string[]
}

export interface KoClawStatus {
  running: boolean
  port: number | null
}

export interface DiscordActivity {
  projectName: string
  fileName?: string
  fileType?: string
  startTimestamp?: number
}

export interface GitStatusFile {
  path: string
  status: string
  staged: boolean
  unstaged: boolean
}

export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  body: string
  author: string
  date: string
  fullDate: string
  branch: string | null
  insertions: number
  deletions: number
  filesChanged: number
}

export interface SessionSummary {
  id: string
  title: string
  timestamp: number
}

export interface FileSystemChange {
  type: string
  path: string
  directory: string
}

// ─── Resultados padrão ────────────────────────────────────────────────────────

export type ResultOk<T = Record<string, never>> = { success: true } & T
export type ResultErr = { success: false; error?: string }
export type Result<T = Record<string, never>> = ResultOk<T> | ResultErr

// ─── Canais IPC ───────────────────────────────────────────────────────────────

export const IPC_CHANNELS = {
  agent: {
    init: 'agent:init',
    message: 'agent:message',
    snapshotRestore: 'snapshot:restore',
    reset: 'agent:reset',
    softReset: 'agent:soft_reset',
    tokens: 'agent:tokens',
    info: 'agent:info',
    cd: 'agent:cd',
    getSession: 'agent:get_session',
    saveSession: 'agent:save_session',
    listSessions: 'agent:list_sessions',
    getSessionById: 'agent:get_session_by_id',
    deleteSession: 'agent:delete_session',
    apiKey: 'agent:apikey',
    setup: 'agent:setup',
    openFile: 'agent:open_file',
    model: 'agent:model',
    planResponse: 'agent:plan_response',
    questionsResponse: 'agent:questions_response',
    shellResponse: 'agent:shell_response',
    getApprovedCommands: 'agent:get_approved_commands',
    updateApprovedCommands: 'agent:update_approved_commands',
    getSlashCommands: 'agent:get_slash_commands',
    getModels: 'agent:getModels',
    update: 'agent:update',
  },
  workspace: {
    newId: 'workspace:new_id',
  },
  deeplink: {
    workspace: 'deeplink:workspace',
  },
  project: {
    getFiles: 'project:get_files',
    listDirLazy: 'project:list_dir_lazy',
    readFile: 'project:read_file',
    readFileBase64: 'project:read_file_base64',
    writeFile: 'project:write_file',
    deleteFile: 'project:delete_file',
    renameFile: 'project:rename_file',
    createFolder: 'project:create_folder',
    change: 'file-system:change',
  },
  pty: {
    ctrlC: 'pty:ctrl_c',
    kill: 'pty:kill',
    start: 'pty:start',
    write: 'pty:write',
    resize: 'pty:resize',
  },
  git: {
    info: 'git:info',
    checkout: 'git:checkout',
    status: 'git:status',
    stage: 'git:stage',
    unstage: 'git:unstage',
    stageAll: 'git:stage_all',
    commit: 'git:commit',
    push: 'git:push',
    pull: 'git:pull',
    log: 'git:log',
  },
  skills: {
    list: 'skills:list',
  },
  marketplace: {
    fetch: 'marketplace:fetch',
    install: 'marketplace:install',
    uninstall: 'marketplace:uninstall',
  },
  koclaw: {
    start: 'koclaw:start',
    stop: 'koclaw:stop',
    status: 'koclaw:status',
  },
  mcp: {
    getConfigs: 'mcp:get_configs',
    saveConfigs: 'mcp:save_configs',
    serverStart: 'mcp:server_start',
    serverStop: 'mcp:server_stop',
    serverStatus: 'mcp:server_status',
  },
  discord: {
    enable: 'discord:enable',
    disable: 'discord:disable',
    isEnabled: 'discord:is_enabled',
    updateActivity: 'discord:update_activity',
    clearActivity: 'discord:clear_activity',
  },
  window: {
    minimize: 'window:minimize',
    maximize: 'window:maximize',
    close: 'window:close',
    openIDE: 'window:open_ide',
    openAgent: 'window:open_agent',
    openADE: 'window:open_ade',
    openExternal: 'window:open_external',
    openDirectory: 'window:open_directory',
  },
  updater: {
    install: 'updater:install',
    updateAvailable: 'updater:update-available',
    updateDownloaded: 'updater:update-downloaded',
  },
} as const

// ─── API exposta ao renderer (window.koda) ────────────────────────────────────

export interface KodaApi {
  // ── Agente ─────────────────────────────────────────────
  init: (workspaceId: string) => Promise<{ success: boolean; info: AgentInfo; error?: string }>
  sendMessage: (
    workspaceId: string,
    messageId: number,
    message: string,
    images?: unknown[],
  ) => Promise<{ success: boolean; response?: string; error?: string }>
  snapshotRestore: (workspaceId: string, messageId: number) => Promise<{ success: boolean; error?: string }>
  reset: (workspaceId: string) => Promise<{ success: boolean; error?: string }>
  softReset: (workspaceId: string) => Promise<{ success: boolean; error?: string }>
  getTokens: (workspaceId: string) => Promise<string>
  getInfo: (workspaceId: string) => Promise<AgentInfo>
  cd: (workspaceId: string, path: string) => Promise<{ success: boolean; info?: AgentInfo; error?: string }>
  setApiKey: (workspaceId: string, key: string) => Promise<{ success: boolean; info?: AgentInfo; error?: string }>
  setModel: (workspaceId: string, model: string) => Promise<{ success: boolean; info?: AgentInfo; error?: string }>
  getModels: (provider: string, apiKey: string) => Promise<{ success: boolean; models?: string[]; error?: string }>
  setup: (workspaceId: string, config: SetupConfig) => Promise<{ success: boolean; info?: AgentInfo; error?: string }>
  openFile: (workspaceId: string, filePath: string, line?: number) => Promise<{ success: boolean; error?: string }>
  onUpdate: (callback: (update: Record<string, unknown>) => void) => () => void
  removeUpdateListener: () => void
  planResponse: (approved: boolean) => Promise<{ success: boolean }>
  questionsResponse: (answers: unknown[]) => Promise<{ success: boolean }>
  shellResponse: (
    approved: boolean,
    alwaysAllowBase: boolean,
    alwaysAllowFull: boolean,
  ) => Promise<{ success: boolean }>
  getApprovedCommands: () => Promise<ApprovedCommands>
  updateApprovedCommands: (lists: { base?: string[]; full?: string[] }) => Promise<{ success: boolean }>
  getSlashCommands: () => Promise<{ success: boolean; commands: SlashCommand[] }>

  // ── Sessões ────────────────────────────────────────────
  getProjectSession: (projectPath: string) => Promise<unknown>
  saveProjectSession: (workspaceId: string, projectPath: string, data: unknown) => Promise<void>
  listProjectSessions: (projectPath: string) => Promise<SessionSummary[]>
  getSessionById: (sessionId: string) => Promise<unknown>
  deleteSession: (sessionId: string) => Promise<void>

  // ── PTY / Terminal ─────────────────────────────────────
  ptySendCtrlC: (pid: number) => Promise<{ success: boolean; error?: string }>
  ptyKill: (pid: number) => Promise<{ success: boolean; error?: string }>
  ptyStart: (workspaceId?: string, cwd?: string) => Promise<{ success: boolean; pid: number }>
  ptyWrite: (pid: number, data: string) => Promise<{ success: boolean }>
  ptyResize: (pid: number, cols: number, rows: number) => Promise<{ success: boolean }>

  // ── Projeto / filesystem ───────────────────────────────
  getFiles: () => Promise<{ success: boolean; files: string[]; error?: string }>
  listDirLazy: (dirPath?: string) => Promise<{ success: boolean; files: DirEntry[]; error?: string }>
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
  readFileBase64: (filePath: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
  createFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>
  onFileSystemChange: (callback: (change: FileSystemChange) => void) => () => void

  // ── MCP ────────────────────────────────────────────────
  getMcpConfigs: () => Promise<unknown[]>
  saveMcpConfigs: (configs: unknown[]) => Promise<{ success: boolean; error?: string }>
  mcpServerStart: (opts?: { allowMutatingTools?: boolean }) => Promise<{ success: boolean; error?: string }>
  mcpServerStop: () => Promise<{ success: boolean }>
  mcpServerStatus: () => Promise<{ running: boolean }>

  // ── Skills / Marketplace ───────────────────────────────
  listSkills: () => Promise<{ success: boolean; skills?: SkillInfo[]; error?: string }>
  marketplaceFetch: () => Promise<{ success: boolean; skills: unknown[]; error?: string }>
  marketplaceInstall: (skillName: string, version?: string) => Promise<{ success: boolean; error?: string }>
  marketplaceUninstall: (skillName: string) => Promise<{ success: boolean; error?: string }>

  // ── KoClaw ─────────────────────────────────────────────
  koClawStart: (config: KoClawStartConfig) => Promise<{ success: boolean; error?: string }>
  koClawStop: () => Promise<{ success: boolean }>
  koClawStatus: () => Promise<KoClawStatus>

  // ── Discord RPC ────────────────────────────────────────
  discordEnable: () => Promise<{ success: boolean; error?: string }>
  discordDisable: () => Promise<{ success: boolean }>
  discordIsEnabled: () => Promise<{ enabled: boolean }>
  discordUpdateActivity: (activity: DiscordActivity) => Promise<{ success: boolean; error?: string }>
  discordClearActivity: () => Promise<{ success: boolean; error?: string }>

  // ── Git ────────────────────────────────────────────────
  gitInfo: (cwd: string) => Promise<{ success: boolean; branch: string | null; branches: string[] }>
  gitCheckout: (cwd: string, branch: string) => Promise<{ success: boolean; error?: string }>
  gitStatus: (cwd: string) => Promise<{ success: boolean; files?: GitStatusFile[]; error?: string }>
  gitStage: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>
  gitUnstage: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>
  gitStageAll: (cwd: string) => Promise<{ success: boolean; error?: string }>
  gitCommit: (cwd: string, message: string) => Promise<{ success: boolean; error?: string }>
  gitPush: (cwd: string) => Promise<{ success: boolean; error?: string }>
  gitPull: (cwd: string) => Promise<{ success: boolean; error?: string }>
  gitLog: (cwd: string) => Promise<{ success: boolean; commits?: GitCommit[]; currentBranch?: string; error?: string }>

  // ── Janela / sistema ───────────────────────────────────
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  selectDirectory: () => Promise<string | null>
  updaterInstall: () => Promise<void>
  onUpdaterEvent: (callback: (event: string, data?: unknown) => void) => () => void
  openIDE: () => Promise<void>
  openAgent: () => Promise<void>
  openADE: () => Promise<void>

  // ── Workspaces ───────────────────────────────────────
  /** Pede um novo ID de workspace ao main (fonte da verdade). */
  generateWorkspaceId: () => Promise<string>

  // ── Deep links ───────────────────────────────────────
  /** Assina eventos koda://workspace/<id> vindos do main. */
  onOpenWorkspace: (callback: (id: string) => void) => () => void
}
