import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Agent } from './core/agent.js'
import { resolvePlanApproval } from './tools/plan.js'
import { resolveQuestions } from './tools/questions.js'
import { sendCtrlC, killPty, ShellTool, startInteractiveTerminal, writeToPty, resizePty } from './tools/shell.js'
import { createSnapshot, restoreSnapshot } from './services/snapshot.js'
import { clearTrackedFiles } from './services/file-tracker.js'
import { sessionManager } from './services/session-manager.js'
import { startWebhookServer, stopWebhookServer, getWebhookStatus } from './services/webhook-server.js'
import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables
dotenv.config()

let mainWindow: BrowserWindow | null = null
const agents = new Map<string, Agent>()

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
  agent.resetConversation()
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
  agent.resetConversation()
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
    agent.resetConversation()
    await agent.initialize()
    agent.setProgressEmitter((event, toolName, data) => {
      mainWindow?.webContents.send('agent:update', { workspaceId, type: 'tool_progress', event, toolName, ...data })
    })
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

    if (provider === 'koda-cloud') {
      try {
        const res = await fetch('http://cn-01.hostzera.com.br:2137/v1/models')
        if (res.ok) {
          const data = await res.json()
          return { success: true, models: data.models || data.data.map((m: any) => m.id) }
        }
        // Fallback while proxy is being updated
        return { success: true, models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] }
      } catch (err) {
        return { success: true, models: ['gemini-1.5-flash', 'gemini-1.5-pro'] }
      }
    }

    if (provider === 'fireworks') {
      const res = await fetch('https://api.fireworks.ai/inference/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) throw new Error('Fireworks AI: Invalid API key or API error')
      const data = await res.json()
      // Filter for chat-capable models if possible, or just return all
      return { success: true, models: data.data.map((m: any) => m.id) }
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
    const res = await fetch(MARKETPLACE_INDEX_URL)
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
    const mdRes = await fetch(`${MARKETPLACE_RAW_BASE}/${skillName}/skill.md`)
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

// Webhook / Remote Control
ipcMain.handle('webhook:start', async (_event, config: { port: number; token: string }) => {
  try {
    const getAgentWithId = () => {
      const entry = agents.entries().next().value
      if (!entry) return null
      return { agent: entry[1], workspaceId: entry[0] }
    }
    await startWebhookServer({ ...config, enabled: true }, getAgentWithId, mainWindow)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('webhook:stop', async () => {
  await stopWebhookServer()
  return { success: true }
})

ipcMain.handle('webhook:status', () => {
  return getWebhookStatus()
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
