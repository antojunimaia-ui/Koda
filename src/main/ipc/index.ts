import { BrowserWindow } from 'electron'
import { Agent } from '../core/agent.js'
import { DiscordRPCManager } from '../services/discord-rpc.js'

import { registerWindowHandlers } from './window.js'
import { registerAgentHandlers } from './agent.js'
import { registerProjectHandlers } from './project.js'
import { registerPtyHandlers } from './pty.js'
import { registerSkillsHandlers } from './skills.js'
import { registerKoclawHandlers } from './koclaw.js'
import { registerMcpHandlers } from './mcp.js'
import { registerDiscordHandlers } from './discord.js'
import { registerGitHandlers } from './git.js'

export function registerAllHandlers(
  agents: Map<string, Agent>,
  discordRPC: DiscordRPCManager,
  getMainWindow: () => BrowserWindow | null,
  getWindows: () => (BrowserWindow | null)[],
  broadcastAgentUpdate: (data: object) => void
) {
  registerWindowHandlers(getMainWindow)
  registerAgentHandlers(agents, broadcastAgentUpdate)
  registerProjectHandlers()
  registerPtyHandlers(agents)
  registerSkillsHandlers(agents)
  registerKoclawHandlers(agents, getWindows)
  registerMcpHandlers(agents)
  registerDiscordHandlers(discordRPC)
  registerGitHandlers()
}
