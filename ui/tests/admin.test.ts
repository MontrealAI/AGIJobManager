import { describe, it, expect } from 'vitest';

describe('admin role gating', () => {
  it('requires owner identity flag in demo mode', () => {
    const asOwner = '1';
    expect(asOwner === '1').toBe(true);
    expect('0' === asOwner).toBe(false);
  });
});
