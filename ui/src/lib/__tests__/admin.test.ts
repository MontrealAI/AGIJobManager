import { describe, expect, it } from 'vitest'

function isOwner(account?: string, owner?: string) {
  return !!account && !!owner && account.toLowerCase() === owner.toLowerCase()
}

describe('admin gating', () => {
  it('owner vs non-owner', () => {
    expect(isOwner('0xabc', '0xAbC')).toBe(true)
    expect(isOwner('0xabc', '0xdef')).toBe(false)
  })
})
