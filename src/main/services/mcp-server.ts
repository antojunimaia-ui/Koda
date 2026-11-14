import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ToolRegistry } from '../tools/index.js'
import { toolParametersToZod } from '../tools/base.js'

export interface McpServerOptions {
  /** Expõe também ferramentas mutáveis (file_write, shell, etc.). Padrão: falso. */
  allowMutatingTools: boolean
}

/**
 * Conjunto padrão de tools seguras (leitura/consultas) expostas como MCP.
 * Tools mutáveis exigem `allowMutatingTools: true`.
 */
const READ_ONLY_TOOLS = new Set([
  'file_read',
  'search',
  'list_dir',
  'file_find',
  'lsp_query',
  'questions',
  'get_diagnostics',
  'web_search',
  'web_fetch',
  'load_skill',
])

/** Constrói um servidor MCP a partir das tools do registry (schema-first). */
export function buildMcpServer(registry: ToolRegistry, opts: McpServerOptions): McpServer {
  const server = new McpServer({ name: 'koda', version: '26.1.5' })

  for (const tool of registry.getAll()) {
    if (!opts.allowMutatingTools && !READ_ONLY_TOOLS.has(tool.name)) continue

    server.registerTool(
      tool.name,
      { title: tool.name, description: tool.description, inputSchema: toolParametersToZod(tool.parameters) },
      async (args?: Record<string, unknown>) => {
        const result = await tool.execute((args ?? {}) as Record<string, unknown>)
        if (!result.success) {
          throw new Error(result.error || 'Tool execution failed')
        }
        return { content: [{ type: 'text' as const, text: result.output }] }
      },
    )
  }

  return server
}

let activeServer: McpServer | null = null

/** Inicia o servidor MCP sobre stdio (Koda como subprocesso MCP). */
export async function startMcpServer(opts: McpServerOptions, registry: ToolRegistry): Promise<void> {
  await stopMcpServer()
  const server = buildMcpServer(registry, opts)
  activeServer = server
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

export async function stopMcpServer(): Promise<void> {
  if (!activeServer) return
  const server = activeServer
  activeServer = null
  try {
    await server.close()
  } catch {
    // best effort
  }
}

export function getMcpServerStatus(): { running: boolean } {
  return { running: !!activeServer }
}
