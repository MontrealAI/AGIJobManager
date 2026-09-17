'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { patchSource, manifest } = require('./patch-openzeppelin-compiler.cjs');
const digest = source => crypto.createHash('sha256').update(source).digest('hex');
const fixtures = Object.entries(manifest.files).map(([name, entry]) => {
  const installed = fs.readFileSync(path.resolve(__dirname, '../../node_modules/@openzeppelin/contracts', name));
  const compatible = patchSource(name, installed);
  const upstream = Buffer.from(compatible.toString('utf8').replaceAll('recoverError', 'error')
    .replace(/^([ \t]*)assembly \("memory-safe"\) \{/gm, '$1/// @solidity memory-safe-assembly\n$1assembly {'));
  return { name, entry, upstream, compatible };
});

test('the pinned original source produces exactly the reviewed compatible source', () => {
  for (const { name, entry, upstream, compatible } of fixtures) {
    assert.equal(digest(upstream), entry.original, name);
    assert.equal(digest(patchSource(name, upstream)), entry.patched, name);
    assert.deepEqual(patchSource(name, upstream), compatible, name);
  }
});

test('the compatibility patch is idempotent', () => {
  for (const { name, compatible } of fixtures) assert.deepEqual(patchSource(name, compatible), compatible, name);
});

test('unreviewed originals and modified patched files are rejected', () => {
  for (const { name, upstream, compatible } of fixtures) {
    for (const source of [upstream, compatible]) {
      assert.throws(() => patchSource(name, Buffer.concat([source, Buffer.from('\n')])), /Unreviewed/);
    }
  }
  assert.throws(() => patchSource('unknown.sol', Buffer.from('')), /Unreviewed/);
});

test('only the documented identifier and existing memory-safety annotations change', () => {
  for (const { name, entry, compatible } of fixtures) {
    assert.equal((compatible.toString().match(/\brecoverError\b/g) || []).length, entry.renamedIdentifiers, name);
    assert.equal((compatible.toString().match(/assembly \("memory-safe"\)/g) || []).length, entry.memorySafeBlocks, name);
  }
});
