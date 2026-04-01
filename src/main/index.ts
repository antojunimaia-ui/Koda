import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Agent } from './core/agent.js'
import { resolvePlanApproval } from './tools/plan.js'
import { sendCtrlC, killPty } from './tools/shell.js'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables
dotenv.config()

let mainWindow: BrowserWindow | null = null
let agent: Agent | null = null

function createWindow() {
  // Determine the path to the preload script
  // In dev: dist-electron/preload/index.mjs
  // In prod: (depends on packaging)
  // Correct path relative to dist-electron/index.js
  const preloadPath = path.join(__dirname, 'preload/index.mjs')
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#74b1be',
      height: 32
    },
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Window control handlers
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

// IPC Handlers for the Agent
ipcMain.handle('agent:init', async () => {
  try {
    agent = new Agent()
    // Initialize in background — don't block the UI
    agent.initialize().catch((err) => {
      console.error('[Agent] Background initialization failed:', err)
    })
    return { success: true, info: agent.getInfo() }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('agent:message', async (event, message: string) => {
  if (!agent) return { error: 'Agent not initialized' }

  try {
    await agent.processMessage(
      message,
      (text) => mainWindow?.webContents.send('agent:update', { type: 'text', content: text }),
      (name) => mainWindow?.webContents.send('agent:update', { type: 'tool_start', name }),
      (name, result, success) => mainWindow?.webContents.send('agent:update', { type: 'tool_end', name, result, success }),
      (error) => mainWindow?.webContents.send('agent:update', { type: 'error', message: error })
    )
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('agent:reset', async () => {
  if (!agent) return { error: 'Agent not initialized' }
  agent.resetConversation()
  return { success: true }
})

ipcMain.handle('agent:tokens', async () => {
  if (!agent) return { error: 'Agent not initialized' }
  return agent.getTokenEstimate()
})

ipcMain.handle('agent:info', async () => {
  if (!agent) return { error: 'Agent not initialized' }
  return agent.getInfo()
})

ipcMain.handle('agent:cd', async (event, targetPath: string) => {
  if (!agent) return { error: 'Agent not initialized' }
  try {
    process.chdir(targetPath)
    agent.resetConversation()
    await agent.initialize()
    return { success: true, info: agent.getInfo() }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('agent:apikey', async (event, key: string) => {
  if (!agent) return { error: 'Agent not initialized' }
  await agent.setApiKey(key)
  return { success: true, info: agent.getInfo() }
})

ipcMain.handle('agent:setup', async (event, config: { provider?: string, model?: string, apiKey?: string }) => {
  if (!agent) return { error: 'Agent not initialized' }
  try {
    await agent.updateSettings(config)
    return { success: true, info: agent.getInfo() }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('agent:model', async (event, model: string) => {
  if (!agent) return { error: 'Agent not initialized' }
  await agent.setModel(model)
  return { success: true, info: agent.getInfo() }
})

ipcMain.handle('agent:plan_response', async (_event, approved: boolean) => {
  resolvePlanApproval(approved)
  return { success: true }
})

ipcMain.handle('pty:ctrl_c', async (_event, pid: number) => {
  const ok = sendCtrlC(pid)
  return { success: ok, error: ok ? undefined : `No active PTY with PID ${pid}` }
})

ipcMain.handle('pty:kill', async (_event, pid: number) => {
  const ok = killPty(pid)
  return { success: ok, error: ok ? undefined : `No active PTY with PID ${pid}` }
})
