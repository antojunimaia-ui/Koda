import { useCallback } from 'react'
import { MessageEntry } from '../types/index.js'
import { nextId } from './useAgentStream.js'

interface UseSessionOptions {
  setMessages: (msgs: MessageEntry[] | ((p: MessageEntry[]) => MessageEntry[]), wsId?: string) => void
  setPinnedFiles: (files: string[] | ((p: string[]) => string[]), wsId?: string) => void
}

/**
 * Manages project session load/restore when the working directory changes.
 * Auto-save is handled by the effect in App.tsx since it depends on messages
 * and agentInfo which live in the parent.
 *
 * loadSession now accepts an optional workspaceId so writes always target
 * the correct workspace, even if the active tab changes mid-flight.
 */
export function useSession({ setMessages, setPinnedFiles }: UseSessionOptions) {
  const loadSession = useCallback(async (projectPath: string, workspaceId?: string) => {
    if (!projectPath || projectPath === '...') return

    setMessages([{ id: nextId(), type: 'system', text: `📂 Loading project context: ${projectPath}...` }], workspaceId)

    const session = await window.koda.getProjectSession(projectPath)
    if (session) {
      setMessages(session.messages || [], workspaceId)
      setPinnedFiles(session.pinnedFiles || [], workspaceId)
      // Sync back to agent internal state — no workspaceId needed for persistence
      await window.koda.saveProjectSession(workspaceId || '', projectPath, {
        rendererMessages: session.messages,
        backendMessages: session.backendHistory,
        pinnedFiles: session.pinnedFiles
      })
    } else {
      setMessages([], workspaceId)
      setPinnedFiles([], workspaceId)
      if (workspaceId) await window.koda.softReset(workspaceId)
    }
  }, [setMessages, setPinnedFiles])

  return { loadSession }
}
