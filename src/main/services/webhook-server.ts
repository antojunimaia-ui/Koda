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
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
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

export function startWebhookServer(
  config: WebhookConfig,
  getAgent: () => Agent | null,
  mainWindow: BrowserWindow | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close(() => { server = null; startWebhookServer(config, getAgent, mainWindow).then(resolve).catch(reject); });
      return;
    }

    currentConfig = config;

    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost`);
      const pathname = url.pathname;
      const method = req.method?.toUpperCase();

      // CORS preflight
      if (method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });
        res.end();
        return;
      }

      // GET /status — public, no token required
      if (method === 'GET' && pathname === '/status') {
        const agent = getAgent();
        const info = agent?.getInfo();
        json(res, 200, {
          online: true,
          busy: agent ? (agent as any).isProcessing ?? false : false,
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

      // POST /task
      if (method === 'POST' && pathname === '/task') {
        const agent = getAgent();
        if (!agent) { json(res, 503, { error: 'Agent not initialized' }); return; }
        if ((agent as any).isProcessing) { json(res, 409, { error: 'busy' }); return; }

        let body: { message?: string } = {};
        try { body = JSON.parse(await readBody(req)); } catch { json(res, 400, { error: 'Invalid JSON' }); return; }
        if (!body.message?.trim()) { json(res, 400, { error: 'message is required' }); return; }

        const msgId = Date.now();

        // Show in UI as a remote message
        mainWindow?.webContents.send('agent:update', {
          type: 'remote_task',
          messageId: msgId,
          message: body.message,
        });

        // Fire and forget — response is immediate, result streams to UI
        agent.processMessage(
          body.message,
          (text) => mainWindow?.webContents.send('agent:update', { type: 'text', content: text }),
          (name, args) => mainWindow?.webContents.send('agent:update', { type: 'tool_start', name, args }),
          (name, chunk) => mainWindow?.webContents.send('agent:update', { type: 'tool_progress', event: 'writing', toolName: name, content: chunk }),
          (name, result, success, args) => mainWindow?.webContents.send('agent:update', { type: 'tool_end', name, result, success, args }),
          (error) => mainWindow?.webContents.send('agent:update', { type: 'error', message: error }),
        ).then(() => {
          mainWindow?.webContents.send('agent:update', { type: 'done' });
        });

        json(res, 202, { accepted: true, messageId: msgId });
        return;
      }

      // POST /reset
      if (method === 'POST' && pathname === '/reset') {
        const agent = getAgent();
        if (!agent) { json(res, 503, { error: 'Agent not initialized' }); return; }
        agent.resetConversation();
        mainWindow?.webContents.send('agent:update', { type: 'remote_reset' });
        json(res, 200, { success: true });
        return;
      }

      // GET /messages
      if (method === 'GET' && pathname === '/messages') {
        const agent = getAgent();
        if (!agent) { json(res, 503, { error: 'Agent not initialized' }); return; }
        json(res, 200, { messages: agent.getHistory() });
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
    server.close(() => { server = null; currentConfig = null; resolve(); });
  });
}

export function getWebhookStatus(): { running: boolean; port: number | null } {
  return { running: server !== null && server.listening, port: currentConfig?.port ?? null };
}
