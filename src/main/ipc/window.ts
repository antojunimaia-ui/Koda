import { ipcMain, BrowserWindow, shell, app } from 'electron'
import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater

import { createIDEWindow } from '../windows.js'
import { IPC_CHANNELS } from '../../shared/ipc.js'

export function registerWindowHandlers(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle(IPC_CHANNELS.window.minimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle(IPC_CHANNELS.window.maximize, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })

  ipcMain.handle(IPC_CHANNELS.window.close, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle(IPC_CHANNELS.window.openIDE, () => {
    createIDEWindow()
  })

  ipcMain.handle(IPC_CHANNELS.window.openAgent, () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  ipcMain.handle(IPC_CHANNELS.window.openADE, () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  ipcMain.handle(IPC_CHANNELS.window.openExternal, async (_event, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.window.openDirectory, async () => {
    const win = getMainWindow()
    if (!win) return null
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.updater.install, () => {
    autoUpdater.quitAndInstall()
  })
}
