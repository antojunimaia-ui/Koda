import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('koda', {
  init: () => ipcRenderer.invoke('agent:init'),
  sendMessage: (messageId: number, message: string) => ipcRenderer.invoke('agent:message', messageId, message),
  snapshotRestore: (messageId: number) => ipcRenderer.invoke('snapshot:restore', messageId),
  reset: () => ipcRenderer.invoke('agent:reset'),
  getTokens: () => ipcRenderer.invoke('agent:tokens'),
  getInfo: () => ipcRenderer.invoke('agent:info'),
  cd: (path: string) => ipcRenderer.invoke('agent:cd', path),
  setApiKey: (key: string) => ipcRenderer.invoke('agent:apikey', key),
  setModel: (model: string) => ipcRenderer.invoke('agent:model', model),
  getModels: (provider: string, apiKey: string) => ipcRenderer.invoke('agent:getModels', provider, apiKey),
  setup: (config: { provider?: string, model?: string, apiKey?: string }) => ipcRenderer.invoke('agent:setup', config),
  onUpdate: (callback: (update: any) => void) => {
    ipcRenderer.on('agent:update', (_event, update) => callback(update))
  },
  removeUpdateListener: () => {
    ipcRenderer.removeAllListeners('agent:update')
  },
  planResponse: (approved: boolean) => ipcRenderer.invoke('agent:plan_response', approved),
  ptySendCtrlC: (pid: number) => ipcRenderer.invoke('pty:ctrl_c', pid),
  ptyKill: (pid: number) => ipcRenderer.invoke('pty:kill', pid),
  getFiles: () => ipcRenderer.invoke('project:get_files'),
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  selectDirectory: () => ipcRenderer.invoke('window:open_directory')
})
