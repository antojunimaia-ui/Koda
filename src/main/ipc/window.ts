import { ipcMain, BrowserWindow, shell, app } from 'electron'
import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater

import { createIDEWindow } from '../windows.js'

export function registerWindowHandlers(
  getMainWindow: () => BrowserWindow | null
) {
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('window:open_ide', () => {
    createIDEWindow()
  })

  ipcMain.handle('window:open_agent', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  ipcMain.handle('window:open_external', async (_event, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('window:open_directory', async () => {
    const win = getMainWindow()
    if (!win) return null
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
  })
}
