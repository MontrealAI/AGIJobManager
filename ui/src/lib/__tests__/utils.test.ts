import { describe, expect, it } from 'vitest'
import { isSafeUri } from '../security'
import { formatToken, shortAddress, formatTimestamp } from '../format'

describe('security and format', () => {
  it('allows safe schemes only', () => {
    expect(isSafeUri('ipfs://a')).toBe(true)
    expect(isSafeUri('javascript:alert(1)')).toBe(false)
  })

  it('formats helpers', () => {
    expect(formatToken(1000000000000000000n)).toContain('AGI')
    expect(shortAddress('0x1234567890123456789012345678901234567890')).toContain('…')
    expect(formatTimestamp(0n)).toBe('—')
  })
})
