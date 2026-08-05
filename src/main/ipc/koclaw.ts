import { ipcMain, BrowserWindow } from 'electron'
import { Agent } from '../core/agent.js'

export function registerKoclawHandlers(
  agents: Map<string, Agent>,
  getWindows: () => (BrowserWindow | null)[]
) {
  ipcMain.handle('koclaw:start', async (_event, config: { port: number; token: string }) => {
    try {
      const { startWebhookServer } = await import('../services/webhook-server.js')
      const getAgentWithId = () => {
        const entry = agents.entries().next().value
        if (!entry) return null
        return { agent: entry[1] as Agent, workspaceId: entry[0] as string }
      }
      await startWebhookServer(
        { port: config.port, token: config.token, enabled: true },
        getAgentWithId,
        () => getWindows().filter((w): w is BrowserWindow => !!w)
      )
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('koclaw:stop', async () => {
    const { stopWebhookServer } = await import('../services/webhook-server.js')
    await stopWebhookServer()
    return { success: true }
  })

  ipcMain.handle('koclaw:status', async () => {
    const { getWebhookStatus } = await import('../services/webhook-server.js')
    return getWebhookStatus()
  })
}
