import { MessageEntry } from '../types/index.js'

export interface StoredSession {
  id: string
  title: string
  timestamp: number
  messages: MessageEntry[]
  pinnedFiles: string[]
}

interface SessionIndexEntry {
  id: string
  title: string
  timestamp: number
}

export interface ProjectSummary {
  path: string
  name: string
  lastActive: number
  sessions: StoredSession[]
}

// ── Key helpers ───────────────────────────────────────────────────────────────

function getProjectName(projectPath: string): string {
  if (!projectPath) return 'Untitled Project'
  const normalized = projectPath.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || projectPath
}

function registerProject(projectPath: string): void {
  if (!projectPath) return
  try {
    const raw = localStorage.getItem('koda_projects_registry')
    const registry: Array<{ path: string; name: string; lastActive: number }> = raw ? JSON.parse(raw) : []
    const idx = registry.findIndex(p => p.path === projectPath)
    const entry = { path: projectPath, name: getProjectName(projectPath), lastActive: Date.now() }
    if (idx >= 0) {
      registry[idx] = entry
    } else {
      registry.unshift(entry)
    }
    localStorage.setItem('koda_projects_registry', JSON.stringify(registry))
  } catch {}
}

function hashPath(projectPath: string): string {
  let hash = 0
  for (let i = 0; i < projectPath.length; i++) {
    hash = ((hash << 5) - hash + projectPath.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16)
}

/** Lightweight index — stores only { id, title, timestamp } per session */
function indexKey(projectPath: string): string {
  return `koda_sessions_idx_${hashPath(projectPath)}`
}

/** Full session data stored individually — serializes only 1 session at a time */
function sessionKey(sessionId: string): string {
  return `koda_sess_${sessionId}`
}

/** Legacy monolithic key (pre-refactor) — used for one-time migration */
function legacyKey(projectPath: string): string {
  return `koda_sessions_${hashPath(projectPath)}`
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Migration ─────────────────────────────────────────────────────────────────

/**
 * One-time migration from the old monolithic key (all 50 sessions in one JSON)
 * to the new per-session key architecture. Runs once per project path.
 */
function migrateIfNeeded(projectPath: string): void {
  const legacy = legacyKey(projectPath)
  const raw = localStorage.getItem(legacy)
  if (!raw) return

  const idxKey = indexKey(projectPath)
  // Already migrated — just clean up the old key
  if (localStorage.getItem(idxKey)) {
    localStorage.removeItem(legacy)
    return
  }

  try {
    const sessions: StoredSession[] = JSON.parse(raw)
    const index: SessionIndexEntry[] = []
    for (const session of sessions) {
      localStorage.setItem(sessionKey(session.id), JSON.stringify(session))
      index.push({ id: session.id, title: session.title, timestamp: session.timestamp })
    }
    localStorage.setItem(idxKey, JSON.stringify(index))
  } catch {
    // Migration failed — start fresh
  } finally {
    localStorage.removeItem(legacy)
  }
}

// ── Index helpers ─────────────────────────────────────────────────────────────

function readIndex(projectPath: string): SessionIndexEntry[] {
  migrateIfNeeded(projectPath)
  try {
    const raw = localStorage.getItem(indexKey(projectPath))
    if (!raw) return []
    return JSON.parse(raw) as SessionIndexEntry[]
  } catch {
    return []
  }
}

function writeIndex(projectPath: string, index: SessionIndexEntry[]): void {
  localStorage.setItem(indexKey(projectPath), JSON.stringify(index))
}

// ── Public API ────────────────────────────────────────────────────────────────

export const sessionStorage = {
  /**
   * Returns session metadata sorted newest-first.
   * Reads only the lightweight index — does NOT load message arrays.
   */
  list(projectPath: string): StoredSession[] {
    if (projectPath) registerProject(projectPath)
    const index = readIndex(projectPath)
    return index
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(entry => ({
        id: entry.id,
        title: entry.title,
        timestamp: entry.timestamp,
        messages: [],    // not loaded — use get() for full data
        pinnedFiles: [],
      }))
  },

  /** Returns all projects registered in session storage and their sessions. */
  listAllProjects(): ProjectSummary[] {
    try {
      const raw = localStorage.getItem('koda_projects_registry')
      const registry: Array<{ path: string; name: string; lastActive: number }> = raw ? JSON.parse(raw) : []
      const results: ProjectSummary[] = []

      for (const proj of registry) {
        const sessions = readIndex(proj.path)
          .sort((a, b) => b.timestamp - a.timestamp)
          .map(entry => ({
            id: entry.id,
            title: entry.title,
            timestamp: entry.timestamp,
            messages: [],
            pinnedFiles: [],
          }))

        if (sessions.length > 0) {
          const newestTime = Math.max(...sessions.map(s => s.timestamp), proj.lastActive)
          results.push({
            path: proj.path,
            name: proj.name,
            lastActive: newestTime,
            sessions,
          })
        }
      }

      return results.sort((a, b) => b.lastActive - a.lastActive)
    } catch {
      return []
    }
  },

  /** Loads a single session by ID — O(1), reads only that session's key. */
  get(projectPath: string, sessionId: string): StoredSession | null {
    migrateIfNeeded(projectPath)
    try {
      const raw = localStorage.getItem(sessionKey(sessionId))
      if (raw) return JSON.parse(raw) as StoredSession
    } catch {}
    return null
  },

  /**
   * Saves a session. O(1) — writes only the current session's key,
   * then updates the small index. No longer serializes all 50 sessions.
   */
  save(projectPath: string, session: Omit<StoredSession, 'id' | 'title'> & { id?: string; title?: string }): string {
    migrateIfNeeded(projectPath)
    if (projectPath) registerProject(projectPath)
    const id = session.id || generateId()
    const title = session.title || session.messages.find(m => m.type === 'user')?.text?.slice(0, 50) || 'Untitled'

    const updated: StoredSession = {
      id,
      title,
      timestamp: Date.now(),
      messages: session.messages,
      pinnedFiles: session.pinnedFiles,
    }

    // Write only this one session — this is the key performance fix
    localStorage.setItem(sessionKey(id), JSON.stringify(updated))

    // Update the lightweight index
    const index = readIndex(projectPath)
    const existingIdx = index.findIndex(e => e.id === id)
    const entry: SessionIndexEntry = { id, title, timestamp: updated.timestamp }

    if (existingIdx >= 0) {
      index[existingIdx] = entry
    } else {
      index.unshift(entry)
    }

    // Enforce 50-session limit — clean up evicted session data
    if (index.length > 50) {
      const evicted = index.splice(50)
      for (const e of evicted) {
        localStorage.removeItem(sessionKey(e.id))
      }
    }

    writeIndex(projectPath, index)
    return id
  },

  /** Deletes a session and removes it from the index. */
  delete(projectPath: string, sessionId: string): void {
    migrateIfNeeded(projectPath)
    localStorage.removeItem(sessionKey(sessionId))
    const index = readIndex(projectPath).filter(e => e.id !== sessionId)
    writeIndex(projectPath, index)
  },

  /** Returns the most recently saved session with full message data. */
  getMostRecent(projectPath: string): StoredSession | null {
    const index = readIndex(projectPath)
    if (index.length === 0) return null
    const sorted = [...index].sort((a, b) => b.timestamp - a.timestamp)
    return sessionStorage.get(projectPath, sorted[0].id)
  },
}

