import { describe, expect, it } from 'vitest'
import { canModerate, isOwner } from '../roles'

describe('role gating', () => {
  it('matches owner case-insensitively', () => {
    expect(isOwner('0xabcDEF', '0xABCdef')).toBe(true)
  })

  it('rejects non moderator', () => {
    expect(canModerate('0xabc', false)).toBe(false)
  })
})
