import { useCallback } from 'react'
import { Workspace, AttachedFile } from '../types/index.js'
import { nextId } from './useAgentStream.js'
import { KoDB } from '../db/kodb.js'

interface UseMessageActionsOptions {
  activeId: string | null
  workspaces: Workspace[]
  input: string
  setInput: (v: string) => void
  updateWorkspace: (id: string, updates: Partial<Workspace> | ((prev: Workspace) => Workspace)) => void
  setInitializing: (v: boolean) => void
  setAllFiles: (v: string[]) => void
  setShowSlashMenu: (v: boolean) => void
  setShowSuggestions: (v: boolean) => void
  pushHistory: (msg: string) => void
  chunkBuffersRef: React.RefObject<Map<string, string>>
  rafRefs: React.RefObject<Map<string, number | null>>
  taskStartsRef: React.RefObject<Map<string, number | null>>
  scheduleScroll: (wsId: string) => void
}

const MODE_PREFIXES: Record<string, (userMsg: string) => string> = {
  planner: (userMsg) =>
    `[SPEC DEVELOPMENT MODE PROTOCOL - MANDATORY]\n1. Call the 'enter_plan_mode' tool IMMEDIATELY.\n2. Explore the codebase using read-only tools.\n3. WRITE your proposed specifications directly to 'specs.md' in the root directory.\n4. Call 'exit_plan_mode' with the Markdown specs content to submit it for my approval.\n5. DO NOT ATTEMPT TO EDIT OTHER FILES OR RUN EVOLUTIVE SHELL COMMANDS UNTIL I APPROVE THE SPEC.\n\nYour current task is: ${userMsg}`,
  colab: (userMsg) =>
    `[COLLABORATIVE MODE PROTOCOL - ACTIVE]\n1. You are working in COLLABORATIVE MODE.\n2. You have access to a suite of collaboration tools: 'start_collaboration', 'send_to_advisor', and 'end_collaboration'.\n3. Use 'start_collaboration' to initialize a discussion with an Elite Technical Advisor.\n4. Use 'send_to_advisor' to exchange ideas, ask follow-up questions, and refine your plan.\n5. Once you have a solid strategy approved by the advisor, use 'end_collaboration' and proceed to implementation.\n6. This mode is for COMPLEX architectural discussions. Use it to deliver superior engineering.\n\nYour current task is: ${userMsg}`,
  teach: (userMsg) =>
    `[TEACH & CODE MODE — ACTIVE]\nYou are now a hands-on programming instructor. You will BUILD the solution live, as if teaching a class. Follow this structure for every meaningful step:\n\n📖 CONCEPT FIRST — Before writing code, briefly introduce the concept or technique you are about to use. One or two sentences max. Why does it exist? What problem does it solve?\n\n💻 CODE — Write the code. Keep it clean and intentional.\n\n🔍 BREAKDOWN — After each block, explain what each key part does. Point out non-obvious decisions. If you chose approach A over B, say why.\n\n⚠️ WATCH OUT — Flag common mistakes, gotchas, or edge cases a student might miss.\n\n🎯 LESSON — End each major step with one clear takeaway sentence.\n\nRules:\n- Write as if the student is watching your screen and learning in real time.\n- Never just dump code without explanation.\n- Respond in the same language the student used.\n\nYour current task is: ${userMsg}`,
}

