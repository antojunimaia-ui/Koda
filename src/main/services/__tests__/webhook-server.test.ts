import { afterEach, describe, expect, it } from 'vitest'
import type { Agent } from '../../core/agent.js'
import {
  getWebhookStatus,
  startWebhookServer,
  stopWebhookServer,
} from '../webhook-server.js'

let lastMessage = ''

const fakeAgent = {
  isProcessing: false,
  getHistory: () => [{ role: 'assistant', content: 'ok' }],
  resetConversation: async () => {},
  processMessage: async (msg: string) => {
    lastMessage = msg
  },
}

function getAgent() {
  return { agent: fakeAgent as unknown as Agent, workspaceId: 'ws1' }
}

const TOKEN = 'test-token'

async function startServer() {
  const port = 34000 + Math.floor(Math.random() * 500)
  await startWebhookServer(
    { port, token: TOKEN, enabled: true },
    getAgent,
    () => [],
  )
  return port
}

function base(port: number) {
  return `http://127.0.0.1:${port}`
}

function authHeaders(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...extra }
}

describe('webhook-server (KoClaw)', () => {
  afterEach(async () => {
    await stopWebhookServer()
  })

  it('is not running before start', () => {
    expect(getWebhookStatus()).toEqual({ running: false, port: null })
  })

  it('serves /help publicly without auth', async () => {
    const port = await startServer()
    const res = await fetch(`${base(port)}/help`)
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.name).toContain('KoClaw')
    expect(body.endpoints.map((e: any) => e.path)).toContain('/message')
  })

  it('rejects protected routes without a token', async () => {
    const port = await startServer()
    const res = await fetch(`${base(port)}/messages`)
    expect(res.status).toBe(401)
  })

  it('returns the conversation history with a valid token', async () => {
    const port = await startServer()
    const res = await fetch(`${base(port)}/messages`, { headers: authHeaders() })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.messages).toHaveLength(1)
  })

  it('accepts a task via POST /message and returns 202', async () => {
    const port = await startServer()
    const res = await fetch(`${base(port)}/message`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message: 'send task' }),
    })
    expect(res.status).toBe(202)
    expect(lastMessage).toBe('send task')
  })

  it('returns 400 when the message field is missing', async () => {
    const port = await startServer()
    const res = await fetch(`${base(port)}/message`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid JSON', async () => {
    const port = await startServer()
    const res = await fetch(`${base(port)}/message`, {
      method: 'POST',
      headers: authHeaders(),
      body: '{not-json',
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown routes (with auth)', async () => {
    const port = await startServer()
    const res = await fetch(`${base(port)}/does-not-exist`, { headers: authHeaders() })
    expect(res.status).toBe(404)
  })

  it('stops the server and reports not running', async () => {
    const port = await startServer()
    expect(getWebhookStatus().running).toBe(true)

    await stopWebhookServer()
    expect(getWebhookStatus()).toEqual({ running: false, port: null })

    await expect(fetch(`${base(port)}/help`)).rejects.toThrow()
  })
})
