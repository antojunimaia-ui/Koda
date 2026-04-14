import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Agent } from './core/agent.js'
import { resolvePlanApproval } from './tools/plan.js'
import { sendCtrlC, killPty, ShellTool, startInteractiveTerminal, writeToPty, resizePty } from './tools/shell.js'
import { createSnapshot, restoreSnapshot } from './services/snapshot.js'
import { clearTrackedFiles } from './services/file-tracker.js'
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
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // __dirname is dist-electron/ when compiled, so we go up and into dist/
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Intercept link navigation to open in external browser
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const rootUrl = process.env.VITE_DEV_SERVER_URL || 'file://'
    if (!url.startsWith(rootUrl)) {
      event.preventDefault()
      import('electron').then(({ shell }) => {
        shell.openExternal(url)
      })
    }
  })

  // Intercept window.open calls (target="_blank")
  mainWindow.webContents.setWindowOpenHandler((details) => {
    import('electron').then(({ shell }) => {
      shell.openExternal(details.url)
    })
    return { action: 'deny' }
  })
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
ipcMain.handle('window:open_directory', async () => {
  if (!mainWindow) return null
  const { dialog } = await import('electron')
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

// IPC Handlers for the Agent
ipcMain.handle('agent:init', async () => {
  try {
    // Only create a new agent if one doesn't exist
    // This prevents conversation resets on UI re-renders or minor setup changes
    if (!agent) {
      agent = new Agent()
      await agent.initialize()
    }
    return { success: true, info: agent.getInfo() }
  } catch (error) {
    console.error('[Agent] Initialization failed:', error)
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('agent:message', async (event, messageId: number, message: string, images?: any[]) => {
  if (!agent) return { error: 'Agent not initialized' }

  // Snapshot the workspace BEFORE the agent touches anything
  const convLength = agent.getConversationLength()
  await createSnapshot(messageId, convLength)

  try {
    await agent.processMessage(
      message,
      (text) => mainWindow?.webContents.send('agent:update', { type: 'text', content: text }),
      (name, args) => mainWindow?.webContents.send('agent:update', { type: 'tool_start', name, args }),
      (name, result, success, args) => mainWindow?.webContents.send('agent:update', { type: 'tool_end', name, result, success, args }),
      (error) => mainWindow?.webContents.send('agent:update', { type: 'error', message: error }),
      images as any
    )
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('snapshot:restore', async (_event, messageId: number) => {
  if (!agent) return { success: false, error: 'Agent not initialized' }
  try {
    const result = await restoreSnapshot(messageId)
    if (!result) return { success: false, error: 'No snapshot found for this message.' }
    agent.rollbackConversation(result.conversationLength)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('agent:reset', async () => {
  if (!agent) return { error: 'Agent not initialized' }
  agent.resetConversation()
  clearTrackedFiles()
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

ipcMain.handle('agent:setup', async (event, config: { provider?: string, model?: string, advisorModel?: string, apiKey?: string }) => {
  if (!agent) return { error: 'Agent not initialized' }
  try {
    await agent.updateSettings(config)
    return { success: true, info: agent.getInfo() }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('agent:open_file', async (event, filePath: string, line?: number) => {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    // VS Code protocol: vscode://file/{fullPath}:{line}
    // This is the most common way for developers. 
    // If it fails or VS Code isn't there, we fallback to shell.openPath
    const vscodeUrl = `vscode://file/${fullPath}${line ? `:${line}` : ''}`;
    
    // We try to open via VS Code protocol first for line support
    shell.openExternal(vscodeUrl).catch(() => {
      shell.openPath(fullPath);
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
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

ipcMain.handle('agent:shell_response', async (_event, approved: boolean, alwaysAllowBase: boolean, alwaysAllowFull: boolean) => {
  ShellTool.resolveApproval(approved, alwaysAllowBase, alwaysAllowFull)
  return { success: true }
})

ipcMain.handle('agent:get_approved_commands', async () => {
  return ShellTool.getApprovedCommands()
})

ipcMain.handle('agent:update_approved_commands', async (_event, lists) => {
  ShellTool.updateApprovedCommands(lists)
  return { success: true }
})

ipcMain.handle('agent:getModels', async (event, provider: string, apiKey: string) => {
  try {
    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models')
      if (!res.ok) throw new Error('Failed to fetch models from OpenRouter')
      const data = await res.json()
      return { success: true, models: data.data.map((m: any) => m.id) }
    }
    
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('OpenAI: Invalid API key or API error')
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
          'anthropic-beta': 'models-api-2025-02-19'
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
      if (!res.ok) throw new Error('Google: Invalid API key or API error')
      const data = await res.json()
      const models = data.models.map((m: any) => m.name.replace('models/', '')).filter((id: string) => id.includes('gemini'))
      return { success: true, models }
    }

    if (provider === 'ollama') {
      try {
        const res = await fetch('http://localhost:11434/v1/models')
        if (res.ok) {
          const data = await res.json()
          return { success: true, models: data.data.map((m: any) => m.id) }
        }
        // Fallback to legacy API if v1/models is missing
        const legacyRes = await fetch('http://localhost:11434/api/tags')
        if (legacyRes.ok) {
          const data = await legacyRes.json()
          return { success: true, models: data.models.map((m: any) => m.name) }
        }
        throw new Error('Ollama: Service not responding at 11434')
      } catch (err: any) {
        throw new Error(`Ollama: ${err.message}. Ensure Ollama is running skip if you want to type manually.`)
      }
    }

    if (provider === 'llamacpp') {
      try {
        const res = await fetch('http://localhost:8080/v1/models')
        if (res.ok) {
          const data = await res.json()
          return { success: true, models: data.data.map((m: any) => m.id) }
        }
        return { success: true, models: ['local-model'] }
      } catch (err) {
        return { success: true, models: ['local-model'] }
      }
    }

    if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('Groq: Invalid API key or API error')
      const data = await res.json()
      return { success: true, models: data.data.map((m: any) => m.id) }
    }

    if (provider === 'deepseek') {
      const res = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('DeepSeek: Invalid API key or API error')
      const data = await res.json()
      return { success: true, models: data.data.map((m: any) => m.id) }
    }

    if (provider === 'mistral') {
      const res = await fetch('https://api.mistral.ai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('Mistral: Invalid API key or API error')
      const data = await res.json()
      return { success: true, models: data.data.map((m: any) => m.id) }
    }

    if (provider === 'together') {
      const res = await fetch('https://api.together.xyz/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('Together AI: Invalid API key or API error')
      const data = await res.json()
      return { success: true, models: data.map((m: any) => m.id) }
    }

    if (provider === 'xai') {
      const res = await fetch('https://api.x.ai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('xAI: Invalid API key or API error')
      const data = await res.json()
      return { success: true, models: data.models.map((m: any) => m.id) }
    }

    if (provider === 'zhipu') {
      try {
        const res = await fetch('https://api.z.ai/api/paas/v4/models', {
          headers: { Authorization: `Bearer ${apiKey}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.data && data.data.length > 0) {
            return { success: true, models: data.data.map((m: any) => m.id) }
          }
        }
        // Robust fallback list for Z.AI (Zhipu) models
        const zhipuModels = [
          'glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.6', 'glm-4.5',
          'glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4v-plus'
        ]
        return { success: true, models: zhipuModels }
      } catch (err) {
        return { success: true, models: ['glm-5', 'glm-4.7', 'glm-4-air'] }
      }
    }

    if (provider === 'maritaca') {
      try {
        const res = await fetch('https://chat.maritaca.ai/api/chat/models', {
          headers: { Authorization: `Key ${apiKey}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.models && data.models.length > 0) {
            return { success: true, models: data.models.map((m: any) => m.name) }
          }
        }
        // Robust fallback for Maritaca models
        return { success: true, models: ['sabia-4', 'sabia-3', 'sabiazinho-4', 'sabiazinho-s8'] }
      } catch (err) {
        return { success: true, models: ['sabia-4', 'sabia-3', 'sabiazinho-4'] }
      }
    }

    return { success: false, error: 'Unknown provider' }
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

ipcMain.handle('pty:start', async (_event, cwd?: string) => {
  const finalCwd = cwd || agent?.getInfo().cwd || process.cwd()
  const pid = startInteractiveTerminal(finalCwd)
  return { success: true, pid }
})

ipcMain.handle('pty:write', async (_event, pid: number, data: string) => {
  const ok = writeToPty(pid, data)
  return { success: ok }
})

ipcMain.handle('pty:resize', async (_event, pid: number, cols: number, rows: number) => {
  const ok = resizePty(pid, cols, rows)
  return { success: ok }
})

ipcMain.handle('project:get_files', async () => {
  try {
    const { globby } = await import('globby')
    const files = await globby(['**/*'], {
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'dist-electron/**', 'release-build/**', 'package-lock.json', 'yarn.lock'],
      dot: true,
      onlyFiles: true
    })
    return { success: true, files }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// MCP Configuration Store
let mcpConfigs: any[] = []
let mcpLoaded = false

ipcMain.handle('mcp:get_configs', async () => {
  if (!mcpLoaded) {
    try {
      const fs = await import('fs/promises')
      const configPath = path.join(app.getPath('userData'), 'mcp-configs.json')
      const data = await fs.readFile(configPath, 'utf-8')
      mcpConfigs = JSON.parse(data)
    } catch {
      mcpConfigs = []
    }
    mcpLoaded = true
  }
  return mcpConfigs
})

ipcMain.handle('mcp:save_configs', async (_event, configs) => {
  mcpConfigs = configs
  try {
    const fs = await import('fs/promises')
    const configPath = path.join(app.getPath('userData'), 'mcp-configs.json')
    await fs.writeFile(configPath, JSON.stringify(mcpConfigs, null, 2))
    
    // Reload mcp tools in existing agent if active
    if (agent) {
       await agent.reloadMcpTools();
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})
