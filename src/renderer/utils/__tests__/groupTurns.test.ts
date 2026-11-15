import { describe, expect, it } from 'vitest'
import { groupTurns, TurnItem } from '../groupTurns.js'
import { MessageEntry } from '../../types/index.js'

let seq = 0
const assistant = (text: string): MessageEntry => ({ id: ++seq, type: 'assistant', text, done: true })
const tool = (name: string): MessageEntry => ({
  id: ++seq,
  type: 'tool',
  tool: { name, status: 'done', success: true, args: { path: `${name}.ts` } },
})
const user = (text: string): MessageEntry => ({ id: ++seq, type: 'user', text })

const isTurn = (item: unknown): item is TurnItem => (item as TurnItem).type === 'turn'

describe('groupTurns', () => {
  it('keeps text and tools of a turn inside a single block', () => {
    const messages = [
      user('analise o projeto'),
      assistant('I will analyze.'),
      tool('file_read'),
      assistant('Let me examine the core.'),
      tool('file_read'),
      tool('shell'),
      assistant('Let me verify the build.'),
      tool('shell'),
      assistant('Análise do Projeto'),
    ]

    const out = groupTurns(messages)
    const turns = out.filter(isTurn)

    expect(turns).toHaveLength(1)
    // Every entry of the agent turn lives in the same turn block
    expect(turns[0].entries.map((m) => m.id)).toEqual(messages.slice(1).map((m) => m.id))
    expect(turns[0].entries.map((m) => m.type)).toEqual([
      'assistant',
      'tool',
      'assistant',
      'tool',
      'tool',
      'assistant',
      'tool',
      'assistant',
    ])
    // The user message stays outside the turn
    expect(out[0]).toBe(messages[0])
  })

  it('creates one block per turn and never leaks tools across user messages', () => {
    const messages = [
      user('first'),
      assistant('a1'),
      tool('file_read'),
      assistant('a2'),
      user('second'),
      assistant('b1'),
      tool('shell'),
      assistant('b2'),
    ]

    const turns = groupTurns(messages).filter(isTurn)

    expect(turns).toHaveLength(2)
    expect(turns[0].entries.filter((m) => m.type === 'tool').map((m) => m.tool!.name)).toEqual(['file_read'])
    expect(turns[1].entries.filter((m) => m.type === 'tool').map((m) => m.tool!.name)).toEqual(['shell'])
  })

  it('leaves non-agent messages untouched and in order', () => {
    const messages = [user('hi'), assistant('hello'), assistant('world'), user('again')]
    const out = groupTurns(messages)

    expect(out[0]).toBe(messages[0])
    expect(out[out.length - 1]).toBe(messages[3])
    const turn = out[1] as TurnItem
    expect(turn.type).toBe('turn')
    expect(turn.entries.map((m) => m.id)).toEqual([messages[1].id, messages[2].id])
  })

  it('preserves live status updates (same ids, new status)', () => {
    const running: MessageEntry = {
      id: 99,
      type: 'tool',
      tool: { name: 'file_read', status: 'running', success: false },
    }
    const turn = groupTurns([assistant('reading'), running]).find(isTurn)!
    expect(turn.entries[1].tool!.status).toBe('running')
  })
})
