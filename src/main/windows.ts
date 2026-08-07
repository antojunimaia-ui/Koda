import { BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let ideWindow: BrowserWindow | null = null

export function getMainWindow() {
  return mainWindow
}

export function getIdeWindow() {
  return ideWindow
}

export function getAllWindows(): (BrowserWindow | null)[] {
  return [mainWindow, ideWindow]
}

function applyNavigationGuard(win: BrowserWindow) {
  const rootUrl = process.env.VITE_DEV_SERVER_URL || 'file://'

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(rootUrl)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
}

export function createWindow(fileWatcherSetMainWindow: (win: BrowserWindow) => void) {
  const preloadPath = path.join(__dirname, 'preload/index.mjs')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      webSecurity: false,
      enableWebSQL: false,
      offscreen: false,
      transparent: false,
    },
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'crashed' || details.reason === 'killed') {
      console.error('Renderer process gone:', details.reason)
      setTimeout(() => mainWindow?.reload(), 2000)
    } else {
      console.warn('Render process gone:', details.reason)
    }
  })

  mainWindow.on('unresponsive', () => {
    console.warn('Window became unresponsive')
    setTimeout(() => mainWindow?.destroy(), 10000)
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
    mainWindow?.webContents.setZoomFactor(0.9)
  })

  applyNavigationGuard(mainWindow)

  fileWatcherSetMainWindow(mainWindow)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

export function createIDEWindow() {
  const preloadPath = path.join(__dirname, 'preload/index.mjs')

  ideWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      webSecurity: false,
      enableWebSQL: false,
      offscreen: false,
      transparent: false,
    },
  })

  ideWindow.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'crashed' || details.reason === 'killed') {
      console.error('IDE Renderer process gone:', details.reason)
      setTimeout(() => ideWindow?.reload(), 2000)
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    ideWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?window=ide`)
    ideWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    ideWindow.loadURL(`file:///${indexPath.replace(/\\/g, '/')}?window=ide`)
  }

  ideWindow.once('ready-to-show', () => {
    ideWindow?.maximize()
    ideWindow?.show()
    ideWindow?.webContents.setZoomFactor(0.9)
  })

  applyNavigationGuard(ideWindow)

  ideWindow.on('closed', () => {
    ideWindow = null
  })
}
