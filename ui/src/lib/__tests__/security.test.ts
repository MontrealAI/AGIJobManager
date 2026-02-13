import { describe, it, expect } from 'vitest'
import { isSafeUri } from '../security'

describe('uri filter', () => {
  it('allows safe schemes', () => {
    expect(isSafeUri('https://example.com')).toBe(true)
    expect(isSafeUri('ipfs://hash')).toBe(true)
  })
  it('blocks javascript', () => expect(isSafeUri('javascript:alert(1)')).toBe(false))
})
