import http from 'http';
import type { BrowserWindow } from 'electron';
import type { Agent } from '../core/agent.js';

export interface WebhookConfig {
  port: number;
  token: string;
  enabled: boolean;
}

let server: http.Server | null = null;
let currentConfig: WebhookConfig | null = null;

function json(res: http.ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function isValidToken(req: http.IncomingMessage, token: string): boolean {
  const auth = req.headers['authorization'] || '';
  return auth === `Bearer ${token}`;
}

export function startWebhookServer(
  config: WebhookConfig,
  getAgent: () => { agent: Agent; workspaceId: string } | null,
  getWindows: () => BrowserWindow[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close(() => { server = null; startWebhookServer(config, getAgent, getWindows).then(resolve).catch(reject); });
      return;
    }

    currentConfig = config;

    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost`);
      const pathname = url.pathname;
      const method = req.method?.toUpperCase();

      // CORS preflight
      if (method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        });
        res.end();
        return;
      }

      // All routes require token — except GET /help
      if (pathname !== '/help' && !isValidToken(req, config.token)) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }

      // ── GET /help ─────────────────────────────────────────────────────────
      // Public endpoint. Returns a machine-readable description of the API
      // so any agent can discover how to use KoClaw without prior knowledge.
      if (method === 'GET' && pathname === '/help') {
        json(res, 200, {
          name: 'KoClaw — Koda Agent API',
          description: 'HTTP API that allows external agents to interact with Koda, an AI software engineer running locally. You can send tasks, read the conversation history, and reset the session.',
          authentication: 'All endpoints except /help require an Authorization header with a Bearer token: "Authorization: Bearer <token>".',
          workflow: 'Send a task via POST /message (returns immediately). Poll GET /messages to check when the agent has finished and read the response. Use POST /reset to start a fresh conversation.',
          endpoints: [
            {
              method: 'GET',
              path: '/help',
              auth: false,
              description: 'Returns this help document. No authentication required.',
            },
            {
              method: 'POST',
              path: '/message',
              auth: true,
              body: { message: 'string — the task or question to send to Koda' },
              response: { success: true, message: 'Message accepted, agent is processing' },
              notes: 'Returns 202 immediately. The agent processes the task asynchronously. Use GET /messages to read the result. Returns 409 if the agent is already busy.',
            },
            {
              method: 'GET',
              path: '/messages',
              auth: true,
              response: { messages: 'array of conversation message objects' },
              notes: 'Returns the full conversation history. Poll this endpoint after POST /message to check for the agent response. The last message from the assistant is the reply to your task.',
            },
            {
              method: 'POST',
              path: '/reset',
              auth: true,
              response: { success: true },
              notes: 'Clears the entire conversation history and resets the Koda session. Use this before starting a new unrelated task.',
            },
          ],
        });
        return;
      }

      // ── GET /messages ─────────────────────────────────────────────────────
      // Returns the full conversation history of the active workspace.
      if (method === 'GET' && pathname === '/messages') {
        const entry = getAgent();
        if (!entry) { json(res, 503, { error: 'Agent not initialized' }); return; }
        json(res, 200, { messages: entry.agent.getHistory() });
        return;
      }

      // ── POST /reset ───────────────────────────────────────────────────────
      // Clears the agent conversation and resets the session.
      if (method === 'POST' && pathname === '/reset') {
        const entry = getAgent();
        if (!entry) { json(res, 503, { error: 'Agent not initialized' }); return; }
        const { agent, workspaceId } = entry;
        await agent.resetConversation();
        getWindows().forEach(w => w.webContents.send('agent:update', { workspaceId, type: 'remote_reset' }));
        json(res, 200, { success: true });
        return;
      }

      // ── POST /message ─────────────────────────────────────────────────────
      // Dispatches a message to the Koda agent and returns immediately (202).
      // Body: { "message": "your task here" }
      // Use GET /messages to read the response once the agent finishes.
      if (method === 'POST' && pathname === '/message') {
        const entry = getAgent();
        if (!entry) { json(res, 503, { error: 'Agent not initialized' }); return; }
        const { agent, workspaceId } = entry;

        if ((agent as any).isProcessing) {
          json(res, 409, { error: 'Agent is busy processing another message' });
          return;
        }

        let body: { message?: string } = {};
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          json(res, 400, { error: 'Invalid JSON body' });
          return;
        }

        if (!body.message?.trim()) {
          json(res, 400, { error: '"message" field is required' });
          return;
        }

        const emit = (data: object) => {
          getWindows().forEach(w => w.webContents.send('agent:update', { workspaceId, ...data }));
        };

        // Fire and forget — caller uses GET /messages to read the result
        agent.processMessage(
          body.message,
          (text) => emit({ type: 'text', content: text }),
          (name, args) => emit({ type: 'tool_start', name, args }),
          (name, chunk) => emit({ type: 'tool_progress', event: 'writing', toolName: name, content: chunk }),
          (name, result, success, args) => emit({ type: 'tool_end', name, result, success, args }),
          (error) => emit({ type: 'error', message: error }),
        ).then(() => emit({ type: 'done' })).catch((err: any) => emit({ type: 'error', message: err.message }));

        json(res, 202, { success: true, message: 'Message accepted, agent is processing' });
        return;
      }

      json(res, 404, { error: 'Not found' });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${config.port} is already in use`));
      } else {
        reject(err);
      }
    });

    server.listen(config.port, '0.0.0.0', () => {
      console.log(`[KoClaw] Server listening on 0.0.0.0:${config.port}`);
      resolve();
    });
  });
}

export function stopWebhookServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) { resolve(); return; }
    server.close(() => { server = null; currentConfig = null; resolve(); });
  });
}

export function getWebhookStatus(): { running: boolean; port: number | null } {
  return { running: server !== null && server.listening, port: currentConfig?.port ?? null };
}
