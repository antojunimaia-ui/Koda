/**
 * Canonical list of native slash commands.
 * This is the single source of truth — consumed by both the agent (processing)
 * and the frontend (slash menu + knownCmds guard) via the IPC handler
 * `agent:get_slash_commands`.
 *
 * When adding a new slash command to agent.ts, add its entry here too.
 */

export interface SlashCommandDef {
  name: string        // without leading slash, e.g. "clear"
  description: string
  icon: string
}

export const NATIVE_SLASH_COMMANDS: SlashCommandDef[] = [
  { name: 'help',      description: 'Show available commands',              icon: '❓' },
  { name: 'clear',     description: 'Clear chat messages',                  icon: '🗑️' },
  { name: 'reset',     description: 'Reset conversation memory',            icon: '♻️' },
  { name: 'tokens',    description: 'Show token usage estimate',            icon: '📊' },
  { name: 'cost',      description: 'Alias for /tokens',                    icon: '💰' },
  { name: 'hyperedit', description: 'Coordinate isolated editing agents',   icon: '⚡' },
  { name: 'model',     description: 'View or switch active model',          icon: '🤖' },
  { name: 'apikey',    description: 'Set API key inline',                   icon: '🔑' },
]

/** Flat set of all native command names (without slash) for fast lookup. */
export const NATIVE_COMMAND_NAMES = new Set(NATIVE_SLASH_COMMANDS.map(c => c.name))
