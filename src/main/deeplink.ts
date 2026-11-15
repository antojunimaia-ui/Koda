import { IPC_CHANNELS } from '../shared/ipc.js'
import { getMainWindow } from './windows.js'
import { parseDeepLink } from './utils/deeplink-parse.js'

export type { DeepLink, DeeplinkWorkspace } from './utils/deeplink-parse.js'
export { parseDeepLink } from './utils/deeplink-parse.js'

let pendingDeepLink: ReturnType<typeof parseDeepLink> = null

export function getPendingDeepLink(): ReturnType<typeof parseDeepLink> {
  return pendingDeepLink
}

export function clearPendingDeepLink(): void {
  pendingDeepLink = null
}

/**
 * Processa um deep link recebido (argv no Windows/Linux ou open-url no macOS).
 * Se a janela principal já existe, encaminha na hora; senão deixa pendente para
 * ser despachado logo após o createWindow.
 */
export function handleDeepLink(raw: string): void {
  const link = parseDeepLink(raw)
  if (!link) return

  pendingDeepLink = link
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC_CHANNELS.deeplink.workspace, link.id)
    clearPendingDeepLink()
  }
}

/** Despacha um deep link pendente (chamado após a janela principal existir). */
export function flushPendingDeepLink(): void {
  const link = getPendingDeepLink()
  if (!link) return
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC_CHANNELS.deeplink.workspace, link.id)
  }
  clearPendingDeepLink()
}
