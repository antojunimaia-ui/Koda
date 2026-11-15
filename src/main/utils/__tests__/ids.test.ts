import { describe, expect, it } from 'vitest'
import { generateWorkspaceId } from '../ids.js'

describe('generateWorkspaceId', () => {
  it('gera IDs com exatamente 16 caracteres por padrão', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateWorkspaceId()).toHaveLength(16)
    }
  })

  it('usa apenas o alfabeto base62', () => {
    expect(generateWorkspaceId()).toMatch(/^[0-9A-Za-z]{16}$/)
  })

  it('não colide em uma amostra grande', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 10000; i++) {
      seen.add(generateWorkspaceId())
    }
    expect(seen.size).toBe(10000)
  })
})
