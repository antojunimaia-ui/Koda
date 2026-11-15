import { describe, expect, it } from 'vitest'
import { parseDeepLink } from '../deeplink-parse.js'

describe('parseDeepLink', () => {
  it('parseia koda://workspace/<id>', () => {
    expect(parseDeepLink('koda://workspace/AbC123zZ9xY8wV7u')).toEqual({
      kind: 'workspace',
      id: 'AbC123zZ9xY8wV7u',
    })
  })

  it('parseia koda://<id> como fallback', () => {
    expect(parseDeepLink('koda://AbC123zZ9xY8wV7u')).toEqual({
      kind: 'workspace',
      id: 'AbC123zZ9xY8wV7u',
    })
  })

  it('ignora URLs de outros protocolos', () => {
    expect(parseDeepLink('https://koda.dev/workspace/abc')).toBeNull()
    expect(parseDeepLink('file:///tmp/x')).toBeNull()
  })

  it('retorna null para URLs malformadas ou sem id', () => {
    expect(parseDeepLink('not-a-url')).toBeNull()
    expect(parseDeepLink('koda://workspace/')).toBeNull()
  })
})
