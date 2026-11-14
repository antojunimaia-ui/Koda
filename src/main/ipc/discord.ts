import { ipcMain } from 'electron'
import { DiscordRPCManager } from '../services/discord-rpc.js'
import { IPC_CHANNELS } from '../../shared/ipc.js'

export function registerDiscordHandlers(discordRPC: DiscordRPCManager) {
  ipcMain.handle(IPC_CHANNELS.discord.enable, async () => {
    try {
      await discordRPC.enable()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.discord.disable, () => {
    discordRPC.disable()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.discord.isEnabled, () => {
    return { enabled: discordRPC.isEnabled() }
  })

  ipcMain.handle(IPC_CHANNELS.discord.updateActivity, async (_event, activity) => {
    try {
      await discordRPC.updateActivity(activity)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.discord.clearActivity, async () => {
    try {
      await discordRPC.clearActivity()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
