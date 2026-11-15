import { BrowserWindow, shell, WebContentsView } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Painéis de workspace como WebContentsView (Fase 2 do design B).
 *
 * Cada workspace em modo split vira um renderer próprio, carregando o app com
 * `?mode=panel&ws=<id>`. Os painéis usam a MESMA sessão do host (sem partition
 * separada) para terem exatamente as mesmas configurações — providers, API
 * keys, tema, approved commands — como o host. O host (janela principal) ainda
 * mantém tabs, dividers e overlays globais; os painéis são views nativos
 * posicionados por bounds em cima do conteúdo da janela.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let host: BrowserWindow | null = null
const panels = new Map<string, WebContentsView>()
const lastBounds = new Map<string, Electron.Rectangle>()

export function attachPanelsToWindow(win: BrowserWindow): void {
  host = win
}

function panelUrl(wsId: string): string {
  // Painéis escondem a titlebar e o histórico de sessões por padrão.
  const extra = '&hideTitlebar=1&hideHistory=1'
  if (process.env.VITE_DEV_SERVER_URL) {
    return `${process.env.VITE_DEV_SERVER_URL}?mode=panel&ws=${wsId}${extra}`
  }
  const indexPath = path.join(__dirname, '../dist/index.html')
  return `file:///${indexPath.replace(/\\/g, '/')}?mode=panel&ws=${wsId}${extra}`
}

export function mountWorkspacePanel(wsId: string): void {
  if (!host || host.isDestroyed()) return
  if (panels.has(wsId)) return

  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      // Sem partition: os painéis compartilham a mesma sessão/localStorage do
      // host, então herdam as mesmas configs (providers, API keys, tema).
      webSecurity: false,
    },
  })

  const rootUrl = process.env.VITE_DEV_SERVER_URL || 'file://'
  view.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(rootUrl)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
  view.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  view.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'crashed' || details.reason === 'killed') {
      console.error('Panel renderer gone:', details.reason)
      setTimeout(() => view.webContents.reload(), 2000)
    }
  })
  view.webContents.once('did-finish-load', () => view.webContents.setZoomFactor(0.9))

  // Começa invisível (bounds 1x1) até o host enviar o primeiro bounds real.
  view.setBounds({ x: 0, y: 0, width: 1, height: 1 })
  host.contentView.addChildView(view)
  panels.set(wsId, view)
  view.webContents.loadURL(panelUrl(wsId))
}

export function unmountWorkspacePanel(wsId: string): void {
  const view = panels.get(wsId)
  if (!view) return
  host?.contentView.removeChildView(view)
  panels.delete(wsId)
  lastBounds.delete(wsId)
  if (!view.webContents.isDestroyed()) view.webContents.close()
}

export function setWorkspacePanelBounds(
  wsId: string,
  bounds: { x: number; y: number; width: number; height: number },
): void {
  const view = panels.get(wsId)
  if (!view) return
  view.setBounds(bounds)
}

export function focusWorkspacePanel(wsId: string): void {
  const view = panels.get(wsId)
  if (view && !view.webContents.isDestroyed()) view.webContents.focus()
}

/** Remove/adiciona os painéis ao contentView (para overlays globais do host). */
export function setPanelsHidden(hidden: boolean): void {
  if (!host || host.isDestroyed()) return
  if (hidden) {
    for (const [id, view] of panels) {
      lastBounds.set(id, view.getBounds())
      host.contentView.removeChildView(view)
    }
  } else {
    for (const [id, view] of panels) {
      if (!lastBounds.has(id)) continue
      host.contentView.addChildView(view)
      view.setBounds(lastBounds.get(id)!)
    }
  }
}

export function getPanelWebContents(): WebContentsView['webContents'][] {
  return [...panels.values()].map((v) => v.webContents)
}
