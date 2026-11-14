import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FileEditTool } from '../file-edit.js'
import { FileReadTool } from '../file-read.js'
import { FileWriteTool } from '../file-write.js'
import { invalidateKodaIgnoreCache } from '../../utils/kodaignore.js'
import { clearTrackedFiles, trackFile } from '../../services/file-tracker.js'

let tmp: string
let originalCwd: string

beforeEach(() => {
  invalidateKodaIgnoreCache()
  clearTrackedFiles()
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-tools-'))
  originalCwd = process.cwd()
  process.chdir(tmp)
})

afterEach(() => {
  process.chdir(originalCwd)
  fs.rmSync(tmp, { recursive: true, force: true })
  invalidateKodaIgnoreCache()
  clearTrackedFiles()
})

function writeFile(rel: string, content: string) {
  const abs = path.join(tmp, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

describe('FileWriteTool', () => {
  it('creates a file and its parent directories', async () => {
    const tool = new FileWriteTool()
    const result = await tool.execute({ path: 'src/app.ts', content: 'export const x = 1;\n' })

    expect(result.success).toBe(true)
    expect(result.output).toContain('Created')
    expect(fs.existsSync(path.join(tmp, 'src/app.ts'))).toBe(true)
    expect(fs.readFileSync(path.join(tmp, 'src/app.ts'), 'utf-8')).toBe('export const x = 1;\n')
  })

  it('overwrites an existing file', async () => {
    writeFile('a.txt', 'old')
    const tool = new FileWriteTool()
    const result = await tool.execute({ path: 'a.txt', content: 'new' })

    expect(result.success).toBe(true)
    expect(result.output).toContain('Updated')
    expect(fs.readFileSync(path.join(tmp, 'a.txt'), 'utf-8')).toBe('new')
  })

  it('fails when a required parameter is missing', async () => {
    const tool = new FileWriteTool()
    const result = await tool.execute({})
    expect(result.success).toBe(false)
    expect(result.error).toContain('Missing required parameter')
  })
})

describe('FileReadTool', () => {
  it('reads a file with numbered lines', async () => {
    writeFile('f.ts', 'line1\nline2\nline3')
    const result = await new FileReadTool().execute({ path: 'f.ts' })

    expect(result.success).toBe(true)
    expect(result.output).toContain('(3 lines')
    expect(result.output).toContain('line1')
    expect(result.output).toContain('line3')
  })

  it('respects start_line/end_line ranges', async () => {
    writeFile('f.txt', 'a\nb\nc\nd\n')
    const result = await new FileReadTool().execute({ path: 'f.txt', start_line: 2, end_line: 3 })

    expect(result.success).toBe(true)
    expect(result.output).toContain('[showing lines 2-3]')
    expect(result.output).toContain('b')
    expect(result.output).toContain('c')
    expect(result.output).not.toContain('│ a')
    expect(result.output).not.toContain('│ d')
  })

  it('fails when the file does not exist', async () => {
    const result = await new FileReadTool().execute({ path: 'missing.txt' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('File not found')
  })
})

describe('FileEditTool', () => {
  it('replaces an exact target string', async () => {
    writeFile('edit.ts', 'const a = 1;\nconst b = 2;\n')
    const result = await new FileEditTool().execute({
      path: 'edit.ts',
      target: 'a = 1',
      replacement: 'a = 10',
    })

    expect(result.success).toBe(true)
    expect(result.output).toContain('Edited')
    const content = fs.readFileSync(path.join(tmp, 'edit.ts'), 'utf-8')
    expect(content).toContain('const a = 10;')
    expect(content).not.toContain('const a = 1;')
  })

  it('fails when the target string is not found', async () => {
    writeFile('edit.ts', 'const a = 1;\n')
    const result = await new FileEditTool().execute({
      path: 'edit.ts',
      target: 'zzz',
      replacement: 'yyy',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Target string not found')
    expect(fs.readFileSync(path.join(tmp, 'edit.ts'), 'utf-8')).toBe('const a = 1;\n')
  })

  it('fails when edits target a .kodaignore-restricted file', async () => {
    writeFile('.kodaignore', '*.secret\n')
    writeFile('data.secret', 'top secret')
    const result = await new FileEditTool().execute({
      path: 'data.secret',
      target: 'secret',
      replacement: 'hidden',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Access denied')
    expect(fs.readFileSync(path.join(tmp, 'data.secret'), 'utf-8')).toBe('top secret')
  })
})

describe('FileReadTool — guard anti-releitura', () => {
  it('avoids re-reading an unchanged file already read in this session', async () => {
    writeFile('re.txt', 'alpha')
    const abs = path.join(tmp, 're.txt')

    const first = await new FileReadTool().execute({ path: 're.txt' })
    expect(first.success).toBe(true)
    expect(first.output).toContain('alpha')

    // Simula o registro do ToolRegistry após a primeira leitura
    trackFile(abs, 'read')

    // Segunda leitura sem mudança → aviso, não relê
    const second = await new FileReadTool().execute({ path: 're.txt' })
    expect(second.success).toBe(true)
    expect(second.output).toContain('não mudou')
    expect(second.output).not.toContain('alpha')

    // Após modificar, a releitura volta a ser permitida
    writeFile('re.txt', 'omega')
    trackFile(abs, 'modified')

    const third = await new FileReadTool().execute({ path: 're.txt' })
    expect(third.success).toBe(true)
    expect(third.output).toContain('omega')
  })
})
