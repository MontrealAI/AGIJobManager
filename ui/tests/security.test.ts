import { describe, it, expect } from 'vitest'
import { parseSafeUri } from '@/lib/uriSafety'

describe('uri allowlist', () => {
  it('allows approved schemes and blocks script/data', () => {
    expect(parseSafeUri('https://example.com')).toBe(true)
    expect(parseSafeUri('ipfs://abc')).toBe(true)
    expect(parseSafeUri('javascript:alert(1)')).toBe(false)
    expect(parseSafeUri('data:text/plain,hi')).toBe(false)
  })
})
