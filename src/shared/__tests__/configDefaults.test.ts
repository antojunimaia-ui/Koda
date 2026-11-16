import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  LOCAL_PROVIDERS,
  NO_KEY_PROVIDERS,
  PROVIDERS,
  REMOTE_PROVIDERS,
  getProvider,
} from '../configDefaults.js'

describe('provider config registry', () => {
  it('expõe todos os providers com os campos do schema', () => {
    expect(PROVIDERS.length).toBeGreaterThanOrEqual(17)
    for (const p of PROVIDERS) {
      expect(p.id).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(['remote', 'local']).toContain(p.kind)
      expect(['apiKey', 'baseUrl', 'none']).toContain(p.credential)
      expect(typeof p.requiresKey).toBe('boolean')
      expect(typeof p.placeholder).toBe('string')
    }
  })

  it('getProvider retorna o registro certo e undefined para desconhecido', () => {
    expect(getProvider('openai')?.name).toBe('OpenAI')
    expect(getProvider('ollama')?.kind).toBe('local')
    expect(getProvider('nao-existe')).toBeUndefined()
  })

  it('providers locais não exigem API key e remotos exigem', () => {
    expect(LOCAL_PROVIDERS.length).toBeGreaterThanOrEqual(2)
    for (const p of LOCAL_PROVIDERS) {
      expect(p.requiresKey).toBe(false)
      expect(p.defaultBaseUrl).toBeTruthy()
    }
    for (const p of REMOTE_PROVIDERS) {
      expect(p.kind).toBe('remote')
    }
  })

  it('NO_KEY_PROVIDERS cobre locais + gerenciados', () => {
    expect(NO_KEY_PROVIDERS).toContain('ollama')
    expect(NO_KEY_PROVIDERS).toContain('llamacpp')
    expect(NO_KEY_PROVIDERS).toContain('koda-cloud')
  })

  it('todo provider tem modelo default', () => {
    for (const p of PROVIDERS) {
      expect(DEFAULT_MODELS).toHaveProperty(p.id)
    }
    expect(DEFAULT_PROVIDER).toBe('openai')
  })
})
