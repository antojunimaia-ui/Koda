import { describe, expect, it } from 'vitest'
import { Conversation } from '../conversation.js'

const SYSTEM = 'You are Koda.'

function makeConversation() {
  return new Conversation(SYSTEM)
}

describe('Conversation', () => {
  it('starts with the system message', () => {
    const conv = makeConversation()
    expect(conv.getMessageCount()).toBe(1)
    expect(conv.getMessages()[0]).toMatchObject({ role: 'system', content: SYSTEM })
  })

  it('updates the system prompt in place when it exists', () => {
    const conv = makeConversation()
    conv.updateSystemPrompt('New system prompt')
    expect(conv.getMessages()[0].content).toBe('New system prompt')
    expect(conv.getMessageCount()).toBe(1)
  })

  it('adds plain user messages', () => {
    const conv = makeConversation()
    conv.addUser('hello')
    const last = conv.getMessages().at(-1)
    expect(last?.role).toBe('user')
    expect(last?.content).toBe('hello')
  })

  it('adds user messages with image parts as a content array', () => {
    const conv = makeConversation()
    conv.addUser('describe this', [{ type: 'image', image: 'data:...' } as never])
    const last = conv.getMessages().at(-1)
    expect(last?.role).toBe('user')
    expect(Array.isArray(last?.content)).toBe(true)
    expect((last?.content as unknown[]).length).toBe(2)
  })

  it('adds assistant messages with optional tool calls', () => {
    const conv = makeConversation()
    conv.addAssistant('thinking…', [{ id: 'call_1', name: 'read_file', arguments: {} }])
    const last = conv.getMessages().at(-1)
    expect(last?.role).toBe('assistant')
    expect((last as { toolCalls?: unknown[] }).toolCalls).toHaveLength(1)
  })

  it('adds tool results with the associated call id', () => {
    const conv = makeConversation()
    conv.addToolResult('call_1', 'file content', 'read_file')
    const last = conv.getMessages().at(-1)
    expect(last?.role).toBe('tool')
    expect(last).toMatchObject({ toolCallId: 'call_1', toolName: 'read_file' })
  })

  describe('microCompact', () => {
    it('compacts heavy old tool outputs beyond the kept assistant turns', () => {
      const conv = makeConversation()
      conv.addAssistant('using read_file', [{ id: 'call_1', name: 'read_file', arguments: {} }])
      conv.addToolResult('call_1', 'x'.repeat(200), 'read_file')
      conv.addAssistant('second turn')
      conv.addAssistant('third turn')
      conv.addAssistant('fourth turn')

      const compacted = conv.microCompact(2)
      expect(compacted).toBe(true)

      const toolMsg = conv.getMessages().find((m) => m.role === 'tool')
      expect(toolMsg?.content).toBe('[Tool output compacted to save context memory]')
    })

    it('keeps short tool outputs intact even beyond the kept turns', () => {
      const conv = makeConversation()
      conv.addAssistant('using read_file', [{ id: 'call_1', name: 'read_file', arguments: {} }])
      conv.addToolResult('call_1', 'ok', 'read_file')
      conv.addAssistant('second')
      conv.addAssistant('third')
      conv.addAssistant('fourth')

      expect(conv.microCompact(2)).toBe(false)
      const toolMsg = conv.getMessages().find((m) => m.role === 'tool')
      expect(toolMsg?.content).toBe('ok')
    })
  })

  describe('trimIfNeeded', () => {
    it('returns false when within the token budget', () => {
      const conv = new Conversation(SYSTEM, 100_000)
      conv.addUser('short message')
      expect(conv.trimIfNeeded()).toBe(false)
    })

    it('returns true and keeps system + summary + recent when over budget', () => {
      const conv = new Conversation(SYSTEM, 40)
      for (let i = 0; i < 20; i++) conv.addUser(`message number ${i} with some padding text`)
      expect(conv.trimIfNeeded()).toBe(true)

      const messages = conv.getMessages()
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
      expect(String(messages[1].content)).toContain('[Context note:')
    })
  })

  it('clear() keeps only the system message', () => {
    const conv = makeConversation()
    conv.addUser('hi')
    conv.addAssistant('hello')
    conv.clear()
    expect(conv.getMessageCount()).toBe(1)
    expect(conv.getMessages()[0].role).toBe('system')
  })

  it('truncateToLength(0) behaves like clear()', () => {
    const conv = makeConversation()
    conv.addUser('a')
    conv.addUser('b')
    conv.truncateToLength(0)
    expect(conv.getMessageCount()).toBe(1)
  })

  it('truncateToLength(n) keeps the first n messages', () => {
    const conv = makeConversation()
    conv.addUser('a')
    conv.addUser('b')
    conv.truncateToLength(2)
    expect(conv.getMessageCount()).toBe(2)
    expect(conv.getMessages()[1].content).toBe('a')
  })
})
