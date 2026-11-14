import { describe, expect, it } from 'vitest'
import { applyStringEdit, generateDiff } from '../diff.js'

describe('applyStringEdit', () => {
  it('replaces an exact single match', () => {
    const r = applyStringEdit('const a = 1;\nconst b = 2;\n', 'a = 1', 'a = 10')
    expect(r.success).toBe(true)
    expect(r.matchCount).toBe(1)
    expect(r.result).toContain('const a = 10;')
    expect(r.result).not.toContain('const a = 1;')
  })

  it('returns failure when the target is not found', () => {
    const r = applyStringEdit('hello world', 'xyz', 'abc')
    expect(r.success).toBe(false)
    expect(r.matchCount).toBe(0)
    expect(r.result).toBe('hello world')
  })

  it('replaces only the first occurrence when there are multiple matches', () => {
    const r = applyStringEdit('foo bar foo baz', 'foo', 'qux')
    expect(r.success).toBe(true)
    expect(r.matchCount).toBe(2)
    expect(r.result).toBe('qux bar foo baz')
  })
})

describe('generateDiff', () => {
  it('produces a patch containing removed and added lines', () => {
    const patch = generateDiff('test.txt', 'line1\nline2\nline3\n', 'line1\nchanged\nline3\n')
    expect(patch).toContain('-line2')
    expect(patch).toContain('+changed')
  })

  it('mentions the filename in the diff header', () => {
    const patch = generateDiff('example.ts', 'a', 'b')
    expect(patch).toContain('example.ts')
  })
})
