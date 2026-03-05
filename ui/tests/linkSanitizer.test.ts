import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { toSafeLink } from '@/lib/link-sanitize';

describe('toSafeLink', () => {
  it('allows approved schemes', () => {
    expect(toSafeLink('https://example.com')).toBe('https://example.com');
    expect(toSafeLink('ipfs://cid/path')).toBe('ipfs://cid/path');
    expect(toSafeLink('ens://name.eth')).toBe('ens://name.eth');
  });

  it('blocks unsafe schemes', () => {
    expect(toSafeLink('javascript:alert(1)')).toBeNull();
    expect(toSafeLink('data:text/html,x')).toBeNull();
    expect(toSafeLink('file:///tmp/a')).toBeNull();
    expect(toSafeLink('blob:https://x')).toBeNull();
    expect(toSafeLink('http://x')).toBeNull();
    expect(toSafeLink('http://x', true)).toBe('http://x');
  });

  it('never returns unsafe clickable urls under fuzzing', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const out = toSafeLink(input, false);
        if (out === null) return true;
        const l = out.toLowerCase();
        return l.startsWith('https://') || l.startsWith('ipfs://') || l.startsWith('ens://');
      })
    );
  });
});
