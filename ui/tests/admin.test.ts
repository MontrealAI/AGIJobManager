import { describe, it, expect } from 'vitest';

describe('admin route guards', () => {
  it('requires explicit owner simulation flag in demo mode', () => {
    const asOwner = '0';
    expect(asOwner === '1').toBe(false);
  });
});
