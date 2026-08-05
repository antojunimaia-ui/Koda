import { ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { checkKodaIgnore } from '../utils/kodaignore.js'

export function registerProjectHandlers() {
  ipcMain.handle('project:get_files', async () => {
    try {
      const { globby } = await import('globby')
      const files = await globby(['**/*'], {
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'dist-electron/**', 'release-build/**', 'package-lock.json', 'yarn.lock'],
        dot: true,
        onlyFiles: true,
      })
      return { success: true, files }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('project:list_dir_lazy', async (_event, dirPath?: string) => {
    try {
      const cwd = process.cwd()
      const targetDir = dirPath ? path.resolve(dirPath) : cwd

      // Security: ensure targetDir is inside cwd (case-insensitive for Windows)
      const resolvedCwd    = path.resolve(cwd).toLowerCase()
      const resolvedTarget = path.resolve(targetDir).toLowerCase()
      if (!resolvedTarget.startsWith(resolvedCwd)) {
        throw new Error('Access denied: directory outside project')
      }

      if (!existsSync(targetDir)) return { success: true, files: [] }

      const entries = await fs.readdir(targetDir, { withFileTypes: true })
      const systemIgnore = new Set(['.git', 'node_modules', 'dist', 'dist-electron', 'release-build', 'package-lock.json', 'yarn.lock'])
      const files = []

      for (const entry of entries) {
        if (systemIgnore.has(entry.name)) continue
        const fullPath = path.join(targetDir, entry.name)
        if (checkKodaIgnore(fullPath, cwd)) continue
        files.push({ name: entry.name, path: fullPath.replace(/\\/g, '/'), isDir: entry.isDirectory() })
      }

      files.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1
        if (!a.isDir && b.isDir) return 1
        return a.name.localeCompare(b.name)
      })

      return { success: true, files }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('project:read_file', async (_event, filePath: string) => {
    try {
      const resolvedPath = path.resolve(filePath)
      if (!resolvedPath.startsWith(process.cwd())) throw new Error('Access denied: file outside project directory')
      const content = await fs.readFile(resolvedPath, 'utf-8')
      return { success: true, content }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('project:read_file_base64', async (_event, filePath: string) => {
    try {
      const resolvedPath = path.resolve(filePath)
      const buffer = await fs.readFile(resolvedPath)
      const base64 = buffer.toString('base64')
      const ext = path.extname(resolvedPath).toLowerCase().slice(1)
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        bmp: 'image/bmp', ico: 'image/x-icon',
      }
      const mime = mimeMap[ext] || 'image/png'
      return { success: true, dataUrl: `data:${mime};base64,${base64}` }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('project:write_file', async (_event, filePath: string, content: string) => {
    try {
      const resolvedPath = path.resolve(filePath)
      if (!resolvedPath.startsWith(process.cwd())) throw new Error('Access denied: file outside project directory')
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true })
      await fs.writeFile(resolvedPath, content, 'utf-8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('project:delete_file', async (_event, filePath: string) => {
    try {
      const resolvedPath = path.resolve(filePath)
      if (!resolvedPath.startsWith(process.cwd())) throw new Error('Access denied: file outside project directory')
      const stats = await fs.stat(resolvedPath)
      if (stats.isDirectory()) {
        await fs.rm(resolvedPath, { recursive: true, force: true })
      } else {
        await fs.unlink(resolvedPath)
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('project:rename_file', async (_event, oldPath: string, newPath: string) => {
    try {
      const cwd = process.cwd()
      const resolvedOld = path.resolve(oldPath)
      const resolvedNew = path.resolve(newPath)
      if (!resolvedOld.startsWith(cwd) || !resolvedNew.startsWith(cwd)) {
        throw new Error('Access denied: file outside project directory')
      }
      await fs.mkdir(path.dirname(resolvedNew), { recursive: true })
      await fs.rename(resolvedOld, resolvedNew)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('project:create_folder', async (_event, folderPath: string) => {
    try {
      const resolvedPath = path.resolve(folderPath)
      if (!resolvedPath.startsWith(process.cwd())) throw new Error('Access denied: folder outside project directory')
      await fs.mkdir(resolvedPath, { recursive: true })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
