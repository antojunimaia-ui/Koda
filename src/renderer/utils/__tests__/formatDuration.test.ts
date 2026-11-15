import { describe, expect, it } from 'vitest'
import { formatDuration } from '../formatDuration.js'

describe('formatDuration', () => {
  it('shows seconds below a minute (including 0s)', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(999)).toBe('0s')
    expect(formatDuration(1_000)).toBe('1s')
    expect(formatDuration(59_999)).toBe('59s')
  })

  it('shows minutes below an hour', () => {
    expect(formatDuration(60_000)).toBe('1m')
    expect(formatDuration(125_000)).toBe('2m')
    expect(formatDuration(3_599_000)).toBe('59m')
  })

  it('shows hours and days like Antigravity', () => {
    expect(formatDuration(3_600_000)).toBe('1h')
    expect(formatDuration(3_900_000)).toBe('1h 5m')
    expect(formatDuration(86_400_000)).toBe('1d 0h 0m')
    expect(formatDuration(90_000_000)).toBe('1d 1h 0m')
  })
})
