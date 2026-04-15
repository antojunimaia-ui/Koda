import { useCallback, useRef } from 'react'
import { MessageEntry, AgentInfo } from '../types/index.js'
import { nextId } from './useAgentStream.js'

interface UseSessionOptions {
  setMessages: React.Dispatch<React.SetStateAction<MessageEntry[]>>
  setPinnedFiles: React.Dispatch<React.SetStateAction<string[]>>
}

/**
 * Manages project session load/restore when the working directory changes.
 * Auto-save is handled by the effect in App.tsx since it depends on messages
 * and agentInfo which live in the parent.
 */
export function useSession({ setMessages, setPinnedFiles }: UseSessionOptions) {
  const lastSavedCwd = useRef<string>('')

  const loadSession = useCallback(async (projectPath: string) => {
    if (!projectPath || projectPath === '...' || projectPath === lastSavedCwd.current) return
    lastSavedCwd.current = projectPath

    setMessages([{ id: nextId(), type: 'system', text: `📂 Loading project context: ${projectPath}...` }])

    const session = await window.koda.getProjectSession(projectPath)
    if (session) {
      setMessages(session.messages || [])
      setPinnedFiles(session.pinnedFiles || [])
      // Sync back to agent internal state
      await window.koda.saveProjectSession(projectPath, {
        rendererMessages: session.messages,
        backendMessages: session.backendHistory,
        pinnedFiles: session.pinnedFiles
      })
    } else {
      setMessages([])
      setPinnedFiles([])
      await window.koda.softReset()
    }
  }, [setMessages, setPinnedFiles])

  return { loadSession, lastSavedCwd }
}
