import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc.js'
import { generateWorkspaceId } from '../utils/ids.js'

/**
 * Handlers de workspace — Fase 0.
 *
 * `workspace:new_id` faz do main a fonte da verdade dos IDs de workspace: o
 * renderer pede um ID aqui (gerado com crypto) em vez de criar um localmente.
 */
export function registerWorkspaceHandlers() {
  ipcMain.handle(IPC_CHANNELS.workspace.newId, () => generateWorkspaceId())
}
