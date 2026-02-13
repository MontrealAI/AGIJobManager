import { describe, it, expect } from 'vitest'
import { estimateDisputeBond } from '../bonds'

describe('bond estimation', () => {
  it('estimates using bps', () => {
    expect(estimateDisputeBond(10000n, 500n)).toBe(500n)
  })
})
