import { describe, expect, it } from 'vitest'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { BaseTool } from '../../tools/base.js'
import { buildMcpServer } from '../mcp-server.js'

class StubTool extends BaseTool {
  name: string
  description: string
  parameters = []
  outcome: { success: boolean; output: string; error?: string }
  lastArgs: Record<string, unknown> = {}

  constructor(name: string, outcome: { success: boolean; output: string; error?: string }) {
    super()
    this.name = name
    this.description = `stub ${name}`
    this.outcome = outcome
  }

  async execute(args: Record<string, unknown>) {
    this.lastArgs = args
    return this.outcome
  }
}

function makeRegistry(readOnlyName: string, mutatingName: string) {
  const tools = [
    new StubTool(readOnlyName, { success: true, output: 'read-ok' }),
    new StubTool(mutatingName, { success: true, output: 'mutate-ok' }),
  ]
  return {
    getAll: () => tools,
  } as any
}

async function connectClient(server: ReturnType<typeof buildMcpServer>) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'koda-test', version: '1.0.0' })
  await client.connect(clientTransport)
  return client
}

describe('Koda MCP Server', () => {
  it('exposes only read-only tools by default', async () => {
    const server = buildMcpServer(makeRegistry('search', 'shell'), { allowMutatingTools: false })
    const client = await connectClient(server)

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain('search')
    expect(names).not.toContain('shell')

    await client.close()
    await server.close()
  })

  it('exposes mutating tools when allowed', async () => {
    const server = buildMcpServer(makeRegistry('search', 'shell'), { allowMutatingTools: true })
    const client = await connectClient(server)

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain('search')
    expect(names).toContain('shell')

    await client.close()
    await server.close()
  })

  it('returns tool output as text content', async () => {
    const server = buildMcpServer(makeRegistry('search', 'shell'), { allowMutatingTools: false })
    const client = await connectClient(server)

    const result = await client.callTool({ name: 'search', arguments: { q: 'x' } })
    const text = (result.content as Array<{ type: string; text: string }>)[0]
    expect(text).toMatchObject({ type: 'text', text: 'read-ok' })

    await client.close()
    await server.close()
  })

  it('surfaces tool failures as MCP errors', async () => {
    const failing = makeRegistry('search', 'shell')
    ;(failing.getAll() as StubTool[])[0].outcome = { success: false, output: '', error: 'boom' }
    const server = buildMcpServer(failing, { allowMutatingTools: false })
    const client = await connectClient(server)

    const res = await client.callTool({ name: 'search', arguments: {} })
    const text = (res.content as Array<{ text?: string }>).map((c) => c.text ?? '').join(' ')
    expect((res as any).isError || text).toBeTruthy()
    expect(text).toContain('boom')

    await client.close()
    await server.close()
  })
})
