import { describe, expect, it } from 'vitest'
import { parseAppArgs } from '../appArgs.js'

describe('parseAppArgs', () => {
  it('parseia mode/ws/window', () => {
    const a = parseAppArgs('?mode=panel&ws=abc123&window=ide')
    expect(a.mode).toBe('panel')
    expect(a.ws).toBe('abc123')
    expect(a.window).toBe('ide')
  })

  it('flags boolean aceitam 1 e true', () => {
    expect(parseAppArgs('?hideTitlebar=1').hideTitlebar).toBe(true)
    expect(parseAppArgs('?hideIconbar=true').hideIconbar).toBe(true)
    expect(parseAppArgs('?hideTabs=0').hideTabs).toBe(false)
    expect(parseAppArgs('').hideTitlebar).toBe(false)
  })

  it('ausência de parâmetros retorna defaults false', () => {
    const a = parseAppArgs('?mode=panel&ws=x')
    expect(a.hideTitlebar).toBe(false)
    expect(a.hideIconbar).toBe(false)
    expect(a.hideTabs).toBe(false)
    expect(a.hideHistory).toBe(false)
  })

  it('hideHistory aceita 1/true', () => {
    expect(parseAppArgs('?hideHistory=1').hideHistory).toBe(true)
    expect(parseAppArgs('?hideHistory=true').hideHistory).toBe(true)
    expect(parseAppArgs('?hideHistory=0').hideHistory).toBe(false)
  })
})
