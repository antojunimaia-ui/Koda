import http from 'http';
import type { BrowserWindow } from 'electron';
import type { Agent } from '../core/agent.js';

export interface WebhookConfig {
  port: number;
  token: string;
  enabled: boolean;
}

interface TaskResult {
  text: string;
  done: boolean;
  error?: string;
}

let server: http.Server | null = null;
let currentConfig: WebhookConfig | null = null;

// SSE clients per messageId
const sseClients = new Map<number, http.ServerResponse[]>();
// Completed task results (kept for 10 min)
const taskResults = new Map<number, TaskResult>();

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
  const query = new URL(req.url || '/', `http://localhost`).searchParams.get('token') || '';
  return auth === `Bearer ${token}` || query === token;
}

function sseWrite(res: http.ServerResponse, event: string, data: unknown) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch { /* client disconnected */ }
}

function broadcastSSE(msgId: number, event: string, data: unknown) {
  const clients = sseClients.get(msgId) || [];
  for (const client of clients) sseWrite(client, event, data);
  if (event === 'done' || event === 'error') {
    for (const client of clients) { try { client.end(); } catch { } }
    sseClients.delete(msgId);
  }
}

function cleanupResult(msgId: number) {
  setTimeout(() => taskResults.delete(msgId), 10 * 60 * 1000);
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

      // ── GET /status — public ──────────────────────────────────────────────
      if (method === 'GET' && pathname === '/status') {
        const entry = getAgent();
        const info = entry?.agent?.getInfo();
        json(res, 200, {
          online: true,
          busy: entry?.agent ? (entry.agent as any).isProcessing ?? false : false,
          project: info?.project ?? null,
          model: info?.model ?? null,
          cwd: info?.cwd ?? null,
        });
        return;
      }

      // All other routes require token
      if (!isValidToken(req, config.token)) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }

      // ── GET /stream?messageId=X ───────────────────────────────────────────
      if (method === 'GET' && pathname === '/stream') {
        const msgId = parseInt(url.searchParams.get('messageId') || '0');
        if (!msgId) { json(res, 400, { error: 'messageId is required' }); return; }

        // If task already done, return result immediately as SSE then close
        const existing = taskResults.get(msgId);
        if (existing) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          if (existing.error) {
            sseWrite(res, 'error', { message: existing.error });
          } else {
            sseWrite(res, 'text', { content: existing.text });
            sseWrite(res, 'done', { text: existing.text });
          }
          res.end();
          return;
        }

        // Open SSE stream and wait for task
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write(': connected\n\n'); // keep-alive comment

        const clients = sseClients.get(msgId) || [];
        clients.push(res);
        sseClients.set(msgId, clients);

        req.on('close', () => {
          const list = sseClients.get(msgId) || [];
          sseClients.set(msgId, list.filter(c => c !== res));
        });
        return;
      }

      // ── GET /result?messageId=X ───────────────────────────────────────────
      if (method === 'GET' && pathname === '/result') {
        const msgId = parseInt(url.searchParams.get('messageId') || '0');
        if (!msgId) { json(res, 400, { error: 'messageId is required' }); return; }
        const result = taskResults.get(msgId);
        if (!result) { json(res, 404, { error: 'Result not found or expired' }); return; }
        json(res, 200, result);
        return;
      }

      // ── POST /task ────────────────────────────────────────────────────────
      if (method === 'POST' && pathname === '/task') {
        const entry = getAgent();
        if (!entry) { json(res, 503, { error: 'Agent not initialized' }); return; }
        const { agent, workspaceId } = entry;
        if ((agent as any).isProcessing) { json(res, 409, { error: 'busy' }); return; }

        let body: { message?: string; wait?: boolean } = {};
        try { body = JSON.parse(await readBody(req)); } catch { json(res, 400, { error: 'Invalid JSON' }); return; }
        if (!body.message?.trim()) { json(res, 400, { error: 'message is required' }); return; }

        const msgId = Date.now();
        const result: TaskResult = { text: '', done: false };
        taskResults.set(msgId, result);
        cleanupResult(msgId);

        const emit = (data: object) => {
          const payload = { workspaceId, ...data };
          getWindows().forEach(w => w.webContents.send('agent:update', payload));
        };

        // Show in UI
        emit({ type: 'remote_task', messageId: msgId, message: body.message });

        const runTask = agent.processMessage(
          body.message,
          (text) => {
            result.text += text;
            emit({ type: 'text', content: text });
            broadcastSSE(msgId, 'text', { content: text });
          },
          (name, args) => {
            emit({ type: 'tool_start', name, args });
            broadcastSSE(msgId, 'tool_start', { name, args });
          },
          (name, chunk) => {
            emit({ type: 'tool_progress', event: 'writing', toolName: name, content: chunk });
          },
          (name, r, success, args) => {
            emit({ type: 'tool_end', name, result: r, success, args });
            broadcastSSE(msgId, 'tool_end', { name, success });
          },
          (error) => {
            result.error = error;
            emit({ type: 'error', message: error });
            broadcastSSE(msgId, 'error', { message: error });
          },
        ).then(() => {
          result.done = true;
          emit({ type: 'done' });
          broadcastSSE(msgId, 'done', { text: result.text, messageId: msgId });
        });

        if (body.wait) {
          await runTask;
          json(res, 200, { done: true, messageId: msgId, result: result.text, error: result.error });
        } else {
          json(res, 202, { accepted: true, messageId: msgId });
        }
        return;
      }

      // ── POST /cd ──────────────────────────────────────────────────────────
      if (method === 'POST' && pathname === '/cd') {
        const entry = getAgent();
        if (!entry) { json(res, 503, { error: 'Agent not initialized' }); return; }
        const { agent, workspaceId } = entry;
        if ((agent as any).isProcessing) { json(res, 409, { error: 'busy' }); return; }

        let body: { path?: string } = {};
        try { body = JSON.parse(await readBody(req)); } catch { json(res, 400, { error: 'Invalid JSON' }); return; }
        if (!body.path?.trim()) { json(res, 400, { error: 'path is required' }); return; }

        try {
          process.chdir(body.path);
          await agent.resetConversation();
          await agent.initialize();
          const info = agent.getInfo();
          getWindows().forEach(w => w.webContents.send('agent:update', { workspaceId, type: 'remote_cd', cwd: info.cwd }));
          json(res, 200, { success: true, cwd: info.cwd });
        } catch (err: any) {
          json(res, 400, { error: err.message });
        }
        return;
      }

      // ── POST /reset ───────────────────────────────────────────────────────
      if (method === 'POST' && pathname === '/reset') {
        const entry = getAgent();
        if (!entry) { json(res, 503, { error: 'Agent not initialized' }); return; }
        const { agent, workspaceId } = entry;
        await agent.resetConversation();
        getWindows().forEach(w => w.webContents.send('agent:update', { workspaceId, type: 'remote_reset' }));
        json(res, 200, { success: true });
        return;
      }

      // ── GET /messages ─────────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/messages') {
        const entry = getAgent();
        if (!entry) { json(res, 503, { error: 'Agent not initialized' }); return; }
        json(res, 200, { messages: entry.agent.getHistory() });
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
      console.log(`[Webhook] Server listening on 0.0.0.0:${config.port}`);
      resolve();
    });
  });
}

export function stopWebhookServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) { resolve(); return; }
    // Close all SSE clients
    for (const clients of sseClients.values()) {
      for (const c of clients) { try { c.end(); } catch { } }
    }
    sseClients.clear();
    server.close(() => { server = null; currentConfig = null; resolve(); });
  });
}

export function getWebhookStatus(): { running: boolean; port: number | null } {
  return { running: server !== null && server.listening, port: currentConfig?.port ?? null };
}
