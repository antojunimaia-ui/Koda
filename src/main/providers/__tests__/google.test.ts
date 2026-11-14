import { describe, expect, it, vi } from 'vitest'

// google.ts usa `net.fetch` do Electron — trocamos por um mock controlado.
vi.mock('electron', () => {
  return {
    net: {
      fetch: vi.fn(),
    },
  }
})

import { net } from 'electron'
import { GoogleProvider } from '../google.js'

function makeRegistry() {
  return { toGoogleTools: () => [] } as any
}

async function collect(gen: AsyncGenerator<any>) {
  const out: any[] = []
  for await (const c of gen) out.push(c)
  return out
}

function sseResponse(lines: string[]) {
  const enc = new TextEncoder()
  const body = enc.encode(lines.map((l) => `data: ${l}\n`).join('') + '\n')
  return {
    ok: true,
    text: async () => '',
    body: {
      getReader: () => {
        let done = false
        return {
          read: async () => {
            if (done) return { done: true, value: undefined }
            done = true
            return { done: false, value: body }
          },
        }
      },
    },
  }
}

describe('GoogleProvider', () => {
  it('streams text, function calls and done from SSE', async () => {
    const fetchMock = vi.mocked(net.fetch)
    fetchMock.mockResolvedValue(
      sseResponse([
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello' }] } }] }),
        JSON.stringify({
          candidates: [{ content: { parts: [{ functionCall: { name: 'search', args: { q: 'x' } } }] } }],
        }),
        '[DONE]',
      ]) as any,
    )

    const provider = new GoogleProvider('gemini-2.0-flash', 'test-key', 1000, 0.5)
    const chunks = await collect(provider.chat([{ role: 'user', content: 'hi' }], makeRegistry()))

    expect(chunks.find((c) => c.type === 'text' && c.content === 'Hello')).toBeTruthy()
    expect(chunks.find((c) => c.type === 'tool_call_start')?.toolCall.name).toBe('search')
    expect(chunks.find((c) => c.type === 'tool_call_end')?.toolCall.arguments).toEqual({ q: 'x' })
    expect(chunks.at(-1)?.type).toBe('done')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('yields an error chunk when the HTTP request fails', async () => {
    const fetchMock = vi.mocked(net.fetch)
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'bad key' } as any)

    const provider = new GoogleProvider('gemini-2.0-flash', 'test-key', 1000, 0.5)
    const chunks = await collect(provider.chat([{ role: 'user', content: 'hi' }], makeRegistry()))

    expect(chunks[0]?.type).toBe('error')
    expect(chunks[0]?.error).toContain('Google API error')
    expect(chunks[0]?.error).toContain('400')
  })
})
