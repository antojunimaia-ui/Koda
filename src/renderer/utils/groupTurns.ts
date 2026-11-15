import { MessageEntry } from '../types/index.js'

export interface TurnItem {
  type: 'turn'
  id: string
  entries: MessageEntry[]
}

export type RenderableItem = MessageEntry | TurnItem

/**
 * Compact tool view: one single agent block per turn, like Antigravity.
 *
 * A "turn" is the run of consecutive assistant/tool entries between two user
 * messages. Everything the agent produced in that turn (text + tool calls) is
 * rendered inside a single block with one avatar, with the tool groups inline
 * where they happened.
 */
export function groupTurns(messages: MessageEntry[]): RenderableItem[] {
  const out: RenderableItem[] = []
  let i = 0

  while (i < messages.length) {
    const msg = messages[i]
    if (msg.type !== 'assistant' && msg.type !== 'tool') {
      out.push(msg)
      i++
      continue
    }

    const entries: MessageEntry[] = []
    while (i < messages.length && (messages[i].type === 'assistant' || messages[i].type === 'tool')) {
      entries.push(messages[i])
      i++
    }

    out.push({ type: 'turn', id: `turn-${entries[0].id}`, entries })
  }

  return out
}
