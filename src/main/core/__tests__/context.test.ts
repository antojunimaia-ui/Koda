import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gatherProjectContext } from '../context.js'

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-context-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function mkdir(p: string) {
  fs.mkdirSync(path.join(tmp, p), { recursive: true })
}

function writeFile(p: string, content: string) {
  fs.writeFileSync(path.join(tmp, p), content)
}

describe('gatherProjectContext', () => {
  it('detects a Node/React project with yarn', async () => {
    writeFile('package.json', JSON.stringify({ name: 'demo', description: 'A demo', dependencies: { react: '^19' } }))
    writeFile('yarn.lock', '')
    const ctx = await gatherProjectContext(tmp)

    expect(ctx.name).toBe(path.basename(tmp))
    expect(ctx.language).toBe('TypeScript/JavaScript')
    expect(ctx.framework).toBe('React')
    expect(ctx.packageManager).toBe('yarn')
    expect(ctx.description).toBe('A demo')
    expect(ctx.summary).toContain('Project:')
    expect(ctx.summary).toContain('Language: TypeScript/JavaScript')
  })

  it('detects a Python project', async () => {
    writeFile('pyproject.toml', '')
    const ctx = await gatherProjectContext(tmp)
    expect(ctx.language).toBe('Python')
  })

  it('detects a Rust project', async () => {
    writeFile('Cargo.toml', '')
    const ctx = await gatherProjectContext(tmp)
    expect(ctx.language).toBe('Rust')
  })

  it('detects a Go project', async () => {
    writeFile('go.mod', '')
    const ctx = await gatherProjectContext(tmp)
    expect(ctx.language).toBe('Go')
  })

  it('lists top-level files in the summary', async () => {
    writeFile('package.json', '{}')
    writeFile('readme.md', '# hi')
    const ctx = await gatherProjectContext(tmp)
    expect(ctx.summary).toContain('Files:')
    expect(ctx.summary).toContain('package.json')
    expect(ctx.summary).toContain('readme.md')
  })

  it('handles an empty directory gracefully', async () => {
    const ctx = await gatherProjectContext(tmp)
    expect(ctx.summary).toContain('Project:')
    expect(ctx.language).toBeUndefined()
  })
})
