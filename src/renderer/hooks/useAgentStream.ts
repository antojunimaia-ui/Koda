import { useCallback, useEffect, useRef } from 'react'
import {
  MessageEntry,
  AgentInfo,
  TrackedFile,
} from '../types/index.js'

let _nextId = 0
export const nextId = () => ++_nextId

interface UseAgentStreamOptions {
  setMessages: React.Dispatch<React.SetStateAction<MessageEntry[]>>
  setAgentInfo: React.Dispatch<React.SetStateAction<AgentInfo>>
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>
  setTrackedFiles: React.Dispatch<React.SetStateAction<TrackedFile[]>>
  setPendingPlan: React.Dispatch<React.SetStateAction<string | null>>
  setInPlanMode: React.Dispatch<React.SetStateAction<boolean>>
  scheduleScroll: () => void
}

/**
 * Subscribes to `window.koda.onUpdate` and dispatches all IPC update types
 * to their respective state setters. Also manages the streaming rAF flush loop.
 */
export function useAgentStream({
  setMessages,
  setAgentInfo,
  setIsProcessing,
  setTrackedFiles,
  setPendingPlan,
  setInPlanMode,
  scheduleScroll,
}: UseAgentStreamOptions) {
  const chunkBufferRef = useRef<string>('')
  const rafRef = useRef<number | null>(null)
  const taskStartRef = useRef<number | null>(null)

  const flushStreaming = useCallback(() => {
    rafRef.current = null
    const chunk = chunkBufferRef.current
    if (!chunk) return
    chunkBufferRef.current = ''

    setMessages(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last && last.type === 'assistant' && !last.done) {
        updated[updated.length - 1] = { ...last, text: (last.text || '') + chunk }
        return updated
      }
      return [...updated, { id: nextId(), type: 'assistant', text: chunk, done: false }]
    })
  }, [setMessages])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(flushStreaming)
  }, [flushStreaming])

  useEffect(() => {
    if (!window.koda) return

    const unsubscribe = window.koda.onUpdate((update: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (update.type === 'text') {
        chunkBufferRef.current += update.content
        scheduleFlush()
        scheduleScroll()

      } else if (update.type === 'tool_start') {
        const chunk = chunkBufferRef.current
        chunkBufferRef.current = ''
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }

        setMessages(prev => {
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
        scheduleScroll()

      } else if (update.type === 'tool_progress') {
        // Real-time signal from inside the tool (e.g. right before writeFile)
        // Update the running tool message so the shimmer shows the correct action label
        if (update.event === 'writing') {
          setMessages(prev =>
            prev.map(m =>
              m.type === 'tool' && m.tool && m.tool.name === update.toolName && m.tool.status === 'running'
                ? { ...m, tool: { ...m.tool, args: { ...m.tool.args, path: update.path ?? m.tool.args?.path }, status: 'writing' as const } }
                : m
            )
          )
        }

      } else if (update.type === 'tool_end') {
        setMessages(prev =>
          prev.map(m =>
            m.type === 'tool' && m.tool && m.tool.name === update.name && (m.tool.status === 'running' || m.tool.status === 'writing' || m.tool.status === 'awaiting_approval')
              ? { ...m, tool: { ...m.tool, status: 'done' as const, success: update.success, output: update.result, args: update.args || m.tool.args } }
              : m
          )
        )
        scheduleScroll()

      } else if (update.type === 'error') {
        chunkBufferRef.current = ''
        setMessages(prev => [...prev, { id: nextId(), type: 'error', text: update.message }])
        scheduleScroll()

      } else if (update.type === 'pty_output') {
        setMessages(prev => {
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
        scheduleScroll()

      } else if (update.type === 'pty_exit') {
        setMessages(prev => prev.map(m =>
          m.type === 'pty' && m.pty?.pid === update.pid
            ? { ...m, pty: { ...m.pty!, exited: true } }
            : m
        ))

      } else if (update.type === 'plan_mode_entered') {
        setInPlanMode(true)
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: '📋 Koda exited Plan Mode — all changes approved and history updated.' }])
        scheduleScroll()

      } else if (update.type === 'info_updated') {
        setAgentInfo(update.info)

      } else if (update.type === 'plan_approval_requested') {
        setPendingPlan(update.plan)
        scheduleScroll()

      } else if (update.type === 'shell_awaiting_approval') {
        setMessages(prev => {
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
        scheduleScroll()

      } else if (update.type === 'plan_mode_exited') {
        setInPlanMode(false)
        setPendingPlan(null)
        const msg = update.approved
          ? '✅ Plan approved! Koda will start implementation now.'
          : '❌ Plan rejected. Koda will refine the approach.'
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: msg }])
        scheduleScroll()

      } else if (update.type === 'files_tracked') {
        setTrackedFiles(update.files)

      } else if (update.type === 'pty_spawned') {
        setMessages(prev => {
          const updated = [...prev]
          const index = updated.map(m => m.type === 'tool' && m.tool?.status === 'running' ? m.tool.name : null).lastIndexOf(update.name)
          if (index !== -1) {
            updated[index] = { ...updated[index], tool: { ...updated[index].tool!, pid: update.pid } }
          }
          return updated
        })

      } else if (update.type === 'done') {
        const elapsed = taskStartRef.current ? Date.now() - taskStartRef.current : 0
        taskStartRef.current = null
        if (elapsed > 3000 && !document.hasFocus() && Notification.permission === 'granted') {
          new Notification('Koda', { body: 'Task completed ✔', icon: '/icon.png', silent: true })
        }

      } else if (update.type === 'remote_task') {
        setMessages(prev => [...prev, {
          id: update.messageId,
          type: 'user' as const,
          text: update.message,
          remote: true,
        }])
        setIsProcessing(true)
        taskStartRef.current = Date.now()
        scheduleScroll()

      } else if (update.type === 'remote_reset') {
        setMessages(prev => [...prev, { id: nextId(), type: 'system', text: '🌐 Remote: conversation reset.' }])
      }
    })

    return () => {
      window.koda.removeUpdateListener()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [scheduleFlush, scheduleScroll, setAgentInfo, setInPlanMode, setIsProcessing, setMessages, setPendingPlan, setTrackedFiles])

  return { chunkBufferRef, rafRef, taskStartRef, scheduleFlush }
}