export function useMessageActions({
  activeId,
  workspaces,
  input,
  setInput,
  updateWorkspace,
  setInitializing,
  setAllFiles,
  setShowSlashMenu,
  setShowSuggestions,
  pushHistory,
  chunkBuffersRef,
  rafRefs,
  taskStartsRef,
  scheduleScroll,
}: UseMessageActionsOptions) {

  // ── Slash command handler ──────────────────────────────────────────────────
  const runSlashCommand = useCallback(async (cmd: string, parts: string[], ws: Workspace) => {
    if (cmd === '/clear') { updateWorkspace(ws.id, { messages: [] }); return true }
    if (cmd === '/help') {
      updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'system', text: 'Available commands:\n/help - Show this help\n/clear - Clear messages\n/reset - Reset conversation\n/model [--name] - View or switch model' }] }))
      return true
    }
    if (cmd === '/reset') {
      await window.koda.reset(ws.id)
      updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'system', text: 'Conversation reset!' }] }))
      return true
    }
    if (cmd === '/model') {
      const modelArg = parts[1]
      if (modelArg?.startsWith('--')) {
        const res = await window.koda.setModel(ws.id, modelArg.slice(2))
        if (res.success) {
          updateWorkspace(ws.id, { agentInfo: res.info })
          updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'system', text: `🤖 Model updated to: ${res.info.model} (${res.info.provider})` }] }))
        } else {
          updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'error', text: res.error }] }))
        }
        return true
      }
      const info = await window.koda.getInfo(ws.id)
      updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'system', text: `Provider: ${info.provider} | Model: ${info.model}` }] }))
      return true
    }
    if (cmd === '/apikey') {
      const key = parts[1]
      if (!key) {
        updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'error', text: 'Usage: /apikey <key>' }] }))
        return true
      }
      const res = await window.koda.setApiKey(ws.id, key)
      if (res.success) {
        updateWorkspace(ws.id, { agentInfo: res.info })
        updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'system', text: '🔑 API Key updated successfully!' }] }))
      } else {
        updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'error', text: res.error }] }))
      }
      return true
    }
    return false
  }, [updateWorkspace])

  // ── Core send logic ────────────────────────────────────────────────────────
  const handleSendForWs = useCallback(async (overrideText?: string, overrideImages?: AttachedFile[], wsId?: string) => {
    const targetId = wsId || activeId
    const ws = workspaces.find(w => w.id === targetId)
    if (!ws) return

    let userMsg = overrideText ?? input
    if ((ws.inputFiles || []).length > 0 && !overrideText) {
      userMsg = userMsg + ws.inputFiles.map(f => ` @[${f}]`).join('')
    }
    const currentImages = overrideImages ?? ws.pendingImages
    if (!userMsg.trim()) return

    // Queue if busy
    if (ws.isProcessing && !overrideText) {
      updateWorkspace(ws.id, prev => ({ ...prev, taskQueue: [...prev.taskQueue, { text: userMsg, images: currentImages }] }))
      if (!wsId) { setInput(''); setShowSlashMenu(false); setShowSuggestions(false) }
      return
    }

    if (!overrideText && !wsId) {
      setInput('')
      updateWorkspace(ws.id, { pendingImages: [], inputFiles: [] })
      setShowSlashMenu(false)
      setShowSuggestions(false)
      pushHistory(userMsg)
    }

    // Slash commands
    if (userMsg.startsWith('/')) {
      const parts = userMsg.toLowerCase().split(' ')
      const cmd = parts[0]
      const knownCmds = ['/clear', '/help', '/reset', '/model', '/apikey', '/tokens', '/cost', '/debug', '/hyperedit']
      const handled = await runSlashCommand(cmd, parts, ws)
      if (handled) return
      if (!knownCmds.includes(cmd)) {
        updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'system', text: `🎯 Activating skill: ${cmd.slice(1)}...` }] }))
      }
    }

    // Mode prefixes
    const modePrefix = MODE_PREFIXES[ws.mode]
    const finalMsg = modePrefix ? modePrefix(userMsg) : userMsg

    const msgId = nextId()
    updateWorkspace(ws.id, prev => ({
      ...prev,
      messages: [...prev.messages, { id: msgId, type: 'user', text: userMsg, images: currentImages.length > 0 ? currentImages : undefined }],
      isProcessing: true,
    }))
    taskStartsRef.current.set(ws.id, Date.now())
    scheduleScroll(ws.id)

    const imageParts = currentImages.map(img => ({ type: 'image' as const, image: { type: 'image' as const, dataUrl: img.dataUrl, mimeType: img.mimeType } }))

    try {
      await window.koda.sendMessage(ws.id, msgId, finalMsg, imageParts.length > 0 ? imageParts : undefined)
      const raf = rafRefs.current.get(ws.id)
      if (raf != null) { cancelAnimationFrame(raf); rafRefs.current.set(ws.id, null) }
      const chunk = chunkBuffersRef.current.get(ws.id)
      chunkBuffersRef.current.set(ws.id, '')
      updateWorkspace(ws.id, prev => {
        const updated = [...prev.messages]
        const last = updated[updated.length - 1]
        if (!last) return prev
        if (chunk) {
          if (last.type === 'assistant' && !last.done) {
            updated[updated.length - 1] = { ...last, text: (last.text || '') + chunk, done: true }
          } else {
            updated.push({ id: nextId(), type: 'assistant', text: chunk, done: true })
          }
        } else if (last.type === 'assistant') {
          updated[updated.length - 1] = { ...last, done: true }
        }
        return { ...prev, messages: updated }
      })
    } catch (err: any) {
      chunkBuffersRef.current.set(ws.id, '')
      updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'error', text: err.message || String(err) }] }))
    } finally {
      updateWorkspace(ws.id, { isProcessing: false })
    }
  }, [activeId, workspaces, input, updateWorkspace, setInput, setShowSlashMenu, setShowSuggestions, pushHistory, runSlashCommand, chunkBuffersRef, rafRefs, taskStartsRef, scheduleScroll])

  const handleSend = useCallback((overrideText?: string, overrideImages?: AttachedFile[]) => {
    return handleSendForWs(overrideText, overrideImages, undefined)
  }, [handleSendForWs])

  // ── Path / directory change ────────────────────────────────────────────────
  const handlePathClick = useCallback(async () => {
    if (!activeId) return
    const ws = workspaces.find(w => w.id === activeId)
    if (!ws) return
    const newPath = await window.koda.selectDirectory()
    if (!newPath) return
    setInitializing(true)
    const res = await window.koda.cd(ws.id, newPath)
    if (res.success) {
      setAllFiles([])
      updateWorkspace(ws.id, { agentInfo: res.info, cwd: res.info.cwd })
      updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'system', text: `📂 Working directory changed to: ${newPath}. Context reset.` }] }))
    } else {
      updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'error', text: `❌ Failed to change directory: ${res.error}` }] }))
    }
    setInitializing(false)
  }, [activeId, workspaces, updateWorkspace, setInitializing, setAllFiles])

  // ── Rollback ───────────────────────────────────────────────────────────────
  const handleRollback = useCallback(async (msgId: number) => {
    if (!activeId) return
    const ws = workspaces.find(w => w.id === activeId)
    if (!ws || ws.isProcessing) return
    const confirmed = window.confirm('Rollback to this message?\n\nThis will restore all files to the state they were in BEFORE this message was sent, and erase all subsequent conversation history.')
    if (!confirmed) return
    const res = await window.koda.snapshotRestore(ws.id, msgId)
    if (!res.success) {
      updateWorkspace(ws.id, prev => ({ ...prev, messages: [...prev.messages, { id: nextId(), type: 'error', text: `Rollback failed: ${res.error}` }] }))
      return
    }
    updateWorkspace(ws.id, prev => {
      const idx = prev.messages.findIndex(m => m.id === msgId)
      return { ...prev, messages: idx === -1 ? prev.messages : prev.messages.slice(0, idx) }
    })
  }, [activeId, workspaces, updateWorkspace])

  // ── Stop ──────────────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    if (!activeId) return
    const ws = workspaces.find(w => w.id === activeId)
    if (!ws) return
    const raf = rafRefs.current.get(ws.id)
    if (raf != null) { cancelAnimationFrame(raf); rafRefs.current.set(ws.id, null) }
    chunkBuffersRef.current.set(ws.id, '')
    updateWorkspace(ws.id, { isProcessing: false })
    await window.koda.softReset(ws.id)
  }, [activeId, workspaces, updateWorkspace, chunkBuffersRef, rafRefs])

  // ── Paste (images) ─────────────────────────────────────────────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!activeId) return
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = () => updateWorkspace(activeId, prev => ({
            ...prev,
            pendingImages: [...prev.pendingImages, { dataUrl: reader.result as string, mimeType: file.type, name: file.name || 'pasted.png', isImage: file.type.startsWith('image/') }],
          }))
          reader.readAsDataURL(file)
        }
      }
    }
  }, [activeId, updateWorkspace])

  return { handleSend, handleSendForWs, handlePathClick, handleRollback, handleStop, handlePaste }
}
