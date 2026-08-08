import { ipcMain, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { Agent } from '../core/agent.js'
import { createSnapshot, restoreSnapshot } from '../services/snapshot.js'
import { clearTrackedFiles } from '../services/file-tracker.js'
import { sessionManager } from '../services/session-manager.js'
import { fileWatcher } from '../services/file-watcher.js'
import { resolvePlanApproval } from '../tools/plan.js'
import { resolveQuestions } from '../tools/questions.js'
import { ShellTool } from '../tools/shell.js'
import { net } from 'electron'

// Map of in-flight snapshot promises keyed by messageId
const pendingSnapshots = new Map<number, Promise<void>>()

// Use Electron's net.fetch (avoids Node.js TLS issues)
const efetch: typeof fetch = (input: any, init?: any) => net.fetch(input, init) as any

export function registerAgentHandlers(
  agents: Map<string, Agent>,
  broadcastAgentUpdate: (data: object) => void
) {
  function getAgent(id: string): Agent | null {
    return agents.get(id) ?? null
  }

  ipcMain.handle('agent:init', async (_event, workspaceId: string) => {
    try {
      let agent = agents.get(workspaceId)
      if (!agent) {
        agent = new Agent()
        await agent.initialize()
        agents.set(workspaceId, agent)

        agent.setProgressEmitter((event, toolName, data) => {
          broadcastAgentUpdate({ workspaceId, type: 'tool_progress', event, toolName, ...data })
        })

        const cwd = agent.getInfo().cwd
        if (cwd) fileWatcher.watch(cwd)
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

    const convLength = agent.getConversationLength()
    const cwd = agent.getInfo().cwd || process.cwd()
    const snapshotPromise = createSnapshot(cwd, messageId, convLength)
    pendingSnapshots.set(messageId, snapshotPromise)
    snapshotPromise.finally(() => pendingSnapshots.delete(messageId))

    try {
      await agent.processMessage(
        message,
        (text) => broadcastAgentUpdate({ workspaceId, type: 'text', content: text }),
        (name, args) => broadcastAgentUpdate({ workspaceId, type: 'tool_start', name, args }),
        (name, chunk) => broadcastAgentUpdate({ workspaceId, type: 'tool_progress', event: 'writing', toolName: name, content: chunk }),
        (name, result, success, args) => broadcastAgentUpdate({ workspaceId, type: 'tool_end', name, result, success, args }),
        (error) => broadcastAgentUpdate({ workspaceId, type: 'error', message: error }),
        images as any,
        snapshotPromise
      )
      broadcastAgentUpdate({ workspaceId, type: 'done' })
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
    if (info.cwd) await sessionManager.clearSession(info.cwd)
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
      agent.setCwd(targetPath)
      await agent.resetConversation()
      await agent.initialize()
      agent.setProgressEmitter((event, toolName, data) => {
        broadcastAgentUpdate({ workspaceId, type: 'tool_progress', event, toolName, ...data })
      })
      fileWatcher.watch(targetPath)
      return { success: true, info: agent.getInfo() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('agent:get_session', async (_event, projectPath: string) => {
    return sessionManager.getSession(projectPath)
  })

  ipcMain.handle('agent:save_session', async (_event, workspaceId: string, projectPath: string, data: any) => {
    const agent = agents.get(workspaceId)
    const { rendererMessages, backendMessages, pinnedFiles } = data

    let historyToSave = backendMessages
    if (agent && !historyToSave) {
      historyToSave = agent.getHistory()
    } else if (agent && historyToSave) {
      agent.setHistory(historyToSave)
    }

    return sessionManager.saveSession(projectPath, {
      messages: rendererMessages,
      backendHistory: historyToSave,
      pinnedFiles,
      timestamp: Date.now(),
      projectPath,
    } as any)
  })

  ipcMain.handle('agent:list_sessions', async (_event, projectPath: string) => {
    return sessionManager.listSessions(projectPath)
  })

  ipcMain.handle('agent:get_session_by_id', async (_event, sessionId: string) => {
    return sessionManager.getSessionById(sessionId)
  })

  ipcMain.handle('agent:delete_session', async (_event, sessionId: string) => {
    return sessionManager.deleteSession(sessionId)
  })

  ipcMain.handle('agent:apikey', async (_event, workspaceId: string, key: string) => {
    const agent = agents.get(workspaceId)
    if (!agent) return { error: 'Agent not initialized' }
    await agent.setApiKey(key)
    return { success: true, info: agent.getInfo() }
  })

  ipcMain.handle('agent:setup', async (_event, workspaceId: string, config: { provider?: string; model?: string; advisorModel?: string; apiKey?: string; kodaCloudBaseUrl?: string }) => {
    const agent = agents.get(workspaceId)
    if (!agent) return { error: 'Agent not initialized' }
    try {
      await agent.updateSettings(config)
      return { success: true, info: agent.getInfo() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('agent:open_file', async (_event, filePath: string, line?: number) => {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
      const vscodeUrl = `vscode://file/${fullPath}${line ? `:${line}` : ''}`
      shell.openExternal(vscodeUrl).catch(() => shell.openPath(fullPath))
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('agent:model', async (_event, workspaceId: string, model: string) => {
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

  ipcMain.handle('agent:getModels', async (_event, provider: string, apiKey: string) => {
    console.log(`[Main] getModels called with provider: ${provider}, apiKey length: ${apiKey?.length || 0}`)
    try {
      if (provider === 'opencode-zen') {
        const headers: Record<string, string> = {}
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
        const res = await efetch('https://opencode.ai/zen/v1/models', { headers })
        if (!res.ok) throw new Error('Failed to fetch models from OpenCode Zen')
        const data = await res.json()
        const models = Array.isArray(data?.data)
          ? data.data.map((m: any) => m.id)
          : Array.isArray(data) ? data.map((m: any) => m.id || m) : []
        return { success: true, models }
      }

      if (provider === 'openrouter') {
        const res = await efetch('https://openrouter.ai/api/v1/models')
        if (!res.ok) throw new Error('Failed to fetch models from OpenRouter')
        const data = await res.json()
        return { success: true, models: data.data.map((m: any) => m.id) }
      }

      if (provider === 'openai') {
        const res = await efetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) throw new Error('OpenAI: Invalid API key or API error')
        const data = await res.json()
        const models = data.data
          .map((m: any) => m.id)
          .filter((id: string) => id.includes('gpt') || id.includes('o1') || id.includes('o3'))
        return { success: true, models }
      }

      if (provider === 'anthropic') {
        const res = await efetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'models-api-2025-02-19',
          },
        })
        if (res.ok) {
          const data = await res.json()
          return { success: true, models: data.data.map((m: any) => m.id) }
        }
        return { success: true, models: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] }
      }

      if (provider === 'google') {
        const res = await efetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
        if (!res.ok) {
          const errorText = await res.text()
          console.error('[Main] Google API error response:', errorText)
          throw new Error(`Google: Invalid API key or API error (${res.status})`)
        }
        const data = await res.json()
        const models = data.models
          .map((m: any) => m.name.replace('models/', ''))
          .filter((id: string) => id.includes('gemini'))
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
          throw new Error(`Ollama: ${err.message}. Ensure Ollama is running — skip if you want to type manually.`)
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
        } catch {
          return { success: true, models: ['local-model'] }
        }
      }

      if (provider === 'groq') {
        const res = await efetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) throw new Error('Groq: Invalid API key or API error')
        const data = await res.json()
        return { success: true, models: data.data.map((m: any) => m.id) }
      }

      if (provider === 'deepseek') {
        const res = await efetch('https://api.deepseek.com/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) throw new Error('DeepSeek: Invalid API key or API error')
        const data = await res.json()
        return { success: true, models: data.data.map((m: any) => m.id) }
      }

      if (provider === 'mistral') {
        const res = await efetch('https://api.mistral.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) throw new Error('Mistral: Invalid API key or API error')
        const data = await res.json()
        return { success: true, models: data.data.map((m: any) => m.id) }
      }

      if (provider === 'together') {
        const res = await efetch('https://api.together.xyz/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) throw new Error('Together AI: Invalid API key or API error')
        const data = await res.json()
        return { success: true, models: data.map((m: any) => m.id) }
      }

      if (provider === 'xai') {
        const res = await efetch('https://api.x.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) throw new Error('xAI: Invalid API key or API error')
        const data = await res.json()
        return { success: true, models: data.models.map((m: any) => m.id) }
      }

      if (provider === 'zhipu') {
        try {
          const res = await efetch('https://api.z.ai/api/paas/v4/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          })
          if (res.ok) {
            const data = await res.json()
            if (data.data?.length > 0) return { success: true, models: data.data.map((m: any) => m.id) }
          }
          return { success: true, models: ['glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.6', 'glm-4.5', 'glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4v-plus'] }
        } catch {
          return { success: true, models: ['glm-5', 'glm-4.7', 'glm-4-air'] }
        }
      }

      if (provider === 'maritaca') {
        try {
          const res = await efetch('https://chat.maritaca.ai/api/chat/models', {
            headers: { Authorization: `Key ${apiKey}` },
          })
          if (res.ok) {
            const data = await res.json()
            if (data.models?.length > 0) return { success: true, models: data.models.map((m: any) => m.name) }
          }
          return { success: true, models: ['sabia-4', 'sabia-3', 'sabiazinho-4', 'sabiazinho-s8'] }
        } catch {
          return { success: true, models: ['sabia-4', 'sabia-3', 'sabiazinho-4'] }
        }
      }

      if (provider === 'koda-cloud') {
        try {
          const baseUrl = apiKey || '' // apiKey slot carries baseUrl for koda-cloud
          if (!baseUrl) return { success: true, models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] }
          const res = await efetch(`${baseUrl}/v1/models`)
          if (res.ok) {
            const data = await res.json()
            return { success: true, models: data.models || data.data.map((m: any) => m.id) }
          }
          return { success: true, models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] }
        } catch {
          return { success: true, models: ['gemini-1.5-flash', 'gemini-1.5-pro'] }
        }
      }

      if (provider === 'fireworks') {
        const res = await efetch('https://api.fireworks.ai/inference/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
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
}
