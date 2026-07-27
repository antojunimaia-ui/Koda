import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('koda', {
  init: (workspaceId: string) => ipcRenderer.invoke('agent:init', workspaceId),
  openIDE: () => ipcRenderer.invoke('window:open_ide'),
  openAgent: () => ipcRenderer.invoke('window:open_agent'),
  sendMessage: (workspaceId: string, messageId: number, message: string, images?: any[]) => ipcRenderer.invoke('agent:message', workspaceId, messageId, message, images),
  snapshotRestore: (workspaceId: string, messageId: number) => ipcRenderer.invoke('snapshot:restore', workspaceId, messageId),
  reset: (workspaceId: string) => ipcRenderer.invoke('agent:reset', workspaceId),
  softReset: (workspaceId: string) => ipcRenderer.invoke('agent:soft_reset', workspaceId),
  getTokens: (workspaceId: string) => ipcRenderer.invoke('agent:tokens', workspaceId),
  getInfo: (workspaceId: string) => ipcRenderer.invoke('agent:info', workspaceId),
  cd: (workspaceId: string, path: string) => ipcRenderer.invoke('agent:cd', workspaceId, path),
  setApiKey: (workspaceId: string, key: string) => ipcRenderer.invoke('agent:apikey', workspaceId, key),
  setModel: (workspaceId: string, model: string) => ipcRenderer.invoke('agent:model', workspaceId, model),
  getModels: (provider: string, apiKey: string) => ipcRenderer.invoke('agent:getModels', provider, apiKey),
  setup: (workspaceId: string, config: { provider?: string, model?: string, apiKey?: string }) => ipcRenderer.invoke('agent:setup', workspaceId, config),
  openFile: (filePath: string, line?: number) => ipcRenderer.invoke('agent:open_file', filePath, line),
  onUpdate: (callback: (update: any) => void) => {
    const listener = (_event: any, update: any) => callback(update)
    ipcRenderer.on('agent:update', listener)
    return () => ipcRenderer.removeListener('agent:update', listener)
  },
  removeUpdateListener: () => {
    ipcRenderer.removeAllListeners('agent:update')
  },
  onFileSystemChange: (callback: (change: { type: string; path: string; directory: string }) => void) => {
    const listener = (_event: any, change: any) => callback(change)
    ipcRenderer.on('file-system:change', listener)
    return () => ipcRenderer.removeListener('file-system:change', listener)
  },
  planResponse: (approved: boolean) => ipcRenderer.invoke('agent:plan_response', approved),
  questionsResponse: (answers: any[]) => ipcRenderer.invoke('agent:questions_response', answers),
  shellResponse: (approved: boolean, alwaysAllowBase: boolean, alwaysAllowFull: boolean) => ipcRenderer.invoke('agent:shell_response', approved, alwaysAllowBase, alwaysAllowFull),
  getApprovedCommands: () => ipcRenderer.invoke('agent:get_approved_commands'),
  updateApprovedCommands: (lists: { base?: string[], full?: string[] }) => ipcRenderer.invoke('agent:update_approved_commands', lists),
  ptySendCtrlC: (pid: number) => ipcRenderer.invoke('pty:ctrl_c', pid),
  ptyKill: (pid: number) => ipcRenderer.invoke('pty:kill', pid),
  ptyStart: (workspaceId?: string, cwd?: string) => ipcRenderer.invoke('pty:start', workspaceId, cwd),
  ptyWrite: (pid: number, data: string) => ipcRenderer.invoke('pty:write', pid, data),
  ptyResize: (pid: number, cols: number, rows: number) => ipcRenderer.invoke('pty:resize', pid, cols, rows),
  getFiles: () => ipcRenderer.invoke('project:get_files'),
  listDirLazy: (dirPath?: string) => ipcRenderer.invoke('project:list_dir_lazy', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('project:read_file', filePath),
  readFileBase64: (filePath: string) => ipcRenderer.invoke('project:read_file_base64', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('project:write_file', filePath, content),
  deleteFile: (filePath: string) => ipcRenderer.invoke('project:delete_file', filePath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('project:rename_file', oldPath, newPath),
  createFolder: (folderPath: string) => ipcRenderer.invoke('project:create_folder', folderPath),
  getMcpConfigs: () => ipcRenderer.invoke('mcp:get_configs'),
  saveMcpConfigs: (configs: any[]) => ipcRenderer.invoke('mcp:save_configs', configs),
  getProjectSession: (projectPath: string) => ipcRenderer.invoke('agent:get_session', projectPath),
  saveProjectSession: (workspaceId: string, projectPath: string, data: any) => ipcRenderer.invoke('agent:save_session', workspaceId, projectPath, data),
  listProjectSessions: (projectPath: string) => ipcRenderer.invoke('agent:list_sessions', projectPath),
  getSessionById: (sessionId: string) => ipcRenderer.invoke('agent:get_session_by_id', sessionId),
  deleteSession: (sessionId: string) => ipcRenderer.invoke('agent:delete_session', sessionId),
  listSkills: () => ipcRenderer.invoke('skills:list'),
  marketplaceFetch: () => ipcRenderer.invoke('marketplace:fetch'),
  marketplaceInstall: (skillName: string, version?: string) => ipcRenderer.invoke('marketplace:install', skillName, version),
  marketplaceUninstall: (skillName: string) => ipcRenderer.invoke('marketplace:uninstall', skillName),
  koClawStart: (config: { port: number; token: string }) => ipcRenderer.invoke('koclaw:start', config),
  koClawStop: () => ipcRenderer.invoke('koclaw:stop'),
  koClawStatus: () => ipcRenderer.invoke('koclaw:status'),
  // Discord RPC
  discordEnable: () => ipcRenderer.invoke('discord:enable'),
  discordDisable: () => ipcRenderer.invoke('discord:disable'),
  discordIsEnabled: () => ipcRenderer.invoke('discord:is_enabled'),
  discordUpdateActivity: (activity: { projectName: string; fileName?: string; fileType?: string; startTimestamp?: number }) => ipcRenderer.invoke('discord:update_activity', activity),
  discordClearActivity: () => ipcRenderer.invoke('discord:clear_activity'),
  // Git
  gitInfo: (cwd: string) => ipcRenderer.invoke('git:info', cwd),
  gitCheckout: (cwd: string, branch: string) => ipcRenderer.invoke('git:checkout', cwd, branch),
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  selectDirectory: () => ipcRenderer.invoke('window:open_directory'),
  openExternal: (url: string) => ipcRenderer.invoke('window:open_external', url),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),
  onUpdaterEvent: (callback: (event: string, data?: any) => void) => {
    const available = (_e: any, data: any) => callback('update-available', data)
    const downloaded = (_e: any) => callback('update-downloaded')
    ipcRenderer.on('updater:update-available', available)
    ipcRenderer.on('updater:update-downloaded', downloaded)
    return () => {
      ipcRenderer.removeListener('updater:update-available', available)
      ipcRenderer.removeListener('updater:update-downloaded', downloaded)
    }
  }
})
