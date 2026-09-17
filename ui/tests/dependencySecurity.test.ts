import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const decode = require('decode-uri-component');
const queryString = require('query-string');
const uuid = require('uuid');

describe('patched wallet dependency compatibility', () => {
  it('preserves synchronous CommonJS decoding and wallet query parsing', () => {
    expect(decode('%E2%9C%93%20USDC')).toBe('✓ USDC');
    expect(queryString.parse('name=%E2%9C%93&invalid=%FF')).toEqual({name:'✓', invalid:'%FF'});
  });
  it('handles long malformed input without recursive decoding or stack exhaustion', () => {
    const malformed = '%FF'.repeat(4096);
    expect(decode(malformed)).toBe(malformed);
    expect(queryString.parse('uri=' + malformed).uri).toBe(malformed);
  });
  it('retains the named UUID APIs used by the wallet SDKs', () => {
    const id = uuid.v4();
    expect(uuid.validate(id)).toBe(true);
    expect(uuid.version(id)).toBe(4);
    expect(uuid.v5('usdc', uuid.v5.DNS)).toBe(uuid.v5('usdc', uuid.v5.DNS));
  });
});
