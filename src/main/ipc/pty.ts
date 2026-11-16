import { ipcMain } from 'electron'
import { Agent } from '../core/agent.js'
import { sendCtrlC, killPty, startInteractiveTerminal, writeToPty, resizePty } from '../tools/shell.js'
import { IPC_CHANNELS } from '../../shared/ipc.js'

export function registerPtyHandlers(agents: Map<string, Agent>) {
  ipcMain.handle(IPC_CHANNELS.pty.ctrlC, async (_event, pid: number) => {
    const ok = sendCtrlC(pid)
    return { success: ok, error: ok ? undefined : `No active PTY with PID ${pid}` }
  })

  ipcMain.handle(IPC_CHANNELS.pty.kill, async (_event, pid: number) => {
    const ok = killPty(pid)
    return { success: ok, error: ok ? undefined : `No active PTY with PID ${pid}` }
  })

  ipcMain.handle(IPC_CHANNELS.pty.start, async (event, workspaceId?: string, cwd?: string) => {
    let finalCwd = cwd
    if (!finalCwd && workspaceId) {
      finalCwd = agents.get(workspaceId)?.getInfo().cwd
    }
    if (!finalCwd) finalCwd = process.cwd()
    const pid = startInteractiveTerminal(finalCwd, event.sender)
    return { success: true, pid }
  })

  ipcMain.handle(IPC_CHANNELS.pty.write, async (_event, pid: number, data: string) => {
    const ok = writeToPty(pid, data)
    return { success: ok }
  })

  ipcMain.handle(IPC_CHANNELS.pty.resize, async (_event, pid: number, cols: number, rows: number) => {
    const ok = resizePty(pid, cols, rows)
    return { success: ok }
  })
}
