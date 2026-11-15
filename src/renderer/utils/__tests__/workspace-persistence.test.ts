import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type FakeStorage = Record<string, string>
let store: FakeStorage = {}

// localStorage não existe no environment node — simulamos um mínimo funcional.
beforeEach(() => {
  store = {}
  const fakeLocalStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      store = {}
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
  vi.stubGlobal('localStorage', fakeLocalStorage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

import {
  loadActiveWorkspaceId,
  loadWorkspaces,
  saveActiveWorkspaceId,
  saveWorkspaces,
} from '../workspace-persistence.js'

describe('workspace-persistence', () => {
  it('roundtrip de save/load do registro', () => {
    const list = [
      { id: 'abc123', cwd: '/proj/a', lastActive: 100 },
      { id: 'xyz789', cwd: '/proj/b', lastActive: 200 },
    ]
    saveWorkspaces(list)
    expect(loadWorkspaces()).toEqual(list)
  })

  it('retorna [] sem nada salvo', () => {
    expect(loadWorkspaces()).toEqual([])
  })

  it('persiste o workspace ativo', () => {
    saveActiveWorkspaceId('abc123')
    expect(loadActiveWorkspaceId()).toBe('abc123')
    saveActiveWorkspaceId(null)
    expect(loadActiveWorkspaceId()).toBeNull()
  })
})
