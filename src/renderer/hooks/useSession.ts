import { useCallback } from 'react'
import { MessageEntry } from '../types/index.js'
import { sessionStorage } from './useSessionStorage.js'

interface UseSessionOptions {
  setMessages: (msgs: MessageEntry[] | ((p: MessageEntry[]) => MessageEntry[]), wsId?: string) => void
  setPinnedFiles: (files: string[] | ((p: string[]) => string[]), wsId?: string) => void
}

export function useSession({ setMessages, setPinnedFiles }: UseSessionOptions) {
  const loadSession = useCallback((projectPath: string, workspaceId?: string) => {
    if (!projectPath || projectPath === '...') return

    const session = sessionStorage.getMostRecent(projectPath)
    if (session) {
      setMessages(session.messages || [], workspaceId)
      setPinnedFiles(session.pinnedFiles || [], workspaceId)
      return session.id
    } else {
      setMessages([], workspaceId)
      setPinnedFiles([], workspaceId)
      if (workspaceId) window.koda.softReset(workspaceId)
      return null
    }
  }, [setMessages, setPinnedFiles])

  const loadSpecificSession = useCallback((projectPath: string, sessionId: string, workspaceId?: string) => {
    if (!projectPath || !sessionId) return null
    const session = sessionStorage.get(projectPath, sessionId)
    if (session) {
      setMessages(session.messages || [], workspaceId)
      setPinnedFiles(session.pinnedFiles || [], workspaceId)
      return session.id
    }
    return null
  }, [setMessages, setPinnedFiles])

  return { loadSession, loadSpecificSession }
}

