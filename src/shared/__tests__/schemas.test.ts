import { describe, expect, it } from 'vitest'
import {
  ApprovedCommandsSchema,
  EnvironmentSettingsSchema,
  KoClawMessageSchema,
  KoClawStartConfigSchema,
  LLM_PROVIDERS,
  SetupConfigSchema,
  sanitizeEnvironment,
} from '../schemas.js'

describe('SetupConfigSchema', () => {
  it('accepts a full valid config', () => {
    const result = SetupConfigSchema.safeParse({
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      advisorModel: 'claude-3-5-haiku',
      apiKey: 'sk-ant-...',
      kodaCloudBaseUrl: 'https://example.com',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an empty config (all optional)', () => {
    expect(SetupConfigSchema.safeParse({}).success).toBe(true)
  })

  it('rejects non-string values', () => {
    expect(SetupConfigSchema.safeParse({ provider: 42 }).success).toBe(false)
    expect(SetupConfigSchema.safeParse({ model: ['x'] }).success).toBe(false)
  })
})

describe('ApprovedCommandsSchema', () => {
  it('accepts base/full arrays', () => {
    const result = ApprovedCommandsSchema.safeParse({ base: ['npm'], full: ['npm run dev'] })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ base: ['npm'], full: ['npm run dev'] })
    }
  })

  it('rejects non-array lists', () => {
    expect(ApprovedCommandsSchema.safeParse({ base: 'npm' }).success).toBe(false)
    expect(ApprovedCommandsSchema.safeParse({ full: 3 }).success).toBe(false)
  })
})

describe('KoClawMessageSchema', () => {
  it('accepts a non-empty message', () => {
    const result = KoClawMessageSchema.safeParse({ message: 'refactor auth' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.message).toBe('refactor auth')
    }
  })

  it('trims whitespace-only messages and rejects them', () => {
    expect(KoClawMessageSchema.safeParse({ message: '   ' }).success).toBe(false)
  })

  it('rejects missing message or non-object bodies', () => {
    expect(KoClawMessageSchema.safeParse({}).success).toBe(false)
    expect(KoClawMessageSchema.safeParse([]).success).toBe(false)
    expect(KoClawMessageSchema.safeParse(null).success).toBe(false)
  })
})

describe('KoClawStartConfigSchema', () => {
  it('accepts a valid start config', () => {
    const result = KoClawStartConfigSchema.safeParse({ port: 3141, token: 'secret', allowRemoteAccess: true })
    expect(result.success).toBe(true)
  })

  it('rejects invalid ports and missing tokens', () => {
    expect(KoClawStartConfigSchema.safeParse({ port: 0, token: 't' }).success).toBe(false)
    expect(KoClawStartConfigSchema.safeParse({ port: 3141 }).success).toBe(false)
    expect(KoClawStartConfigSchema.safeParse({ port: 1.5, token: 't' }).success).toBe(false)
  })
})

describe('EnvironmentSettingsSchema / sanitizeEnvironment', () => {
  it('parses valid providers and coerced numbers', () => {
    const result = EnvironmentSettingsSchema.safeParse({
      LLM_PROVIDER: 'google',
      MAX_TOKENS: '8192',
      TEMPERATURE: '0.3',
      WEBHOOK_ENABLED: 'true',
      WEBHOOK_PORT: '3141',
    })
    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      LLM_PROVIDER: 'google',
      MAX_TOKENS: 8192,
      TEMPERATURE: 0.3,
      WEBHOOK_ENABLED: 'true',
      WEBHOOK_PORT: 3141,
    })
  })

  it('rejects an unknown provider', () => {
    expect(EnvironmentSettingsSchema.safeParse({ LLM_PROVIDER: 'not-a-provider' }).success).toBe(false)
  })

  it('sanitizeEnvironment returns {} when invalid and strips unknown keys', () => {
    expect(sanitizeEnvironment({ LLM_PROVIDER: 'bogus' })).toEqual({})
    expect(sanitizeEnvironment({ SOME_UNKNOWN: 'x' })).toEqual({})
  })

  it('includes the inception provider in the known list', () => {
    expect(LLM_PROVIDERS).toContain('inception')
  })
})
