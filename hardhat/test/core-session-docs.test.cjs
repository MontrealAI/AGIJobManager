'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('native core endpoint examples cover the exact CLI environment reads with empty defaults', () => {
  const source = read('hardhat/scripts/core-session.cjs');
  const names = [...source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map(match => match[1]).sort();
  assert.deepEqual(names, ['MANAGER_READ_RPC_URL', 'MANAGER_RELAY_RPC_URL']);
  const example = read('hardhat/.env.example');
  const reference = read('docs/DEPLOYMENT_CONFIGURATION.md');
  for (const name of names) {
    assert.equal([...example.matchAll(new RegExp(`^${name}=(.*)$`, 'gm'))].length, 1);
    assert.match(example, new RegExp(`^${name}=$`, 'm'));
    assert(reference.includes('`' + name + '`'));
  }
  assert.match(source, /else if\(command==='relay'\).*MANAGER_RELAY_RPC_URL/);
  assert(!/require\(['"](?:dotenv|\.\/load-env\.cjs|\.\/runtime\.cjs)['"]\)/.test(source));
});

test('endpoint documentation preserves native explicit export and separate once-only relay scope', () => {
  const reference = read('docs/DEPLOYMENT_CONFIGURATION.md');
  assert.match(reference, /does not load `\.env`/);
  assert.match(reference, /Export the needed endpoint explicitly/);
  assert.match(reference, /submits the already checked raw transaction once/);
  assert.match(reference, /does not sign, retry or bump fees/);
  assert.match(reference, /Supplying an endpoint grants no signing, configuration or activation approval/);
  assert.match(reference, /Production requires canonical EIP-1898 block tags/);
});

test('generated repository map exposes the native coordinator and pinned build selector', () => {
  const generator = read('scripts/docs/generate-repo-map.mjs');
  const generated = read('docs/REPO_MAP.md');
  for (const name of ['hardhat/scripts/core-session.cjs', 'hardhat/scripts/qualified-build-catalog.cjs', 'docs/deployment/core-external-signing.md']) {
    assert(generator.includes(name));
    assert(generated.includes(name));
  }
  assert.match(generated, /configuration and activation separate/);
});
