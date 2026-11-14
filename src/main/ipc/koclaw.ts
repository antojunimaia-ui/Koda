import { ipcMain, BrowserWindow } from 'electron'
import { Agent } from '../core/agent.js'
import { IPC_CHANNELS } from '../../shared/ipc.js'
import { KoClawStartConfigSchema } from '../../shared/schemas.js'
import type { KoClawStartConfig } from '../../shared/schemas.js'

export function registerKoclawHandlers(agents: Map<string, Agent>, getWindows: () => (BrowserWindow | null)[]) {
  ipcMain.handle(IPC_CHANNELS.koclaw.start, async (_event, config: KoClawStartConfig) => {
    const parsed = KoClawStartConfigSchema.safeParse(config)
    if (!parsed.success) {
      return { success: false, error: 'Invalid KoClaw config' }
    }
    const validConfig = parsed.data
    try {
      const { startWebhookServer } = await import('../services/webhook-server.js')
      const getAgentWithId = () => {
        const entry = agents.entries().next().value
        if (!entry) return null
        return { agent: entry[1] as Agent, workspaceId: entry[0] as string }
      }
      await startWebhookServer(
        {
          port: validConfig.port,
          token: validConfig.token,
          enabled: true,
          allowRemoteAccess: validConfig.allowRemoteAccess,
          streaming: validConfig.streaming,
        },
        getAgentWithId,
        () => getWindows().filter((w): w is BrowserWindow => !!w),
      )
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.koclaw.stop, async () => {
    const { stopWebhookServer } = await import('../services/webhook-server.js')
    await stopWebhookServer()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.koclaw.status, async () => {
    const { getWebhookStatus } = await import('../services/webhook-server.js')
    return getWebhookStatus()
  })
}
