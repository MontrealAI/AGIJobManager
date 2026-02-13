import { describe, it, expect } from 'vitest'

function isOwner(account?: string, owner?: string) {
  return !!account && !!owner && account.toLowerCase() === owner.toLowerCase()
}

describe('admin role gating', () => {
  it('owner only', () => {
    expect(isOwner('0xabc', '0xAbC')).toBe(true)
    expect(isOwner('0xabc', '0xdef')).toBe(false)
  })
})
