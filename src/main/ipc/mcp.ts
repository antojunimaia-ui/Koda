import { ipcMain, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Agent } from '../core/agent.js'
import { IPC_CHANNELS } from '../../shared/ipc.js'

let mcpConfigs: any[] = []
let mcpLoaded = false

export function registerMcpHandlers(agents: Map<string, Agent>) {
  ipcMain.handle(IPC_CHANNELS.mcp.getConfigs, async () => {
    if (!mcpLoaded) {
      try {
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

  ipcMain.handle(IPC_CHANNELS.mcp.saveConfigs, async (_event, configs) => {
    mcpConfigs = configs
    try {
      const configPath = path.join(app.getPath('userData'), 'mcp-configs.json')
      await fs.writeFile(configPath, JSON.stringify(mcpConfigs, null, 2))
      for (const a of agents.values()) await a.reloadMcpTools()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
