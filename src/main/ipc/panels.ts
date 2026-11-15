import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc.js'
import {
  focusWorkspacePanel,
  mountWorkspacePanel,
  setPanelsHidden,
  setWorkspacePanelBounds,
  unmountWorkspacePanel,
} from '../panels.js'

/**
 * Handlers dos painéis (WebContentsView) — Fase 2.
 * O renderer host dirige montagem/bounds/foco; o conteúdo do painel é um
 * documento autônomo (?mode=panel&ws=<id>) com partition própria.
 */
export function registerPanelHandlers() {
  ipcMain.handle(IPC_CHANNELS.panel.mount, (_event, wsId: string) => {
    mountWorkspacePanel(String(wsId))
  })
  ipcMain.handle(IPC_CHANNELS.panel.unmount, (_event, wsId: string) => {
    unmountWorkspacePanel(String(wsId))
  })
  ipcMain.handle(
    IPC_CHANNELS.panel.bounds,
    (_event, wsId: string, bounds: { x: number; y: number; width: number; height: number }) => {
      setWorkspacePanelBounds(String(wsId), bounds)
    },
  )
  ipcMain.handle(IPC_CHANNELS.panel.focus, (_event, wsId: string) => {
    focusWorkspacePanel(String(wsId))
  })
  ipcMain.handle(IPC_CHANNELS.panel.setHidden, (_event, hidden: boolean) => {
    setPanelsHidden(Boolean(hidden))
  })
}
