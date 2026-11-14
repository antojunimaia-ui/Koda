import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FileFindTool } from '../file-find.js'
import { invalidateKodaIgnoreCache } from '../../utils/kodaignore.js'

let tmp: string
let originalCwd: string

beforeEach(() => {
  invalidateKodaIgnoreCache()
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-find-'))
  originalCwd = process.cwd()
  process.chdir(tmp)
})

afterEach(() => {
  process.chdir(originalCwd)
  fs.rmSync(tmp, { recursive: true, force: true })
  invalidateKodaIgnoreCache()
})

function writeFile(rel: string, content = '') {
  const abs = path.join(tmp, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

describe('FileFindTool', () => {
  it('finds files matching a glob pattern', async () => {
    writeFile('a.txt')
    writeFile('sub/b.txt')
    writeFile('c.ts')

    const result = await new FileFindTool().execute({ pattern: '**/*.txt' })
    expect(result.success).toBe(true)
    expect(result.output).toContain('a.txt')
    expect(result.output).toContain('sub' + path.sep + 'b.txt')
    expect(result.output).not.toContain('c.ts')
  })

  it('reports when no files match', async () => {
    writeFile('a.txt')
    const result = await new FileFindTool().execute({ pattern: '*.nope' })
    expect(result.success).toBe(true)
    expect(result.output).toContain('No files found')
  })

  it('respects .kodaignore and hides blocked files', async () => {
    writeFile('.kodaignore', 'blocked.txt\n')
    writeFile('blocked.txt')
    writeFile('a.txt')

    const result = await new FileFindTool().execute({ pattern: '**/*.txt' })
    expect(result.success).toBe(true)
    expect(result.output).toContain('a.txt')
    expect(result.output).not.toContain('blocked.txt')
  })

  it('fails when the required pattern parameter is missing', async () => {
    const result = await new FileFindTool().execute({})
    expect(result.success).toBe(false)
    expect(result.error).toContain('Missing required parameter')
  })
})
