import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
test('patched uuid preserves SDK v4 generation and rejects advisory buffer-overrun cases', () => {
  const { v4, v5, v6, validate } = require('uuid');
  assert.equal(validate(v4()), true);
  assert.throws(() => v5('x', '6ba7b810-9dad-11d1-80b4-00c04fd430c8', new Uint8Array(8), 4), RangeError);
  assert.throws(() => v6({}, new Uint8Array(8), 4), RangeError);
});
test('exact patch overrides and all resolved affected packages match reviewed versions', async () => {
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  for (const [path, pkg] of Object.entries(lock.packages)) {
    if (path.endsWith('/uuid')) assert.equal(pkg.version, '11.1.1');
    if (path.endsWith('/ws')) assert.ok(['8.21.0', '8.22.0'].includes(pkg.version));
  }
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(pkg.overrides, { 'ethers@6.14.1': { ws: '8.21.0' }, uuid: '11.1.1' });
});
