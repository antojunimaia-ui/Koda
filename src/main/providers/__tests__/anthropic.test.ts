import { describe, expect, it, vi } from 'vitest'
import { AnthropicProvider } from '../anthropic.js'

function makeRegistry() {
  return { toAnthropicTools: () => [] } as any
}

async function collect(gen: AsyncGenerator<any>) {
  const out: any[] = []
  for await (const c of gen) out.push(c)
  return out
}

describe('AnthropicProvider', () => {
  it('streams text and reassembles incremental tool arguments', async () => {
    const provider = new AnthropicProvider('claude-sonnet-4', 'test-key', 1000, 0.3)
    const stream = vi.fn(async function* () {
      yield { type: 'content_block_start', content_block: { type: 'text', text: 'Hi' } }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } }
      yield { type: 'content_block_start', content_block: { type: 'tool_use', id: 'toolu_1', name: 'file_read' } }
      yield { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"path":' } }
      yield { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '"a.txt"}' } }
      yield { type: 'content_block_stop' }
      yield { type: 'message_stop' }
    })
    ;(provider as any).client = { messages: { stream } }

    const chunks = await collect(provider.chat([{ role: 'user', content: 'hi' }], makeRegistry()))

    expect(chunks.find((c) => c.type === 'text' && c.content === 'Hi')).toBeTruthy()
    expect(chunks.find((c) => c.type === 'tool_call_start')?.toolCall).toMatchObject({
      id: 'toolu_1',
      name: 'file_read',
    })
    expect(chunks.find((c) => c.type === 'tool_call_end')?.toolCall.arguments).toEqual({ path: 'a.txt' })
    expect(chunks.at(-1)?.type).toBe('done')
  })

  it('yields an error chunk on parse failure of tool args', async () => {
    const provider = new AnthropicProvider('claude-sonnet-4', 'test-key', 1000, 0.3)
    const stream = vi.fn(async function* () {
      yield { type: 'content_block_start', content_block: { type: 'tool_use', id: 'toolu_1', name: 'search' } }
      yield { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{not-json' } }
      yield { type: 'content_block_stop' }
      yield { type: 'message_stop' }
    })
    ;(provider as any).client = { messages: { stream } }

    const chunks = await collect(provider.chat([{ role: 'user', content: 'hi' }], makeRegistry()))
    expect(chunks.some((c) => c.type === 'error' && c.error?.includes('Failed to parse tool arguments'))).toBe(true)
  })
})
