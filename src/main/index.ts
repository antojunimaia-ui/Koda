import { app, BrowserWindow } from 'electron'
import os from 'node:os'
import { Agent } from './core/agent.js'
import { DiscordRPCManager } from './services/discord-rpc.js'
import { fileWatcher } from './services/file-watcher.js'
import { selfInstallOnLinux } from './services/linux-installer.js'
import { registerSchemesAsPrivileged, registerKodaAssetProtocol } from './protocols/koda-asset.js'
import { createWindow, createIDEWindow, getMainWindow, getAllWindows } from './windows.js'
import { handleDeepLink, flushPendingDeepLink } from './deeplink.js'
import { attachPanelsToWindow, getPanelWebContents } from './panels.js'
import { registerAllHandlers } from './ipc/index.js'
import electronUpdater from 'electron-updater'
import dotenv from 'dotenv'

// O app deliberadamente usa `webviewTag` com `webSecurity: false` para o painel
// de preview no navegador (BrowserPreview). Esses avisos são esperados em dev.
// Em builds empacotados o Electron não os exibe. Suprimimos para não poluir o
// console de desenvolvimento — a política de segurança real é definida nas
// webPreferences das janelas.
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

const { autoUpdater } = electronUpdater

// ── Bootstrap ────────────────────────────────────────────────────────────────

// Set working directory to user home so the agent doesn't start inside the app folder
process.chdir(os.homedir())

// On Linux AppImage: self-install on first run
selfInstallOnLinux()

// Suppress irrelevant deprecation warnings
process.removeAllListeners('warning')
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) return
  console.warn(warning.name, warning.message)
})

// GPU / cache flags (stability on AMD + avoid cache corruption)
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-gpu-process-crash-limit')
app.commandLine.appendSwitch('disable-features', 'UseSkiaRenderer,Vulkan')
app.commandLine.appendSwitch('disable-disk-cache')
app.commandLine.appendSwitch('disable-http-cache')
app.commandLine.appendSwitch('max-old-space-size', '4096')

dotenv.config()

// Must be called before app is ready
registerSchemesAsPrivileged()

// ── Protocolo koda:// (deep links) ────────────────────────────────────────────
// Single-instance lock: deep links chegam via argv (Windows/Linux) ou open-url
// (macOS), sempre na instância já aberta — nunca numa segunda cópia do app.
app.setAsDefaultProtocolClient('koda')

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith('koda://'))
    if (url) handleDeepLink(url)

    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })
}

// Cold start: o primeiro argv pode já conter uma URL koda://
const initialDeepLink = process.argv.find((arg) => arg.startsWith('koda://'))
if (initialDeepLink) handleDeepLink(initialDeepLink)

// ── Shared state ─────────────────────────────────────────────────────────────

const agents = new Map<string, Agent>()
const discordRPC = new DiscordRPCManager()

function broadcastAgentUpdate(data: object) {
  for (const win of getAllWindows()) {
    win?.webContents.send('agent:update', data)
  }
  // Painéis (WebContentsView) também precisam receber updates do agente.
  for (const wc of getPanelWebContents()) {
    wc.send('agent:update', data)
  }
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

registerAllHandlers(agents, discordRPC, getMainWindow, getAllWindows, broadcastAgentUpdate)

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return
  registerKodaAssetProtocol()

  createWindow((win) => fileWatcher.setMainWindow(win))
  attachPanelsToWindow(getMainWindow()!)
  flushPendingDeepLink()

  app.on('activate', () => {
    if (!gotSingleInstanceLock) return
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow((win) => fileWatcher.setMainWindow(win))
    }
  })

  // Auto-updater — only in packaged builds
  if (!process.env.VITE_DEV_SERVER_URL) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false

    autoUpdater.on('update-available', (info) => {
      getMainWindow()?.webContents.send('updater:update-available', { version: info.version })
    })

    autoUpdater.on('update-downloaded', () => {
      getMainWindow()?.webContents.send('updater:update-downloaded')
    })

    autoUpdater.on('error', (err) => {
      console.error('[AutoUpdater] Error:', err.message)
    })

    autoUpdater.checkForUpdates().catch(() => {})
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
