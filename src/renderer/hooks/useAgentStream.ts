import { useCallback, useEffect, useRef } from 'react'
import {
  MessageEntry,
  AgentInfo,
  TrackedFile,
} from '../types/index.js'

let _nextId = 0
export const nextId = () => ++_nextId

interface UseAgentStreamOptions {
  onUpdate: (workspaceId: string, update: (prev: MessageEntry[]) => MessageEntry[]) => void
  onAgentInfo: (workspaceId: string, info: AgentInfo) => void
  onProcessing: (workspaceId: string, processing: boolean) => void
  onTrackedFiles: (workspaceId: string, files: TrackedFile[]) => void
  onPendingPlan: (workspaceId: string, plan: string | null) => void
  onPlanMode: (workspaceId: string, inPlanMode: boolean) => void
  scheduleScroll: (workspaceId: string) => void
}

/**
 * Subscribes to `window.koda.onUpdate` and dispatches all IPC update types
 * to their respective state setters. Also manages the streaming rAF flush loop.
 */
export function useAgentStream({
  onUpdate,
  onAgentInfo,
  onProcessing,
  onTrackedFiles,
  onPendingPlan,
  onPlanMode,
  scheduleScroll,
}: UseAgentStreamOptions) {
  const chunkBuffersRef = useRef<Map<string, string>>(new Map())
  const rafRefs = useRef<Map<string, number | null>>(new Map())
  const taskStartsRef = useRef<Map<string, number | null>>(new Map())

  const flushStreaming = useCallback((workspaceId: string) => {
    rafRefs.current.set(workspaceId, null)
    const chunk = chunkBuffersRef.current.get(workspaceId)
    if (!chunk) return
    chunkBuffersRef.current.set(workspaceId, '')

    onUpdate(workspaceId, (prev: MessageEntry[]) => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last && last.type === 'assistant' && !last.done) {
        updated[updated.length - 1] = { ...last, text: (last.text || '') + chunk }
        return updated
      }
      return [...updated, { id: nextId(), type: 'assistant', text: chunk, done: false }]
    })
  }, [onUpdate])

  const scheduleFlush = useCallback((workspaceId: string) => {
    if (rafRefs.current.get(workspaceId)) return
    rafRefs.current.set(workspaceId, requestAnimationFrame(() => flushStreaming(workspaceId)))
  }, [flushStreaming])

  useEffect(() => {
    if (!window.koda) return

    const unsubscribe = window.koda.onUpdate((payload: any) => {
      const { workspaceId, ...update } = payload
      
      if (update.type === 'text') {
        const current = chunkBuffersRef.current.get(workspaceId) || ''
        chunkBuffersRef.current.set(workspaceId, current + update.content)
        scheduleFlush(workspaceId)

      } else if (update.type === 'tool_start') {
        const chunk = chunkBuffersRef.current.get(workspaceId) || ''
        chunkBuffersRef.current.set(workspaceId, '')
        const raf = rafRefs.current.get(workspaceId)
        if (raf) { cancelAnimationFrame(raf); rafRefs.current.set(workspaceId, null) }

        onUpdate(workspaceId, prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          let finalized = updated

          if (chunk) {
            if (last && last.type === 'assistant' && !last.done) {
              updated[updated.length - 1] = { ...last, text: (last.text || '') + chunk, done: true }
            } else {
              finalized = [...updated, { id: nextId(), type: 'assistant', text: chunk, done: true }]
            }
          } else {
            if (last && last.type === 'assistant' && !last.done) {
              updated[updated.length - 1] = { ...last, done: true }
            }
          }
          return [...finalized, { id: nextId(), type: 'tool', tool: { name: update.name, args: update.args, status: 'running' as const, success: false } }]
        })
        scheduleScroll(workspaceId)

      } else if (update.type === 'tool_progress') {
        if (update.event === 'writing') {
          onUpdate(workspaceId, prev =>
            prev.map(m =>
              m.type === 'tool' && m.tool && m.tool.name === update.toolName && m.tool.status === 'running'
                ? { ...m, tool: { ...m.tool, args: { ...m.tool.args, path: update.path ?? m.tool.args?.path }, isNew: update.isNew ?? false, status: 'writing' as const } }
                : m
            )
          )
        }

      } else if (update.type === 'tool_end') {
        const applyEnd = () => onUpdate(workspaceId, prev =>
          prev.map(m =>
            m.type === 'tool' && m.tool && m.tool.name === update.name && (m.tool.status === 'running' || m.tool.status === 'writing' || m.tool.status === 'awaiting_approval')
              ? { ...m, tool: { ...m.tool, status: 'done' as const, success: update.success, output: update.result, args: update.args || m.tool.args } }
              : m
          )
        )
        requestAnimationFrame(() => requestAnimationFrame(() => {
          applyEnd()
          scheduleScroll(workspaceId)
        }))

      } else if (update.type === 'error') {
        chunkBuffersRef.current.set(workspaceId, '')
        onUpdate(workspaceId, prev => [...prev, { id: nextId(), type: 'error', text: update.message }])
        scheduleScroll(workspaceId)

      } else if (update.type === 'pty_output') {
        onUpdate(workspaceId, prev => {
          const updated = [...prev]
          const ptyIndex = updated.map(m => m.type === 'pty' ? m.pty?.pid : null).lastIndexOf(update.pid)
          if (ptyIndex !== -1) {
            updated[ptyIndex] = {
              ...updated[ptyIndex],
              pty: { ...updated[ptyIndex].pty!, output: updated[ptyIndex].pty!.output + update.data }
            }
            return updated
          }
          return [...updated, { id: nextId(), type: 'pty', pty: { pid: update.pid, output: update.data } }]
        })
        scheduleScroll(workspaceId)

      } else if (update.type === 'pty_exit') {
        onUpdate(workspaceId, prev => prev.map(m =>
          m.type === 'pty' && m.pty?.pid === update.pid
            ? { ...m, pty: { ...m.pty!, exited: true } }
            : m
        ))

      } else if (update.type === 'plan_mode_entered') {
        onPlanMode(workspaceId, true)
        onUpdate(workspaceId, prev => [...prev, { id: nextId(), type: 'system', text: '📋 Koda exited Plan Mode — all changes approved and history updated.' }])
        scheduleScroll(workspaceId)

      } else if (update.type === 'info_updated') {
        onAgentInfo(workspaceId, update.info)

      } else if (update.type === 'plan_approval_requested') {
        onPendingPlan(workspaceId, update.plan)
        scheduleScroll(workspaceId)

      } else if (update.type === 'shell_awaiting_approval') {
        onUpdate(workspaceId, prev => {
          const updated = [...prev]
          const lastToolIdx = updated.map(m => m.type === 'tool' && m.tool?.status === 'running' ? m.tool.name : null).lastIndexOf('shell')
          if (lastToolIdx !== -1) {
            updated[lastToolIdx] = {
              ...updated[lastToolIdx],
              tool: {
                ...updated[lastToolIdx].tool!,
                status: 'awaiting_approval',
                command: update.command,
                baseCommand: update.baseCommand
              }
            }
          }
          return updated
        })
        scheduleScroll(workspaceId)

      } else if (update.type === 'plan_mode_exited') {
        onPlanMode(workspaceId, false)
        onPendingPlan(workspaceId, null)
        const msg = update.approved
          ? '✅ Plan approved! Koda will start implementation now.'
          : '❌ Plan rejected. Koda will refine the approach.'
        onUpdate(workspaceId, prev => [...prev, { id: nextId(), type: 'system', text: msg }])
        scheduleScroll(workspaceId)

      } else if (update.type === 'files_tracked') {
        onTrackedFiles(workspaceId, update.files)

      } else if (update.type === 'pty_spawned') {
        onUpdate(workspaceId, prev => {
          const updated = [...prev]
          const index = updated.map(m => m.type === 'tool' && m.tool?.status === 'running' ? m.tool.name : null).lastIndexOf(update.name)
          if (index !== -1) {
            updated[index] = { ...updated[index], tool: { ...updated[index].tool!, pid: update.pid } }
          }
          return updated
        })

      } else if (update.type === 'done') {
        onProcessing(workspaceId, false)
        const start = taskStartsRef.current.get(workspaceId)
        const elapsed = start ? Date.now() - start : 0
        taskStartsRef.current.set(workspaceId, null)
        if (elapsed > 3000 && !document.hasFocus() && Notification.permission === 'granted') {
          new Notification('Koda', { body: 'Task completed ✔', icon: '/icon.png', silent: true })
        }

      } else if (update.type === 'remote_task') {
        onUpdate(workspaceId, prev => [...prev, {
          id: update.messageId,
          type: 'user' as const,
          text: update.message,
          remote: true,
        }])
        onProcessing(workspaceId, true)
        taskStartsRef.current.set(workspaceId, Date.now())
        scheduleScroll(workspaceId)

      } else if (update.type === 'remote_reset') {
        onUpdate(workspaceId, prev => [...prev, { id: nextId(), type: 'system', text: '🌐 Remote: conversation reset.' }])
      }
    })

    return () => {
      window.koda.removeUpdateListener()
      rafRefs.current.forEach(raf => raf && cancelAnimationFrame(raf))
    }
  }, [scheduleFlush, scheduleScroll, onAgentInfo, onPlanMode, onProcessing, onUpdate, onPendingPlan, onTrackedFiles])

  return { chunkBuffersRef, rafRefs, taskStartsRef, scheduleFlush }
}
