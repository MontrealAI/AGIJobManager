import { describe, it, expect } from 'vitest'
import { formatToken, shortAddress, formatTs } from '@/lib/format'

describe('format helpers', () => {
  it('formats', () => {
    expect(shortAddress('0x000000000000000000000000000000000000dEaD')).toContain('…')
    expect(formatToken(1000000000000000000n)).toContain('AGI')
    expect(formatTs(0)).toBe('—')
  })
})
