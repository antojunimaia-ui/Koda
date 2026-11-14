/**
 * Lightweight in-session file access tracker.
 * Collects which files the agent read or modified during the current session.
 * Emits an IPC event to the renderer whenever the list changes.
 */

import { BrowserWindow } from 'electron'
import { statSync } from 'node:fs'

export type FileAccessType = 'read' | 'modified'

export interface TrackedFile {
  path: string
  access: FileAccessType
  /** Most recent access timestamp */
  timestamp: number
  /** File size at tracking time (bytes) */
  size?: number
  /** File modified-time at tracking time (ms) */
  mtimeMs?: number
}

const trackedFiles = new Map<string, TrackedFile>()

function emit() {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  win.webContents.send('agent:update', {
    type: 'files_tracked',
    files: getTrackedFiles(),
  })
}

function fileStats(absPath: string): { size: number; mtimeMs: number } | null {
  try {
    const s = statSync(absPath)
    return { size: s.size, mtimeMs: s.mtimeMs }
  } catch {
    return null
  }
}

export function trackFile(absPath: string, access: FileAccessType): void {
  const existing = trackedFiles.get(absPath)
  // Upgrade "read" to "modified" but never downgrade
  const finalAccess = existing?.access === 'modified' && access === 'read' ? 'modified' : access

  trackedFiles.set(absPath, {
    path: absPath,
    access: finalAccess,
    timestamp: Date.now(),
    ...(fileStats(absPath) ?? {}),
  })

  emit()
}

export function getTrackedFiles(): TrackedFile[] {
  return Array.from(trackedFiles.values()).sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * True quando o arquivo já foi lido nesta sessão e NÃO mudou no disco desde a
 * última leitura. Usado para evitar releituras redundantes (guard anti-duplicação).
 */
export function isFreshCacheableRead(absPath: string): boolean {
  const tracked = trackedFiles.get(absPath)
  if (!tracked || tracked.access !== 'read') return false
  const stats = fileStats(absPath)
  if (!stats) return false
  return tracked.mtimeMs === stats.mtimeMs && tracked.size === stats.size
}

export function clearTrackedFiles(): void {
  trackedFiles.clear()
  emit()
}
