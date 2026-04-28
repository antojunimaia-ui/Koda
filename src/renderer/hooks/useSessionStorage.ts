import { MessageEntry } from '../types/index.js'

export interface StoredSession {
  id: string
  title: string
  timestamp: number
  messages: MessageEntry[]
  pinnedFiles: string[]
}

function projectKey(projectPath: string): string {
  // Hash simples do path pra usar como chave
  let hash = 0
  for (let i = 0; i < projectPath.length; i++) {
    hash = ((hash << 5) - hash + projectPath.charCodeAt(i)) | 0
  }
  return `koda_sessions_${Math.abs(hash).toString(16)}`
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const sessionStorage = {
  list(projectPath: string): StoredSession[] {
    try {
      const raw = localStorage.getItem(projectKey(projectPath))
      if (!raw) return []
      const sessions: StoredSession[] = JSON.parse(raw)
      return sessions.sort((a, b) => b.timestamp - a.timestamp)
    } catch {
      return []
    }
  },

  get(projectPath: string, sessionId: string): StoredSession | null {
    const sessions = sessionStorage.list(projectPath)
    return sessions.find(s => s.id === sessionId) || null
  },

  save(projectPath: string, session: Omit<StoredSession, 'id' | 'title'> & { id?: string; title?: string }): string {
    const sessions = sessionStorage.list(projectPath)
    const id = session.id || generateId()
    const title = session.title || session.messages.find(m => m.type === 'user')?.text?.slice(0, 50) || 'Untitled'

    const existing = sessions.findIndex(s => s.id === id)
    const updated: StoredSession = { id, title, timestamp: Date.now(), messages: session.messages, pinnedFiles: session.pinnedFiles }

    if (existing >= 0) {
      sessions[existing] = updated
    } else {
      sessions.unshift(updated)
    }

    // Limita a 50 sessões por projeto
    const trimmed = sessions.slice(0, 50)
    localStorage.setItem(projectKey(projectPath), JSON.stringify(trimmed))
    return id
  },

  delete(projectPath: string, sessionId: string): void {
    const sessions = sessionStorage.list(projectPath).filter(s => s.id !== sessionId)
    localStorage.setItem(projectKey(projectPath), JSON.stringify(sessions))
  },

  getMostRecent(projectPath: string): StoredSession | null {
    const sessions = sessionStorage.list(projectPath)
    return sessions[0] || null
  }
}
