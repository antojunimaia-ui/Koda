import { describe, expect, it } from 'vitest'
import { estimateTokens, formatTokenCount, truncateToTokenLimit } from '../tokens.js'

describe('estimateTokens', () => {
  it('returns 0 for empty text', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('rounds up to ~4 chars per token', () => {
    expect(estimateTokens('hello')).toBe(2) // ceil(5/4)
    expect(estimateTokens('a')).toBe(1)
    expect(estimateTokens('abcdefgh')).toBe(2)
  })
})

describe('truncateToTokenLimit', () => {
  it('keeps text unchanged when within the limit', () => {
    const text = 'abcd'
    expect(truncateToTokenLimit(text, 1)).toBe(text)
  })

  it('truncates and appends a notice when over the limit', () => {
    const result = truncateToTokenLimit('abcdefgh', 1)
    expect(result).toHaveLength(4 + '\n... [truncated to fit token limit]'.length)
    expect(result).toContain('[truncated to fit token limit]')
    expect(result.startsWith('abcd')).toBe(true)
  })
})

describe('formatTokenCount', () => {
  it('formats plain numbers below 1k', () => {
    expect(formatTokenCount(0)).toBe('0')
    expect(formatTokenCount(999)).toBe('999')
  })

  it('formats thousands with one decimal', () => {
    expect(formatTokenCount(1500)).toBe('1.5k')
  })

  it('formats millions with two decimals', () => {
    expect(formatTokenCount(2_500_000)).toBe('2.50M')
  })
})
