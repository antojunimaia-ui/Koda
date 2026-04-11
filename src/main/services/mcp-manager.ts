import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { MCPTool } from '../tools/mcp-tool.js';
import { ToolResult } from '../tools/base.js';

export interface MCPServerConfig {
  id: string;
  name: string;
  type: 'local' | 'external';
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
}

export class MCPManager extends EventEmitter {
  private servers: Map<string, { process: ChildProcess, tools: any[] }> = new Map();

  async stopAll() {
    for (const [id, server] of this.servers) {
      server.process.kill();
    }
    this.servers.clear();
  }

  async loadServerTools(config: MCPServerConfig): Promise<any[]> {
    if (!config.enabled) return [];

    if (config.type === 'local' && config.command) {
      return new Promise((resolve) => {
        const commandArgs = (config.args || []).map(arg => {
          if (arg.includes(' ') && !arg.startsWith('"')) {
            return `"${arg}"`;
          }
          return arg;
        });

        const fullCommand = `${config.command} ${commandArgs.join(' ')}`;
        console.log(`[MCP:${config.name}] Executing: ${fullCommand}`);
        
        const child = spawn(fullCommand, [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: process.platform === 'win32'
        });

        let tools: any[] = [];
        let buffer = '';

        child.stderr?.on('data', (data) => console.error(`[MCP:${config.name}:ERR] ${data}`));

        child.on('error', (err) => {
          console.error(`[MCP:${config.name}] Failed to spawn:`, err);
          resolve([]);
        });

        child.stdout?.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
               const response = JSON.parse(line);
               
               // 1. Handle Initialize Response
               if (response.id === 100) {
                 // Send notifications/initialized
                 child.stdin?.write(JSON.stringify({
                   jsonrpc: '2.0',
                   method: 'notifications/initialized'
                 }) + '\n');

                 // 2. Request tools list
                 child.stdin?.write(JSON.stringify({
                   jsonrpc: '2.0',
                   id: 101,
                   method: 'tools/list',
                   params: {}
                 }) + '\n');
               }

               // 2. Handle Tools List Response
               if (response.id === 101 && response.result?.tools) {
                 tools = response.result.tools;
                 console.log(`[MCP:${config.name}] Discovered ${tools.length} tools`);
                 this.servers.set(config.id, { process: child, tools });
                 resolve(tools);
               }
            } catch (err) {
               // Not a full JSON or invalid
            }
          }
        });

        // Start Handshake: initialize
        child.stdin?.write(JSON.stringify({
          jsonrpc: '2.0',
          id: 100,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'Koda', version: '26.8.4' }
          }
        }) + '\n');

        setTimeout(() => {
           if (tools.length === 0) {
             console.warn(`[MCP:${config.name}] Discovery timeout after 10s`);
             child.kill();
             resolve([]);
           }
        }, 10000);
      });
    }
    return [];
  }

  async callTool(serverId: string, toolName: string, args: any): Promise<ToolResult> {
    const server = this.servers.get(serverId);
    if (!server) return { success: false, output: `Server ${serverId} not found.` };

    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 10000);
      let callBuffer = '';
      
      const listener = (data: Buffer) => {
        callBuffer += data.toString();
        const lines = callBuffer.split('\n');
        callBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const response = JSON.parse(line);
            if (response.id === id) {
              server.process.stdout?.removeListener('data', listener);
              if (response.error) {
                resolve({ success: false, output: response.error.message });
              } else {
                const content = response.result.content?.[0]?.text || JSON.stringify(response.result);
                resolve({ success: true, output: content });
              }
              return;
            }
          } catch {}
        }
      };

      server.process.stdout?.on('data', listener);

      server.process.stdin?.write(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      }) + '\n');
      
      setTimeout(() => {
        server.process.stdout?.removeListener('data', listener);
        resolve({ success: false, output: `Timeout calling tool ${toolName} on ${serverId}` });
      }, 60000); // 60s timeout for tools
    });
  }
}

export const mcpManager = new MCPManager();
