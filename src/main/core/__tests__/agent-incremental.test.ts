import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Agent } from '../agent.js'
import type { BaseProvider, StreamChunk, Message } from '../../providers/base.js'

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-agent-test-'))
  fs.writeFileSync(path.join(tmp, 'a.txt'), 'olá conteúdo do arquivo')
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('Agent — execução incremental de tools', () => {
  it('entrega o resultado da tool ao modelo antes da próxima decisão', async () => {
    let calls = 0
    let secondCallSawToolResult = false

    const fakeProvider = {
      providerName: 'Fake',
      chat: async function* (messages: Message[]): AsyncGenerator<StreamChunk> {
        calls++
        if (calls === 1) {
          // 1ª rodada: o modelo pede para ler a.txt
          yield { type: 'text', content: 'Vou ler o arquivo.' }
          yield { type: 'tool_call_start', toolCall: { id: 'c1', name: 'file_read' } }
          yield { type: 'tool_call_end', toolCall: { id: 'c1', name: 'file_read', arguments: { path: 'a.txt' } } }
          return
        }
        // 2ª rodada: o modelo JÁ deve ter recebido o resultado da tool
        const sawTool = messages.some(
          (m) => m.role === 'tool' && typeof m.content === 'string' && m.content.includes('olá conteúdo'),
        )
        secondCallSawToolResult = sawTool
        yield { type: 'text', content: sawTool ? 'Li o arquivo e tenho o conteúdo.' : 'Não vi o conteúdo.' }
      },
    } as unknown as BaseProvider

    const agent = new Agent()
    agent.setCwd(tmp)
    ;(agent as any).provider = fakeProvider

    const texts: string[] = []
    await agent.processMessage(
      'leia a.txt',
      (t) => texts.push(t),
      () => {},
      () => {},
      () => {},
      () => {},
    )

    expect(calls).toBe(2)
    expect(secondCallSawToolResult).toBe(true)

    const history = agent.getHistory()
    const roles = history.map((m) => m.role)
    expect(roles).toEqual(['system', 'user', 'assistant', 'tool', 'assistant'])

    const toolMsg = history.find((m) => m.role === 'tool')
    expect(String(toolMsg.content)).toContain('olá conteúdo')

    expect(texts.join(' ')).toContain('Li o arquivo e tenho o conteúdo.')
  })

  it('emite ids únicos pareados start/end e 1 resultado por arquivo em multi-tool', async () => {
    fs.writeFileSync(path.join(tmp, 'b.txt'), 'conteúdo do arquivo B')

    const startIds: string[] = []
    const endIds: string[] = []
    let providerCalls = 0
    let secondCallSawBoth = false

    const fakeProvider = {
      providerName: 'Fake',
      chat: async function* (messages: Message[]): AsyncGenerator<StreamChunk> {
        providerCalls++
        if (providerCalls === 1) {
          // Simula uma resposta com VÁRIAS tool calls de file_read
          yield { type: 'text', content: 'Vou ler dois arquivos.' }
          yield { type: 'tool_call_start', toolCall: { id: 'c1', name: 'file_read' } }
          yield { type: 'tool_call_end', toolCall: { id: 'c1', name: 'file_read', arguments: { path: 'a.txt' } } }
          yield { type: 'tool_call_start', toolCall: { id: 'c2', name: 'file_read' } }
          yield { type: 'tool_call_end', toolCall: { id: 'c2', name: 'file_read', arguments: { path: 'b.txt' } } }
          return
        }
        const texts = messages.filter((m) => m.role === 'tool').map((m) => String(m.content))
        secondCallSawBoth =
          texts.some((t) => t.includes('olá conteúdo')) && texts.some((t) => t.includes('conteúdo do arquivo B'))
        yield { type: 'text', content: 'Terminei.' }
      },
    } as unknown as BaseProvider

    const agent = new Agent()
    agent.setCwd(tmp)
    ;(agent as any).provider = fakeProvider

    await agent.processMessage(
      'leia a.txt e b.txt',
      () => {},
      (id) => startIds.push(id),
      () => {},
      (id) => endIds.push(id),
      () => {},
    )

    expect(providerCalls).toBe(2)
    expect(secondCallSawBoth).toBe(true)

    // Cada tool call tem um id único e o end casa com o start (ordem de shift)
    expect(startIds).toHaveLength(2)
    expect(endIds).toHaveLength(2)
    expect(new Set(startIds).size).toBe(2)
    expect(endIds).toEqual(startIds)

    // Exatamente 1 resultado por arquivo, sem duplicação
    const history = agent.getHistory()
    const toolMsgs = history.filter((m) => m.role === 'tool')
    expect(toolMsgs).toHaveLength(2)
    expect(String(toolMsgs[0].content)).toContain('olá conteúdo')
    expect(String(toolMsgs[1].content)).toContain('conteúdo do arquivo B')
  })
})
