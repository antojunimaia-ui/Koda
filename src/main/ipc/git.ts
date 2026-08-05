import { ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function gitExec(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd })
  return stdout.trim()
}

export function registerGitHandlers() {
  ipcMain.handle('git:info', async (_event, cwd: string) => {
    try {
      await gitExec(cwd, ['rev-parse', '--is-inside-work-tree'])
      const branch = await gitExec(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
      const branches = (await gitExec(cwd, ['branch', '--format=%(refname:short)']))
        .split('\n').map(b => b.trim()).filter(Boolean)

      let remoteBranches: string[] = []
      try {
        remoteBranches = (await gitExec(cwd, ['branch', '-r', '--format=%(refname:short)']))
          .split('\n')
          .map(b => b.trim().replace(/^origin\//, ''))
          .filter(b => b && b !== 'HEAD' && !branches.includes(b))
      } catch { /* no remotes */ }

      return { success: true, branch, branches: [...branches, ...remoteBranches] }
    } catch {
      return { success: false, branch: null, branches: [] }
    }
  })

  ipcMain.handle('git:checkout', async (_event, cwd: string, branch: string) => {
    try {
      try {
        await gitExec(cwd, ['checkout', branch])
      } catch {
        await gitExec(cwd, ['checkout', '-b', branch, `origin/${branch}`])
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('git:status', async (_event, cwd: string) => {
    try {
      const stdout = await gitExec(cwd, ['status', '--porcelain', '-u'])
      const files = stdout.trim().split('\n').filter(Boolean).map(line => {
        const xy = line.slice(0, 2)
        const filePath = line.slice(3).trim()
        const x = xy[0]; const y = xy[1]
        const staged = x !== ' ' && x !== '?'
        let status = 'untracked'
        if (x === 'M' || y === 'M') status = 'modified'
        else if (x === 'A') status = 'added'
        else if (x === 'D' || y === 'D') status = 'deleted'
        else if (x === 'R') status = 'renamed'
        else if (x === '?' && y === '?') status = 'untracked'
        return { path: filePath, status, staged, unstaged: y !== ' ' || xy === '??' }
      })
      return { success: true, files }
    } catch (err: any) {
      return { success: false, error: err.message, files: [] }
    }
  })

  ipcMain.handle('git:stage', async (_event, cwd: string, filePath: string) => {
    try {
      await gitExec(cwd, ['add', filePath])
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('git:unstage', async (_event, cwd: string, filePath: string) => {
    try {
      await gitExec(cwd, ['restore', '--staged', filePath])
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('git:stage_all', async (_event, cwd: string) => {
    try {
      await gitExec(cwd, ['add', '-A'])
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('git:commit', async (_event, cwd: string, message: string) => {
    try {
      await gitExec(cwd, ['commit', '-m', message])
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('git:push', async (_event, cwd: string) => {
    try {
      await gitExec(cwd, ['push'])
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('git:pull', async (_event, cwd: string) => {
    try {
      await gitExec(cwd, ['pull', '--rebase'])
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('git:log', async (_event, cwd: string) => {
    try {
      const branch = await gitExec(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
      const stdout = await gitExec(cwd, [
        'log', '--max-count=50',
        '--pretty=format:COMMIT_START%n%H%n%h%n%s%n%b%nCOMMIT_META%n%an%n%ar%n%ai%n%D%nCOMMIT_END',
      ])

      const rawCommits = stdout.split('COMMIT_START\n').filter(Boolean)
      const commits = await Promise.all(rawCommits.map(async raw => {
        const metaIdx = raw.indexOf('\nCOMMIT_META\n')
        const endIdx  = raw.indexOf('\nCOMMIT_END')
        const header  = raw.slice(0, metaIdx).split('\n')
        const meta    = raw.slice(metaIdx + 13, endIdx).split('\n')

        const hash      = (header[0] || '').trim()
        const shortHash = (header[1] || '').trim()
        const subject   = (header[2] || '').trim()
        const body      = header.slice(3).join('\n').trim()
        const author    = (meta[0] || '').trim()
        const date      = (meta[1] || '').trim()
        const fullDate  = (meta[2] || '').trim()
        const refs      = (meta[3] || '').trim()
        const branches  = refs.split(',')
          .map((r: string) => r.trim())
          .filter((r: string) => r && !r.startsWith('HEAD') && !r.startsWith('origin/'))

        let insertions = 0, deletions = 0, filesChanged = 0
        try {
          const stat = await gitExec(cwd, ['show', '--stat', '--format=', hash])
          const statLine = stat.trim().split('\n').pop() || ''
          const ins = statLine.match(/(\d+) insertion/)
          const del = statLine.match(/(\d+) deletion/)
          const fil = statLine.match(/(\d+) file/)
          if (ins) insertions = parseInt(ins[1])
          if (del) deletions = parseInt(del[1])
          if (fil) filesChanged = parseInt(fil[1])
        } catch { /* stat unavailable */ }

        return { hash, shortHash, message: subject, body, author, date, fullDate, branch: branches[0] || null, insertions, deletions, filesChanged }
      }))

      return { success: true, commits, currentBranch: branch.trim() }
    } catch (err: any) {
      return { success: false, error: err.message, commits: [], currentBranch: '' }
    }
  })
}
