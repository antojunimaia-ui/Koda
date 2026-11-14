import { describe, expect, it, vi } from 'vitest'
import { OllamaProvider } from '../ollama.js'

function makeRegistry() {
  return { toOpenAITools: () => [] } as any
}

async function collect(gen: AsyncGenerator<any>) {
  const out: any[] = []
  for await (const c of gen) out.push(c)
  return out
}

describe('OllamaProvider', () => {
  it('streams text and tool calls with parsed arguments', async () => {
    const provider = new OllamaProvider('llama3', '', 2000, 0.7)
    const create = vi.fn(async function* () {
      yield { choices: [{ delta: { content: 'Hi' }, finish_reason: null }] }
      yield {
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: 'c1',
              function: { name: 'file_read', arguments: '{"path":"a.txt"}' },
            }],
          },
          finish_reason: null,
        }],
      }
      yield { choices: [{ delta: {}, finish_reason: 'tool_calls' }] }
    })
    ;(provider as any).client = { chat: { completions: { create } } }

    const chunks = await collect(provider.chat([{ role: 'user', content: 'hi' }], makeRegistry()))

    expect(chunks.find(c => c.type === 'text' && c.content === 'Hi')).toBeTruthy()
    expect(chunks.find(c => c.type === 'tool_call_start')?.toolCall.name).toBe('file_read')
    expect(chunks.find(c => c.type === 'tool_call_end')?.toolCall.arguments).toEqual({ path: 'a.txt' })
    expect(chunks.every(c => c.type !== 'done')).toBe(true)
  })

  it('emits done when the model stops', async () => {
    const provider = new OllamaProvider('llama3', '', 2000, 0.7)
    const create = vi.fn(async function* () {
      yield { choices: [{ delta: { content: 'bye' }, finish_reason: null }] }
      yield { choices: [{ delta: {}, finish_reason: 'stop' }] }
    })
    ;(provider as any).client = { chat: { completions: { create } } }

    const chunks = await collect(provider.chat([{ role: 'user', content: 'hi' }], makeRegistry()))
    expect(chunks.at(-1)?.type).toBe('done')
  })

  it('yields an error chunk with a helpful hint when the API call fails', async () => {
    const provider = new OllamaProvider('llama3', '', 2000, 0.7)
    const create = vi.fn(async function* () {
      throw new Error('ECONNREFUSED')
    })
    ;(provider as any).client = { chat: { completions: { create } } }

    const chunks = await collect(provider.chat([{ role: 'user', content: 'hi' }], makeRegistry()))
    expect(chunks[0]?.type).toBe('error')
    expect(chunks[0]?.error).toContain('Ollama API error')
    expect(chunks[0]?.error).toContain('localhost:11434')
  })
})
