import { app, BrowserWindow, ipcMain, shell, net } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Agent } from './core/agent.js'
import { resolvePlanApproval } from './tools/plan.js'
import { resolveQuestions } from './tools/questions.js'
import { sendCtrlC, killPty, ShellTool, startInteractiveTerminal, writeToPty, resizePty } from './tools/shell.js'
import { createSnapshot, restoreSnapshot } from './services/snapshot.js'
import { clearTrackedFiles } from './services/file-tracker.js'
import { sessionManager } from './services/session-manager.js'
import { DiscordRPCManager } from './services/discord-rpc.js'
import { fileWatcher } from './services/file-watcher.js'
import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Suppress deprecation warnings
process.removeAllListeners('warning')
process.on('warning', (warning) => {
  // Ignore punycode deprecation warning
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return
  }
  console.warn(warning.name, warning.message)
})

// Disable GPU hardware acceleration warnings on AMD
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')

// Load environment variables
dotenv.config()

let mainWindow: BrowserWindow | null = null
const agents = new Map<string, Agent>()
const discordRPC = new DiscordRPCManager()

// Use Electron's net.fetch which uses Chromium's network stack (avoids Node.js TLS issues)
const efetch: typeof fetch = (input: any, init?: any) => net.fetch(input, init) as any

function getAgent(id: string): Agent | null {
  return agents.get(id) || null
}

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
      webSecurity: false, // Permitir carregamento de arquivos locais (Vídeos, etc)
      enableWebSQL: false,
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
  
  // Set main window for file watcher
  if (mainWindow) {
    fileWatcher.setMainWindow(mainWindow)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Auto-updater — only runs in packaged app, not in dev
  if (!process.env.VITE_DEV_SERVER_URL) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false

    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('updater:update-available', { version: info.version })
    })

    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('updater:update-downloaded')
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

