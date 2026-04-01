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
    // __dirname is dist-electron/ when compiled, so we go up and into dist/
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
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

ipcMain.handle('agent:getModels', async (event, provider: string, apiKey: string) => {
  try {
    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models')
      if (!res.ok) throw new Error('Falha ao buscar modelos do OpenRouter')
      const data = await res.json()
      return { success: true, models: data.data.map((m: any) => m.id) }
    }
    
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('OpenAI: Chave inválida ou erro na API')
      const data = await res.json()
      // Filter out non-chat models
      const models = data.data.map((m: any) => m.id).filter((id: string) => id.includes('gpt') || id.includes('o1') || id.includes('o3'))
      return { success: true, models }
    }

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'models-api-2025-02-19' // Anthropic new models API requires specific headers? Actually lets just hardcode Anthropic top models if fetch fails
        }
      })
      if (res.ok) {
        const data = await res.json()
        return { success: true, models: data.data.map((m: any) => m.id) }
      } else {
        // Fallback for Anthropic if API key lacks permissions or format changes
        return { success: true, models: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] }
      }
    }

    if (provider === 'google') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
      if (!res.ok) throw new Error('Google: Chave inválida ou erro na API')
      const data = await res.json()
      const models = data.models.map((m: any) => m.name.replace('models/', '')).filter((id: string) => id.includes('gemini'))
      return { success: true, models }
    }

    return { success: false, error: 'Provider desconhecido' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('pty:ctrl_c', async (_event, pid: number) => {
  const ok = sendCtrlC(pid)
  return { success: ok, error: ok ? undefined : `No active PTY with PID ${pid}` }
})

ipcMain.handle('pty:kill', async (_event, pid: number) => {
  const ok = killPty(pid)
  return { success: ok, error: ok ? undefined : `No active PTY with PID ${pid}` }
})
