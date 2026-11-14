import { beforeEach, describe, expect, it, vi } from 'vitest'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))

vi.mock('node-pty', () => ({ spawn: spawnMock }))
vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}))

import { BrowserWindow } from 'electron'
import { KillPtyTool, ListPtyTool, ShellInputTool, ShellTool } from '../shell.js'

describe('PTY control tools (empty registry)', () => {
  it('kill_pty fails for unknown PID', async () => {
    const result = await new KillPtyTool().execute({ pid: 999 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('No active background PTY')
  })

  it('list_pty reports no processes', async () => {
    const result = await new ListPtyTool().execute({})
    expect(result.success).toBe(true)
    expect(result.output).toContain('No background PTY processes')
  })

  it('shell_input fails for unknown PID', async () => {
    const result = await new ShellInputTool().execute({ pid: 999, input: 'y\n' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('No running background PTY')
  })
})

describe('ShellTool.isReadOnly', () => {
  it('treats known safe prefixes as read-only', () => {
    const tool = new ShellTool()
    for (const cmd of [
      'ls -la',
      'cat package.json',
      'echo hi',
      'pwd',
      'whoami',
      'grep foo',
      'git status',
      'git log',
      'git diff',
      'dir',
      'type a.txt',
    ]) {
      expect(tool.isReadOnly(cmd)).toBe(true)
    }
  })

  it('flags mutating commands as non-read-only', () => {
    const tool = new ShellTool()
    for (const cmd of ['rm -rf node_modules', 'npm install', 'git add .', 'touch x.txt']) {
      expect(tool.isReadOnly(cmd)).toBe(false)
    }
  })
})

describe('ShellTool approval store', () => {
  it('starts empty and stores approved commands', () => {
    expect(ShellTool.getApprovedCommands()).toEqual({ base: [], full: [] })

    ShellTool.updateApprovedCommands({ base: ['npm'], full: ['npm run dev'] })
    expect(ShellTool.getApprovedCommands()).toEqual({ base: ['npm'], full: ['npm run dev'] })

    ShellTool.updateApprovedCommands({ base: [] })
    expect(ShellTool.getApprovedCommands().base).toEqual([])
  })
})

describe('ShellTool.execute', () => {
  beforeEach(() => {
    spawnMock.mockReset()
  })

  it('fails when a required parameter is missing', async () => {
    const result = await new ShellTool().execute({ command: 'ls' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Missing required parameter')
  })

  it('blocks destructive commands regardless of approval', async () => {
    const result = await new ShellTool().execute({ command: 'rm -rf /', description: 'wipe' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Blocked')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('waits for user approval and spawns the PTY afterwards', async () => {
    const fakeWindow = { webContents: { send: vi.fn() } }
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([fakeWindow as never])

    const fakeProcess = {
      pid: 1234,
      write: vi.fn(),
      kill: vi.fn(),
      resize: vi.fn(),
      onData: vi.fn(),
      onExit: vi.fn(),
    }
    spawnMock.mockReturnValue(fakeProcess)

    const resultPromise = new ShellTool().execute({ command: 'npm install', description: 'install deps' })
    // A aprovação fica pendente até resolvermos manualmente
    ShellTool.resolveApproval(true)
    const result = await resultPromise

    expect(result.success).toBe(true)
    expect(result.output).toContain('PID: 1234')
    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(fakeWindow.webContents.send).toHaveBeenCalledWith(
      'agent:update',
      expect.objectContaining({ type: 'shell_awaiting_approval' }),
    )
  })

  it('rejects the command when the user denies approval', async () => {
    const fakeWindow = { webContents: { send: vi.fn() } }
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([fakeWindow as never])
    spawnMock.mockReturnValue({
      pid: 5,
      write: vi.fn(),
      kill: vi.fn(),
      resize: vi.fn(),
      onData: vi.fn(),
      onExit: vi.fn(),
    })

    const resultPromise = new ShellTool().execute({ command: 'npm install', description: 'install deps' })
    ShellTool.resolveApproval(false)
    const result = await resultPromise

    expect(result.success).toBe(false)
    expect(result.error).toContain('rejected by user')
    expect(spawnMock).not.toHaveBeenCalled()
  })
})
