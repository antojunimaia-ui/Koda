import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SearchTool } from '../search.js'

let tmp: string
let originalCwd: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-search-'))
  originalCwd = process.cwd()
  process.chdir(tmp)
})

afterEach(() => {
  process.chdir(originalCwd)
  fs.rmSync(tmp, { recursive: true, force: true })
})

function writeFile(rel: string, content: string) {
  const abs = path.join(tmp, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

async function manualSearch(tool: SearchTool, pattern: string, opts: Record<string, unknown> = {}) {
  return (tool as any).manualSearch(
    pattern,
    opts.path || tmp,
    opts.include,
    opts.caseInsensitive || false,
    opts.maxResults || 50,
  ) as Promise<string[]>
}

describe('SearchTool (manualSearch)', () => {
  it('finds matching lines with file and line number', async () => {
    writeFile('a.txt', 'hello world\nsecond line\n')
    writeFile('b.md', 'nothing here\n')

    const lines = await manualSearch(new SearchTool(), 'world')
    expect(lines.some((l) => l.includes('a.txt') && l.includes('1') && l.includes('hello world'))).toBe(true)
    expect(lines.some((l) => l.includes('b.md'))).toBe(false)
  })

  it('honors case-insensitive matching', async () => {
    writeFile('a.txt', 'Hello World\n')
    const result = await manualSearch(new SearchTool(), 'hello', { caseInsensitive: true })
    expect(result).toHaveLength(1)
  })

  it('filters by include glob', async () => {
    writeFile('a.txt', 'needle\n')
    writeFile('b.md', 'needle\n')
    const result = await manualSearch(new SearchTool(), 'needle', { include: '*.txt' })
    expect(result.some((l) => l.includes('a.txt'))).toBe(true)
    expect(result.some((l) => l.includes('b.md'))).toBe(false)
  })

  it('respects maxResults', async () => {
    writeFile('a.txt', 'x\nx\nx\nx\n')
    const result = await manualSearch(new SearchTool(), 'x', { maxResults: 2 })
    expect(result).toHaveLength(2)
  })

  it('skips ignored directories like node_modules', async () => {
    writeFile('node_modules/pkg/index.js', 'needle\n')
    writeFile('src/index.ts', 'needle\n')
    const result = await manualSearch(new SearchTool(), 'needle')
    expect(result.some((l) => l.includes('index.ts'))).toBe(true)
    expect(result.some((l) => l.includes('node_modules'))).toBe(false)
  })
})

describe('SearchTool.execute', () => {
  it('returns a success result with matches (rg or manual fallback)', async () => {
    writeFile('a.txt', 'hello world\n')
    const result = await new SearchTool().execute({ pattern: 'world' })

    expect(result.success).toBe(true)
    expect(result.output).toContain('Found 1 match')
    expect(result.output).toContain('a.txt')
  })

  it('reports when nothing matches', async () => {
    writeFile('a.txt', 'hello\n')
    const result = await new SearchTool().execute({ pattern: 'zzz' })
    expect(result.success).toBe(true)
    expect(result.output).toContain('No matches found')
  })
})
