import { describe, expect, it } from 'vitest'
import { wsStorageKey } from '../workspace-storage.js'

describe('wsStorageKey', () => {
  it('prefixa a chave com o workspace id', () => {
    expect(wsStorageKey('abc123', 'currentSessionId')).toBe('koda_ws:abc123:currentSessionId')
  })

  it('produz chaves distintas para workspaces diferentes', () => {
    expect(wsStorageKey('aaa', 'x')).not.toBe(wsStorageKey('bbb', 'x'))
  })
})
