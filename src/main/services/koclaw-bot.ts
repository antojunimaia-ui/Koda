import { Client, GatewayIntentBits, Message } from 'discord.js';
import type { BrowserWindow } from 'electron';
import type { Agent } from '../core/agent.js';
import https from 'https';

export interface KoClawConfig {
  token: string;
  enabled: boolean;
  channelId?: string;
}

interface TaskResult {
  text: string;
  done: boolean;
  error?: string;
}

let client: Client | null = null;
let isReady = false;

// Track ongoing tasks per user
const userTasks = new Map<string, { messageId: number; result: TaskResult }>();

export async function startKoClawBot(
  config: KoClawConfig,
  getAgent: () => { agent: Agent; workspaceId: string } | null,
  getWindows: () => BrowserWindow[]
): Promise<void> {
  if (client) {
    await stopKoClawBot();
  }

  isReady = false;

  // Discord.js uses Node's https under the hood — bypass certificate
  // verification issues that occur in packaged Electron apps
  https.globalAgent.options.rejectUnauthorized = false;
  // discord.js uses undici internally which respects this env var
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.on('ready', () => {
    console.log(`[KoClaw] Bot logged in as ${client?.user?.tag}`);
    isReady = true;
  });

  client.on('messageCreate', async (message: Message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Only respond in DMs or specific channel
    const isDM = !message.guild;
    const isAllowedChannel = config.channelId ? message.channelId === config.channelId : true;

    if (!isDM && !isAllowedChannel) return;

    const content = message.content.trim();
    if (!content) return;

    // Check if user has ongoing task
    const existingTask = userTasks.get(message.author.id);
    if (existingTask && !existingTask.result.done) {
      await message.reply('⏳ I\'m still working on your previous request. Please wait...');
      return;
    }

    // Get agent
    const entry = getAgent();
    if (!entry) {
      await message.reply('❌ Agent not initialized. Please open Koda first.');
      return;
    }

    const { agent, workspaceId } = entry;

    // Check if agent is busy
    if ((agent as any).isProcessing) {
      await message.reply('⏳ I\'m currently busy with another task. Please wait...');
      return;
    }

    // Create task
    const msgId = Date.now();
    const result: TaskResult = { text: '', done: false };
    userTasks.set(message.author.id, { messageId: msgId, result });

    // Send initial response
    const statusMsg = await message.reply('🤖 Processing your request...');

    const emit = (data: object) => {
      const payload = { workspaceId, ...data };
      getWindows().forEach(w => w.webContents.send('agent:update', payload));
    };

    // Show in UI
    emit({ type: 'discord_task', messageId: msgId, message: content, user: message.author.tag });

    try {
      await agent.processMessage(
        content,
        (text) => {
          result.text += text;
          emit({ type: 'text', content: text });
        },
        (name, args) => {
          emit({ type: 'tool_start', name, args });
        },
        (name, chunk) => {
          emit({ type: 'tool_progress', event: 'writing', toolName: name, content: chunk });
        },
        (name, r, success, args) => {
          emit({ type: 'tool_end', name, result: r, success, args });
        },
        (error) => {
          result.error = error;
          emit({ type: 'error', message: error });
        },
      );

      result.done = true;
      emit({ type: 'done' });

      // Send result to Discord
      if (result.error) {
        await statusMsg.edit(`❌ Error: ${result.error}`);
      } else {
        // Split long messages (Discord limit is 2000 chars)
        const response = result.text || 'Task completed successfully!';
        if (response.length <= 1900) {
          await statusMsg.edit(`✅ ${response}`);
        } else {
          await statusMsg.edit('✅ Task completed! Sending response...');
          // Split into chunks
          const chunks = response.match(/[\s\S]{1,1900}/g) || [];
          for (const chunk of chunks) {
            if (message.channel.isSendable()) {
              await message.channel.send(chunk);
            }
          }
        }
      }
    } catch (error: any) {
      result.error = error.message;
      result.done = true;
      await statusMsg.edit(`❌ Error: ${error.message}`);
    }

    // Cleanup after 5 minutes
    setTimeout(() => {
      userTasks.delete(message.author.id);
    }, 5 * 60 * 1000);
  });

  client.on('error', (error) => {
    console.error('[KoClaw] Error:', error);
  });

  try {
    await client.login(config.token);
  } catch (error: any) {
    console.error('[KoClaw] Failed to login:', error);
    throw new Error(`Failed to login: ${error.message}`);
  }
}

export async function stopKoClawBot(): Promise<void> {
  if (!client) return;

  isReady = false;
  userTasks.clear();

  // Restore TLS verification
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  try {
    await client.destroy();
    console.log('[KoClaw] Bot stopped');
  } catch (error) {
    console.error('[KoClaw] Error stopping bot:', error);
  }

  client = null;
}

export function getKoClawStatus(): { running: boolean; ready: boolean; username: string | null } {
  return {
    running: client !== null,
    ready: isReady,
    username: client?.user?.tag ?? null,
  };
}
