import { describe, expect, it, vi } from 'vitest'
import { KoboldCppProvider } from '../koboldcpp.js'

function makeRegistry() {
  return { toOpenAITools: () => [] } as any
}

async function collect(gen: AsyncGenerator<any>) {
  const out: any[] = []
  for await (const c of gen) out.push(c)
  return out
}

describe('KoboldCppProvider', () => {
  it('usa providerName e host preferido 127.0.0.1', async () => {
    const provider = new KoboldCppProvider('local-model', '', 2000, 0.7)
    expect(provider.providerName).toBe('KoboldCpp')
    // client é lazy: forçamos a criação para verificar a URL escolhida.
    const create = vi.fn(async function* () {})
    ;(provider as any).client = { chat: { completions: { create } } }
    expect((provider as any)._resolvedUrl).toBeNull()
  })

  it('streams text and tool calls with parsed arguments', async () => {
    const provider = new KoboldCppProvider('local-model', '', 2000, 0.7, 'http://localhost:5001/v1')
    const create = vi.fn(async function* () {
      yield { choices: [{ delta: { content: 'Hi' }, finish_reason: null }] }
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'c1',
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

    expect(chunks.find((c) => c.type === 'text' && c.content === 'Hi')).toBeTruthy()
    expect(chunks.find((c) => c.type === 'tool_call_start')?.toolCall.name).toBe('file_read')
    expect(chunks.find((c) => c.type === 'tool_call_end')?.toolCall.arguments).toEqual({ path: 'a.txt' })
    expect(chunks.every((c) => c.type !== 'done')).toBe(true)
  })

  it('emite erro amigável quando o servidor está offline', async () => {
    const provider = new KoboldCppProvider('local-model', '', 2000, 0.7, 'http://localhost:5001/v1')
    const create = vi.fn(async function* () {
      throw new Error('connect ECONNREFUSED')
    })
    ;(provider as any).client = { chat: { completions: { create } } }

    const chunks = await collect(provider.chat([{ role: 'user', content: 'hi' }], makeRegistry()))

    const err = chunks.find((c) => c.type === 'error')
    expect(err).toBeTruthy()
    expect(err.error).toContain('KoboldCpp API error')
    expect(err.error).toContain('http://localhost:5001')
  })
})
