import { describe, expect, it } from 'vitest'
import type { BaseProvider } from '../../providers/base.js'
import { buildCompactionPrompt, summarizeConversation } from '../context-compactor.js'

function providerReturning(chunks: Array<{ type: string; content?: string; error?: string }>) {
  async function* gen() {
    for (const c of chunks) yield c
  }
  return { chat: () => gen() } as unknown as BaseProvider
}

const MESSAGES = [
  { role: 'system' as const, content: 'You are Koda.' },
  { role: 'user' as const, content: 'Refactor the auth module' },
  {
    role: 'assistant' as const,
    content: 'I will read the auth file.',
    toolCalls: [{ id: 'c1', name: 'file_read', arguments: { path: 'src/auth.ts' } }],
  },
  { role: 'tool' as const, content: 'export function login() {}', toolCallId: 'c1' },
]

describe('buildCompactionPrompt', () => {
  it('includes the mandatory summary sections', () => {
    const prompt = buildCompactionPrompt(MESSAGES)
    for (const section of ['OBJETIVO', 'DECISÕES', 'ARQUIVOS', 'RESULTADOS', 'PENDÊNCIAS', 'REGRAS/PREFERÊNCIAS']) {
      expect(prompt).toContain(section)
    }
  })

  it('includes the conversation transcript with roles and tool calls', () => {
    const prompt = buildCompactionPrompt(MESSAGES)
    expect(prompt).toContain('[user]')
    expect(prompt).toContain('Refactor the auth module')
    expect(prompt).toContain('[tool_calls:')
    expect(prompt).toContain('src/auth.ts')
    expect(prompt).toContain('export function login() {}')
  })
})

describe('summarizeConversation', () => {
  it('concatenates text chunks into the summary', async () => {
    const provider = providerReturning([
      { type: 'text', content: 'Resumo parte 1 ' },
      { type: 'text', content: 'e parte 2.' },
      { type: 'done' },
    ])
    const summary = await summarizeConversation(provider, MESSAGES)
    expect(summary).toBe('Resumo parte 1 e parte 2.')
  })

  it('rejects when the provider emits an error chunk', async () => {
    const provider = providerReturning([{ type: 'error', error: 'API down' }])
    await expect(summarizeConversation(provider, MESSAGES)).rejects.toThrow(/API down/)
  })

  it('rejects when the summary comes back empty', async () => {
    const provider = providerReturning([{ type: 'text', content: '   ' }, { type: 'done' }])
    await expect(summarizeConversation(provider, MESSAGES)).rejects.toThrow(/empty summary/)
  })
})