ipcMain.handle('window:open_external', async (_event, url: string) => {
  try {
    await shell.openExternal(url)
    return { success: true }
  } catch (error) {
    console.error('[Main] Error opening external URL:', error)
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall()
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
ipcMain.handle('agent:init', async (_event, workspaceId: string) => {
  try {
    let agent = agents.get(workspaceId)
    if (!agent) {
      agent = new Agent()
      await agent.initialize()
      agents.set(workspaceId, agent)
      
      // Wire up real-time tool progress events to the renderer
      agent.setProgressEmitter((event, toolName, data) => {
        mainWindow?.webContents.send('agent:update', { workspaceId, type: 'tool_progress', event, toolName, ...data })
      })
      
      // Start watching the current directory
      const cwd = agent.getInfo().cwd
      if (cwd) {
        fileWatcher.watch(cwd)
      }
    }
    return { success: true, info: agent.getInfo() }
  } catch (error) {
    console.error(`[Agent:${workspaceId}] Initialization failed:`, error)
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('agent:message', async (_event, workspaceId: string, messageId: number, message: string, images?: any[]) => {
  const agent = agents.get(workspaceId)
  if (!agent) return { error: 'Agent not initialized' }

  // Snapshot the workspace BEFORE the agent touches anything
  const convLength = agent.getConversationLength()
  await createSnapshot(messageId, convLength)

  try {
    await agent.processMessage(
      message,
      (text) => mainWindow?.webContents.send('agent:update', { workspaceId, type: 'text', content: text }),
      (name, args) => mainWindow?.webContents.send('agent:update', { workspaceId, type: 'tool_start', name, args }),
      (name, chunk) => mainWindow?.webContents.send('agent:update', { workspaceId, type: 'tool_progress', event: 'writing', toolName: name, content: chunk }),
      (name, result, success, args) => mainWindow?.webContents.send('agent:update', { workspaceId, type: 'tool_end', name, result, success, args }),
      (error) => mainWindow?.webContents.send('agent:update', { workspaceId, type: 'error', message: error }),
      images as any
    )
    mainWindow?.webContents.send('agent:update', { workspaceId, type: 'done' })
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('snapshot:restore', async (_event, workspaceId: string, messageId: number) => {
  const agent = agents.get(workspaceId)
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

ipcMain.handle('agent:reset', async (_event, workspaceId: string) => {
  const agent = agents.get(workspaceId)
  if (!agent) return { error: 'Agent not initialized' }
  const info = agent.getInfo()
  await agent.resetConversation()
  clearTrackedFiles()
  if (info.cwd) {
    await sessionManager.clearSession(info.cwd);
  }
  return { success: true }
})

ipcMain.handle('agent:soft_reset', async (_event, workspaceId: string) => {
  const agent = agents.get(workspaceId)
  if (!agent) return { error: 'Agent not initialized' }
  agent.abort()
  await agent.resetConversation()
  clearTrackedFiles()
  return { success: true }
})

ipcMain.handle('agent:tokens', async (_event, workspaceId: string) => {
  const agent = agents.get(workspaceId)
  if (!agent) return { error: 'Agent not initialized' }
  return agent.getTokenEstimate()
})

ipcMain.handle('agent:info', async (_event, workspaceId: string) => {
  const agent = agents.get(workspaceId)
  if (!agent) return { error: 'Agent not initialized' }
  return agent.getInfo()
})

ipcMain.handle('agent:cd', async (_event, workspaceId: string, targetPath: string) => {
  const agent = agents.get(workspaceId)
  if (!agent) return { error: 'Agent not initialized' }
  try {
    process.chdir(targetPath)
    await agent.resetConversation()
    await agent.initialize()
    agent.setProgressEmitter((event, toolName, data) => {
      mainWindow?.webContents.send('agent:update', { workspaceId, type: 'tool_progress', event, toolName, ...data })
    })
    
    // Start watching the new directory
    fileWatcher.watch(targetPath)
    
    return { success: true, info: agent.getInfo() }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('agent:get_session', async (event, projectPath: string) => {
  return sessionManager.getSession(projectPath);
})

ipcMain.handle('agent:save_session', async (event, workspaceId: string, projectPath: string, data: any) => {
  const agent = agents.get(workspaceId)
  const { rendererMessages, backendMessages, pinnedFiles } = data;
  
  // Se backendMessages for null, pegamos o histórico atual do agente
  let historyToSave = backendMessages;
  if (agent && !historyToSave) {
    historyToSave = agent.getHistory();
  } else if (agent && historyToSave) {
    agent.setHistory(historyToSave);
  }

  return sessionManager.saveSession(projectPath, { 
    messages: rendererMessages, 
    backendHistory: historyToSave,
    pinnedFiles,
    timestamp: Date.now(),
    projectPath
  } as any);
})

ipcMain.handle('agent:list_sessions', async (event, projectPath: string) => {
  return sessionManager.listSessions(projectPath);
})

ipcMain.handle('agent:get_session_by_id', async (event, sessionId: string) => {
  return sessionManager.getSessionById(sessionId);
})

ipcMain.handle('agent:delete_session', async (event, sessionId: string) => {
  return sessionManager.deleteSession(sessionId);
})

ipcMain.handle('agent:apikey', async (event, workspaceId: string, key: string) => {
  const agent = agents.get(workspaceId)
  if (!agent) return { error: 'Agent not initialized' }
  await agent.setApiKey(key)
  return { success: true, info: agent.getInfo() }
})

ipcMain.handle('agent:setup', async (event, workspaceId: string, config: { provider?: string, model?: string, advisorModel?: string, apiKey?: string }) => {
  const agent = agents.get(workspaceId)
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
    const vscodeUrl = `vscode://file/${fullPath}${line ? `:${line}` : ''}`;
    shell.openExternal(vscodeUrl).catch(() => {
      shell.openPath(fullPath);
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
})

ipcMain.handle('agent:model', async (event, workspaceId: string, model: string) => {
  const agent = agents.get(workspaceId)
  if (!agent) return { error: 'Agent not initialized' }
  await agent.setModel(model)
  return { success: true, info: agent.getInfo() }
})

ipcMain.handle('agent:plan_response', async (_event, approved: boolean) => {
  resolvePlanApproval(approved)
  return { success: true }
})

ipcMain.handle('agent:questions_response', async (_event, answers: any[]) => {
  resolveQuestions(answers)
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
  console.log(`[Main] getModels called with provider: ${provider}, apiKey length: ${apiKey?.length || 0}`)
  try {
    if (provider === 'openrouter') {
      const res = await efetch('https://openrouter.ai/api/v1/models')
      if (!res.ok) throw new Error('Failed to fetch models from OpenRouter')
      const data = await res.json()
      return { success: true, models: data.data.map((m: any) => m.id) }
    }
    
    if (provider === 'openai') {
      const res = await efetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('OpenAI: Invalid API key or API error')
      const data = await res.json()
      const models = data.data.map((m: any) => m.id).filter((id: string) => id.includes('gpt') || id.includes('o1') || id.includes('o3'))
      return { success: true, models }
    }

    if (provider === 'anthropic') {
      const res = await efetch('https://api.anthropic.com/v1/models', {
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
        return { success: true, models: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] }
      }
    }

    if (provider === 'google') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      const res = await efetch(url)
      if (!res.ok) {
        const errorText = await res.text()
        console.error('[Main] Google API error response:', errorText)
        throw new Error(`Google: Invalid API key or API error (${res.status})`)
      }
      const data = await res.json()
      const models = data.models.map((m: any) => m.name.replace('models/', '')).filter((id: string) => id.includes('gemini'))
      return { success: true, models }
    }

    if (provider === 'ollama') {
      try {
        const res = await efetch('http://localhost:11434/v1/models')
        if (res.ok) {
          const data = await res.json()
          return { success: true, models: data.data.map((m: any) => m.id) }
        }
        const legacyRes = await efetch('http://localhost:11434/api/tags')
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
        const res = await efetch('http://localhost:8080/v1/models')
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
      const res = await efetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('Groq: Invalid API key or API error')
      const data = await res.json()
      return { success: true, models: data.data.map((m: any) => m.id) }
    }

    if (provider === 'deepseek') {
      const res = await efetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('DeepSeek: Invalid API key or API error')
      const data = await res.json()
      return { success: true, models: data.data.map((m: any) => m.id) }
    }

    if (provider === 'mistral') {
      const res = await efetch('https://api.mistral.ai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('Mistral: Invalid API key or API error')
      const data = await res.json()
      return { success: true, models: data.data.map((m: any) => m.id) }
    }

    if (provider === 'together') {
      const res = await efetch('https://api.together.xyz/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('Together AI: Invalid API key or API error')
      const data = await res.json()
      return { success: true, models: data.map((m: any) => m.id) }
    }

    if (provider === 'xai') {
      const res = await efetch('https://api.x.ai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('xAI: Invalid API key or API error')
      const data = await res.json()
      return { success: true, models: data.models.map((m: any) => m.id) }
    }

    if (provider === 'zhipu') {
      try {
        const res = await efetch('https://api.z.ai/api/paas/v4/models', {
          headers: { Authorization: `Bearer ${apiKey}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.data && data.data.length > 0) {
            return { success: true, models: data.data.map((m: any) => m.id) }
          }
        }
        return { success: true, models: ['glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.6', 'glm-4.5', 'glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4v-plus'] }
      } catch (err) {
        return { success: true, models: ['glm-5', 'glm-4.7', 'glm-4-air'] }
      }
    }

    if (provider === 'maritaca') {
      try {
        const res = await efetch('https://chat.maritaca.ai/api/chat/models', {
          headers: { Authorization: `Key ${apiKey}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.models && data.models.length > 0) {
            return { success: true, models: data.models.map((m: any) => m.name) }
          }
        }
        return { success: true, models: ['sabia-4', 'sabia-3', 'sabiazinho-4', 'sabiazinho-s8'] }
      } catch (err) {
        return { success: true, models: ['sabia-4', 'sabia-3', 'sabiazinho-4'] }
      }
    }

    if (provider === 'koda-cloud') {
      try {
        const res = await efetch('http://cn-01.hostzera.com.br:2137/v1/models')
        if (res.ok) {
          const data = await res.json()
          return { success: true, models: data.models || data.data.map((m: any) => m.id) }
        }
        return { success: true, models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] }
      } catch (err) {
        return { success: true, models: ['gemini-1.5-flash', 'gemini-1.5-pro'] }
      }
    }

    if (provider === 'fireworks') {
      const res = await efetch('https://api.fireworks.ai/inference/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('Fireworks AI: Invalid API key or API error')
      const data = await res.json()
      return { success: true, models: data.data.map((m: any) => m.id) }
    }

    return { success: false, error: 'Unknown provider' }
  } catch (err: any) {
    console.error(`[Main] Error in getModels for provider ${provider}:`, err)
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

ipcMain.handle('pty:start', async (_event, workspaceId?: string, cwd?: string) => {
  let finalCwd = cwd
  if (!finalCwd && workspaceId) {
    const agent = getAgent(workspaceId)
    finalCwd = agent?.getInfo().cwd
  }
  if (!finalCwd) finalCwd = process.cwd()
  
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

ipcMain.handle('project:read_file', async (_, filePath: string) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // Security: ensure the file is within the current working directory
    const resolvedPath = path.resolve(filePath)
    const cwd = process.cwd()
    if (!resolvedPath.startsWith(cwd)) {
      throw new Error('Access denied: file outside project directory')
    }
    
    const content = await fs.readFile(resolvedPath, 'utf-8')
    return { success: true, content }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('project:write_file', async (_, filePath: string, content: string) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // Security: ensure the file is within the current working directory
    const resolvedPath = path.resolve(filePath)
    const cwd = process.cwd()
    if (!resolvedPath.startsWith(cwd)) {
      throw new Error('Access denied: file outside project directory')
    }
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true })
    
    await fs.writeFile(resolvedPath, content, 'utf-8')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('project:delete_file', async (_, filePath: string) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // Security: ensure the file is within the current working directory
    const resolvedPath = path.resolve(filePath)
    const cwd = process.cwd()
    if (!resolvedPath.startsWith(cwd)) {
      throw new Error('Access denied: file outside project directory')
    }
    
    // Check if it's a file or directory
    const stats = await fs.stat(resolvedPath)
    if (stats.isDirectory()) {
      await fs.rm(resolvedPath, { recursive: true, force: true })
    } else {
      await fs.unlink(resolvedPath)
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('project:rename_file', async (_, oldPath: string, newPath: string) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // Security: ensure both paths are within the current working directory
    const resolvedOldPath = path.resolve(oldPath)
    const resolvedNewPath = path.resolve(newPath)
    const cwd = process.cwd()
    
    if (!resolvedOldPath.startsWith(cwd) || !resolvedNewPath.startsWith(cwd)) {
      throw new Error('Access denied: file outside project directory')
    }
    
    // Ensure target directory exists
    await fs.mkdir(path.dirname(resolvedNewPath), { recursive: true })
    
    await fs.rename(resolvedOldPath, resolvedNewPath)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('project:create_folder', async (_, folderPath: string) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    // Security: ensure the folder is within the current working directory
    const resolvedPath = path.resolve(folderPath)
    const cwd = process.cwd()
    if (!resolvedPath.startsWith(cwd)) {
      throw new Error('Access denied: folder outside project directory')
    }
    
    await fs.mkdir(resolvedPath, { recursive: true })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Skills
ipcMain.handle('skills:list', async () => {
  try {
    const { skillManager } = await import('./services/skill-manager.js')
    const skills = await skillManager.getAll()
    return { success: true, skills: skills.map(s => ({ name: s.name, description: s.description, triggers: s.triggers, filePath: s.filePath })) }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Marketplace
const MARKETPLACE_INDEX_URL = 'https://raw.githubusercontent.com/antojunimaia-ui/koda-skills/main/index.json'
const MARKETPLACE_RAW_BASE  = 'https://raw.githubusercontent.com/antojunimaia-ui/koda-skills/main/skills'

ipcMain.handle('marketplace:fetch', async () => {
  try {
    const res = await efetch(MARKETPLACE_INDEX_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const skills = await res.json()
    return { success: true, skills }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('marketplace:install', async (_event, skillName: string, version?: string) => {
  try {
    const fs = await import('fs/promises')
    const os = await import('os')

    // Fetch skill.md
    const mdRes = await efetch(`${MARKETPLACE_RAW_BASE}/${skillName}/skill.md`)
    if (!mdRes.ok) throw new Error(`skill.md not found for "${skillName}"`)
    let mdContent = await mdRes.text()

    // Inject version into front-matter so we can detect updates later
    if (version) {
      if (mdContent.startsWith('---')) {
        // Insert version line after the opening ---
        mdContent = mdContent.replace(/^---\r?\n/, `---\nversion: ${version}\n`)
      }
    }

    // Write to ~/.koda/skills/
    const skillsDir = path.join(os.default.homedir(), '.koda', 'skills')
    await fs.mkdir(skillsDir, { recursive: true })
    await fs.writeFile(path.join(skillsDir, `${skillName}.md`), mdContent, 'utf-8')

    // Invalidate skill manager cache
    const { skillManager } = await import('./services/skill-manager.js')
    skillManager.invalidate()
    for (const a of agents.values()) {
      await a.reloadMcpTools()
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('marketplace:uninstall', async (_event, skillName: string) => {
  try {
    const fs = await import('fs/promises')
    const os = await import('os')

    const globalPath  = path.join(os.default.homedir(), '.koda', 'skills', `${skillName}.md`)
    const localPath   = path.join(process.cwd(), '.koda', 'skills', `${skillName}.md`)

    let removed = false
    for (const p of [globalPath, localPath]) {
      try { await fs.unlink(p); removed = true } catch { /* not there */ }
    }
    if (!removed) throw new Error(`Skill "${skillName}" not found on disk`)

    const { skillManager } = await import('./services/skill-manager.js')
    skillManager.invalidate()

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// KoClaw Discord Bot
ipcMain.handle('koclaw:start', async (_event, config: { token: string; channelId?: string }) => {
  try {
    const { startKoClawBot } = await import('./services/koclaw-bot.js')
    const getAgentWithId = () => {
      const entry = agents.entries().next().value
      if (!entry) return null
      return { agent: entry[1], workspaceId: entry[0] }
    }
    await startKoClawBot({ ...config, enabled: true }, getAgentWithId, mainWindow)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('koclaw:stop', async () => {
  const { stopKoClawBot } = await import('./services/koclaw-bot.js')
  await stopKoClawBot()
  return { success: true }
})

ipcMain.handle('koclaw:status', async () => {
  const { getKoClawStatus } = await import('./services/koclaw-bot.js')
  return getKoClawStatus()
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
    
    // Reload mcp tools in all existing agents
    for (const a of agents.values()) {
       await a.reloadMcpTools();
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Discord RPC Handlers
ipcMain.handle('discord:enable', async () => {
  try {
    await discordRPC.enable()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('discord:disable', () => {
  discordRPC.disable()
  return { success: true }
})

ipcMain.handle('discord:is_enabled', () => {
  return { enabled: discordRPC.isEnabled() }
})

ipcMain.handle('discord:update_activity', async (_event, activity) => {
  try {
    await discordRPC.updateActivity(activity)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('discord:clear_activity', async () => {
  try {
    await discordRPC.clearActivity()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

