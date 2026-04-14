import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('koda', {
  init: () => ipcRenderer.invoke('agent:init'),
  sendMessage: (messageId: number, message: string, images?: any[]) => ipcRenderer.invoke('agent:message', messageId, message, images),
  snapshotRestore: (messageId: number) => ipcRenderer.invoke('snapshot:restore', messageId),
  reset: () => ipcRenderer.invoke('agent:reset'),
  getTokens: () => ipcRenderer.invoke('agent:tokens'),
  getInfo: () => ipcRenderer.invoke('agent:info'),
  cd: (path: string) => ipcRenderer.invoke('agent:cd', path),
  setApiKey: (key: string) => ipcRenderer.invoke('agent:apikey', key),
  setModel: (model: string) => ipcRenderer.invoke('agent:model', model),
  getModels: (provider: string, apiKey: string) => ipcRenderer.invoke('agent:getModels', provider, apiKey),
  setup: (config: { provider?: string, model?: string, apiKey?: string }) => ipcRenderer.invoke('agent:setup', config),
  openFile: (filePath: string, line?: number) => ipcRenderer.invoke('agent:open_file', filePath, line),
  onUpdate: (callback: (update: any) => void) => {
    const listener = (_event: any, update: any) => callback(update)
    ipcRenderer.on('agent:update', listener)
    return () => ipcRenderer.removeListener('agent:update', listener)
  },
  removeUpdateListener: () => {
    ipcRenderer.removeAllListeners('agent:update')
  },
  planResponse: (approved: boolean) => ipcRenderer.invoke('agent:plan_response', approved),
  shellResponse: (approved: boolean, alwaysAllowBase: boolean, alwaysAllowFull: boolean) => ipcRenderer.invoke('agent:shell_response', approved, alwaysAllowBase, alwaysAllowFull),
  getApprovedCommands: () => ipcRenderer.invoke('agent:get_approved_commands'),
  updateApprovedCommands: (lists: { base?: string[], full?: string[] }) => ipcRenderer.invoke('agent:update_approved_commands', lists),
  ptySendCtrlC: (pid: number) => ipcRenderer.invoke('pty:ctrl_c', pid),
  ptyKill: (pid: number) => ipcRenderer.invoke('pty:kill', pid),
  ptyStart: (cwd?: string) => ipcRenderer.invoke('pty:start', cwd),
  ptyWrite: (pid: number, data: string) => ipcRenderer.invoke('pty:write', pid, data),
  ptyResize: (pid: number, cols: number, rows: number) => ipcRenderer.invoke('pty:resize', pid, cols, rows),
  getFiles: () => ipcRenderer.invoke('project:get_files'),
  getMcpConfigs: () => ipcRenderer.invoke('mcp:get_configs'),
  saveMcpConfigs: (configs: any[]) => ipcRenderer.invoke('mcp:save_configs', configs),
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  selectDirectory: () => ipcRenderer.invoke('window:open_directory')
})
