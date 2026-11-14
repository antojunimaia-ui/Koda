import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runHyperEdit } from '../hyperedit.js'

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-hyperedit-test-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function writeFile(rel: string, content = '') {
  const abs = path.join(tmp, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

const noop = () => {}

describe('runHyperEdit (validação e parsing)', () => {
  it('requer uma tarefa', async () => {
    await expect(runHyperEdit('--agents 2', tmp, noop)).rejects.toThrow(/Use: \/hyperedit/)
  })

  it('rejeita arquivo inexistente', async () => {
    writeFile('a.ts', 'export const a = 1;\n')
    await expect(
      runHyperEdit('refactor --files a.ts missing.ts', tmp, noop),
    ).rejects.toThrow('Arquivo não encontrado: missing.ts')
  })

  it('rejeita arquivos fora do workspace', async () => {
    writeFile('a.ts', 'x')
    await expect(
      runHyperEdit('task --files ../evil.ts', tmp, noop),
    ).rejects.toThrow('Arquivo fora do workspace')
  })

  it('rejeita plano vazio do coordenador', async () => {
    writeFile('a.ts', 'x')
    const coordinator = async () => ({ agents: [{ files: [], prompt: 'task' }] })
    await expect(
      runHyperEdit('task --files a.ts', tmp, noop, coordinator),
    ).rejects.toThrow(/coordenador não selecionou arquivos/)
  })

  it('rejeita quando nenhum arquivo é editável', async () => {
    writeFile('a.ts', 'x')
    const coordinator = async () => ({ agents: [{ files: ['nope.ts'], prompt: 'task' }] })
    await expect(
      runHyperEdit('task', tmp, noop, coordinator),
    ).rejects.toThrow('Arquivo não encontrado: nope.ts')
  })
})
