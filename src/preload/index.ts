import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, KodaApi } from '../shared/ipc.js'

const api: KodaApi = {
  init: (workspaceId: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.init, workspaceId),
  openIDE: () => ipcRenderer.invoke(IPC_CHANNELS.window.openIDE),
  openAgent: () => ipcRenderer.invoke(IPC_CHANNELS.window.openAgent),
  openADE: () => ipcRenderer.invoke(IPC_CHANNELS.window.openADE),
  generateWorkspaceId: () => ipcRenderer.invoke(IPC_CHANNELS.workspace.newId),
  onOpenWorkspace: (callback) => {
    const listener = (_event: unknown, id: string) => callback(id)
    ipcRenderer.on(IPC_CHANNELS.deeplink.workspace, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.deeplink.workspace, listener)
  },
  sendMessage: (workspaceId: string, messageId: number, message: string, images?: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.agent.message, workspaceId, messageId, message, images),
  snapshotRestore: (workspaceId: string, messageId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.agent.snapshotRestore, workspaceId, messageId),
  reset: (workspaceId: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.reset, workspaceId),
  softReset: (workspaceId: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.softReset, workspaceId),
  getTokens: (workspaceId: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.tokens, workspaceId),
  getInfo: (workspaceId: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.info, workspaceId),
  cd: (workspaceId: string, path: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.cd, workspaceId, path),
  setApiKey: (workspaceId: string, key: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.apiKey, workspaceId, key),
  setModel: (workspaceId: string, model: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.model, workspaceId, model),
  getModels: (provider: string, apiKey: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.getModels, provider, apiKey),
  setup: (workspaceId: string, config) => ipcRenderer.invoke(IPC_CHANNELS.agent.setup, workspaceId, config),
  // O renderer chama openFile(workspaceId, filePath, line?) — o workspaceId é descartado
  // aqui, pois o handler `agent:open_file` espera (filePath, line?).
  openFile: (workspaceId: string, filePath: string, line?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.agent.openFile, filePath, line),
  onUpdate: (callback) => {
    const listener = (_event: unknown, update: Record<string, unknown>) => callback(update)
    ipcRenderer.on(IPC_CHANNELS.agent.update, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.agent.update, listener)
  },
  removeUpdateListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.agent.update)
  },
  onFileSystemChange: (callback) => {
    const listener = (_event: unknown, change: { type: string; path: string; directory: string }) => callback(change)
    ipcRenderer.on(IPC_CHANNELS.project.change, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.project.change, listener)
  },
  planResponse: (approved: boolean) => ipcRenderer.invoke(IPC_CHANNELS.agent.planResponse, approved),
  questionsResponse: (answers: unknown[]) => ipcRenderer.invoke(IPC_CHANNELS.agent.questionsResponse, answers),
  shellResponse: (approved: boolean, alwaysAllowBase: boolean, alwaysAllowFull: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.agent.shellResponse, approved, alwaysAllowBase, alwaysAllowFull),
  getApprovedCommands: () => ipcRenderer.invoke(IPC_CHANNELS.agent.getApprovedCommands),
  updateApprovedCommands: (lists) => ipcRenderer.invoke(IPC_CHANNELS.agent.updateApprovedCommands, lists),
  getSlashCommands: () => ipcRenderer.invoke(IPC_CHANNELS.agent.getSlashCommands),
  ptySendCtrlC: (pid: number) => ipcRenderer.invoke(IPC_CHANNELS.pty.ctrlC, pid),
  ptyKill: (pid: number) => ipcRenderer.invoke(IPC_CHANNELS.pty.kill, pid),
  ptyStart: (workspaceId?: string, cwd?: string) => ipcRenderer.invoke(IPC_CHANNELS.pty.start, workspaceId, cwd),
  ptyWrite: (pid: number, data: string) => ipcRenderer.invoke(IPC_CHANNELS.pty.write, pid, data),
  ptyResize: (pid: number, cols: number, rows: number) => ipcRenderer.invoke(IPC_CHANNELS.pty.resize, pid, cols, rows),
  getFiles: () => ipcRenderer.invoke(IPC_CHANNELS.project.getFiles),
  listDirLazy: (dirPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.project.listDirLazy, dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.project.readFile, filePath),
  readFileBase64: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.project.readFileBase64, filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.project.writeFile, filePath, content),
  deleteFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.project.deleteFile, filePath),
  renameFile: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.project.renameFile, oldPath, newPath),
  createFolder: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.project.createFolder, folderPath),
  getMcpConfigs: () => ipcRenderer.invoke(IPC_CHANNELS.mcp.getConfigs),
  saveMcpConfigs: (configs: unknown[]) => ipcRenderer.invoke(IPC_CHANNELS.mcp.saveConfigs, configs),
  mcpServerStart: (opts?: { allowMutatingTools?: boolean }) => ipcRenderer.invoke(IPC_CHANNELS.mcp.serverStart, opts),
  mcpServerStop: () => ipcRenderer.invoke(IPC_CHANNELS.mcp.serverStop),
  mcpServerStatus: () => ipcRenderer.invoke(IPC_CHANNELS.mcp.serverStatus),
  getProjectSession: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.getSession, projectPath),
  saveProjectSession: (workspaceId: string, projectPath: string, data: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.agent.saveSession, workspaceId, projectPath, data),
  listProjectSessions: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.listSessions, projectPath),
  getSessionById: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.getSessionById, sessionId),
  deleteSession: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.deleteSession, sessionId),
  listSkills: () => ipcRenderer.invoke(IPC_CHANNELS.skills.list),
  marketplaceFetch: () => ipcRenderer.invoke(IPC_CHANNELS.marketplace.fetch),
  marketplaceInstall: (skillName: string, version?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.marketplace.install, skillName, version),
  marketplaceUninstall: (skillName: string) => ipcRenderer.invoke(IPC_CHANNELS.marketplace.uninstall, skillName),
  koClawStart: (config) => ipcRenderer.invoke(IPC_CHANNELS.koclaw.start, config),
  koClawStop: () => ipcRenderer.invoke(IPC_CHANNELS.koclaw.stop),
  koClawStatus: () => ipcRenderer.invoke(IPC_CHANNELS.koclaw.status),
  // Discord RPC
  discordEnable: () => ipcRenderer.invoke(IPC_CHANNELS.discord.enable),
  discordDisable: () => ipcRenderer.invoke(IPC_CHANNELS.discord.disable),
  discordIsEnabled: () => ipcRenderer.invoke(IPC_CHANNELS.discord.isEnabled),
  discordUpdateActivity: (activity) => ipcRenderer.invoke(IPC_CHANNELS.discord.updateActivity, activity),
  discordClearActivity: () => ipcRenderer.invoke(IPC_CHANNELS.discord.clearActivity),
  // Git
  gitInfo: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.git.info, cwd),
  gitCheckout: (cwd: string, branch: string) => ipcRenderer.invoke(IPC_CHANNELS.git.checkout, cwd, branch),
  gitStatus: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.git.status, cwd),
  gitStage: (cwd: string, filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.git.stage, cwd, filePath),
  gitUnstage: (cwd: string, filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.git.unstage, cwd, filePath),
  gitStageAll: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.git.stageAll, cwd),
  gitCommit: (cwd: string, message: string) => ipcRenderer.invoke(IPC_CHANNELS.git.commit, cwd, message),
  gitPush: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.git.push, cwd),
  gitPull: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.git.pull, cwd),
  gitLog: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.git.log, cwd),
  // Window controls
  minimize: () => ipcRenderer.invoke(IPC_CHANNELS.window.minimize),
  maximize: () => ipcRenderer.invoke(IPC_CHANNELS.window.maximize),
  close: () => ipcRenderer.invoke(IPC_CHANNELS.window.close),
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.window.openDirectory),
  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.window.openExternal, url),
  updaterInstall: () => ipcRenderer.invoke(IPC_CHANNELS.updater.install),
  onUpdaterEvent: (callback) => {
    const available = (_e: unknown, data: unknown) => callback('update-available', data)
    const downloaded = (_e: unknown) => callback('update-downloaded')
    ipcRenderer.on(IPC_CHANNELS.updater.updateAvailable, available)
    ipcRenderer.on(IPC_CHANNELS.updater.updateDownloaded, downloaded)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.updater.updateAvailable, available)
      ipcRenderer.removeListener(IPC_CHANNELS.updater.updateDownloaded, downloaded)
    }
  },
}

contextBridge.exposeInMainWorld('koda', api)
