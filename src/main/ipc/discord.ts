import { ipcMain } from 'electron'
import { DiscordRPCManager } from '../services/discord-rpc.js'

export function registerDiscordHandlers(discordRPC: DiscordRPCManager) {
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
}
