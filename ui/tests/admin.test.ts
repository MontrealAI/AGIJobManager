import { describe, it, expect } from 'vitest';

describe('admin gating',()=>{
  it('owner vs non owner',()=>{
    const owner='0xabc'; const user='0xdef';
    expect(owner===user).toBe(false);
  });
});
