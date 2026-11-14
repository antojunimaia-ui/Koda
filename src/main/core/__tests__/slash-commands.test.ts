import { describe, expect, it } from 'vitest'
import { NATIVE_COMMAND_NAMES, NATIVE_SLASH_COMMANDS } from '../slash-commands.js'

describe('NATIVE_SLASH_COMMANDS', () => {
  it('exposes at least the documented native commands', () => {
    const names = NATIVE_SLASH_COMMANDS.map((c) => c.name)
    for (const expected of ['help', 'clear', 'reset', 'tokens', 'model', 'apikey']) {
      expect(names).toContain(expected)
    }
  })

  it('has no leading slash in names and valid metadata', () => {
    for (const cmd of NATIVE_SLASH_COMMANDS) {
      expect(cmd.name).not.toMatch(/^\//)
      expect(cmd.description).toBeTruthy()
      expect(cmd.icon).toBeTruthy()
    }
  })

  it('has unique names', () => {
    const names = NATIVE_SLASH_COMMANDS.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('builds NATIVE_COMMAND_NAMES from the same list', () => {
    expect(NATIVE_COMMAND_NAMES.size).toBe(NATIVE_SLASH_COMMANDS.length)
    for (const cmd of NATIVE_SLASH_COMMANDS) {
      expect(NATIVE_COMMAND_NAMES.has(cmd.name)).toBe(true)
    }
  })
})
