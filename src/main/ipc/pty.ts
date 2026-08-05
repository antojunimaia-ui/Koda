import { ipcMain } from 'electron'
import { Agent } from '../core/agent.js'
import { sendCtrlC, killPty, startInteractiveTerminal, writeToPty, resizePty } from '../tools/shell.js'

export function registerPtyHandlers(agents: Map<string, Agent>) {
  ipcMain.handle('pty:ctrl_c', async (_event, pid: number) => {
    const ok = sendCtrlC(pid)
    return { success: ok, error: ok ? undefined : `No active PTY with PID ${pid}` }
  })

  ipcMain.handle('pty:kill', async (_event, pid: number) => {
    const ok = killPty(pid)
    return { success: ok, error: ok ? undefined : `No active PTY with PID ${pid}` }
  })

  ipcMain.handle('pty:start', async (_event, workspaceId?: string, cwd?: string) => {
    let finalCwd = cwd
    if (!finalCwd && workspaceId) {
      finalCwd = agents.get(workspaceId)?.getInfo().cwd
    }
    if (!finalCwd) finalCwd = process.cwd()
    const pid = startInteractiveTerminal(finalCwd)
    return { success: true, pid }
  })

  ipcMain.handle('pty:write', async (_event, pid: number, data: string) => {
    const ok = writeToPty(pid, data)
    return { success: ok }
  })

  ipcMain.handle('pty:resize', async (_event, pid: number, cols: number, rows: number) => {
    const ok = resizePty(pid, cols, rows)
    return { success: ok }
  })
}
