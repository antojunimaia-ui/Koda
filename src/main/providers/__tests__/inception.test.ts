import { describe, expect, it, vi } from 'vitest'
import { InceptionProvider } from '../inception.js'

function makeRegistry() {
  return { toOpenAITools: () => [] } as any
}

async function collect(gen: AsyncGenerator<any>) {
  const out: any[] = []
  for await (const c of gen) out.push(c)
  return out
}

describe('InceptionProvider', () => {
  it('streams text, tool calls and parses tool arguments (OpenAI-compatible)', async () => {
    const provider = new InceptionProvider('mercury-3', 'test-key', 1000, 0.3)
    const create = vi.fn(async function* () {
      yield { choices: [{ delta: { content: 'Hello' }, finish_reason: null }] }
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_1',
                  function: { name: 'file_read', arguments: '{"path":"a.txt"}' },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }
      yield { choices: [{ delta: {}, finish_reason: 'tool_calls' }] }
    })
    ;(provider as any).client = { chat: { completions: { create } } }

    const chunks = await collect(provider.chat([{ role: 'user', content: 'hi' }], makeRegistry()))

    expect(chunks.find((c) => c.type === 'text' && c.content === 'Hello')).toBeTruthy()
    expect(chunks.find((c) => c.type === 'tool_call_start')?.toolCall).toMatchObject({
      id: 'call_1',
      name: 'file_read',
    })
    expect(chunks.find((c) => c.type === 'tool_call_end')?.toolCall.arguments).toEqual({ path: 'a.txt' })
    expect(chunks.every((c) => c.type !== 'done')).toBe(true)
  })

  it('emits done when the model stops', async () => {
    const provider = new InceptionProvider('mercury-3', 'test-key', 1000, 0.3)
    const create = vi.fn(async function* () {
      yield { choices: [{ delta: { content: 'bye' }, finish_reason: null }] }
      yield { choices: [{ delta: {}, finish_reason: 'stop' }] }
    })
    ;(provider as any).client = { chat: { completions: { create } } }

    const chunks = await collect(provider.chat([{ role: 'user', content: 'hi' }], makeRegistry()))
    expect(chunks.at(-1)?.type).toBe('done')
  })

  it('yields an error chunk when the API call fails', async () => {
    const provider = new InceptionProvider('mercury-3', 'test-key', 1000, 0.3)
    const create = vi.fn(async function* () {
      throw new Error('boom')
    })
    ;(provider as any).client = { chat: { completions: { create } } }

    const chunks = await collect(provider.chat([{ role: 'user', content: 'hi' }], makeRegistry()))
    expect(chunks[0]?.type).toBe('error')
    expect(chunks[0]?.error).toContain('Inception API error')
    expect(chunks[0]?.error).toContain('boom')
  })
})
