/** Real descriptor growth tests; no native execution or release qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readBoundedNativeSource } from './transformational-native-test.mjs';

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-native-source-'));
  try { return run(root); }
  finally { fs.rmSync(root, { recursive:true, force:true }); }
}

test('native reader retains exact regular-file bytes at the unchanged source limit', () => fixture(root => {
  const file = path.join(root, 'source.mjs');
  for (const bytes of [Buffer.alloc(0), Buffer.from('public source'), Buffer.alloc(2_000_000, 0x20)]) {
    fs.writeFileSync(file, bytes);
    assert.deepEqual(readBoundedNativeSource(file), bytes);
  }
  fs.writeFileSync(file, Buffer.alloc(2_000_001, 0x20));
  assert.throws(() => readBoundedNativeSource(file), /regular-file bound/);
}));

for (const added of [1, 2_000_032]) test('actual post-fstat growth of ' + added + ' bytes is bounded and closes its descriptor', () => fixture(root => {
  const file = path.join(root, 'source.mjs'), original = Buffer.from('public');
  fs.writeFileSync(file, original);
  const fstat = fs.fstatSync, read = fs.readSync, close = fs.closeSync, whole = fs.readFileSync;
  let grew = false, observed = 0, requested = 0, closed = 0, readerDescriptor;
  try {
    fs.fstatSync = (...args) => {
      const stat = fstat(...args);
      if (!grew) { grew = true; readerDescriptor = args[0]; fs.appendFileSync(file, Buffer.alloc(added, 0x20)); }
      return stat;
    };
    fs.readSync = (fd, bytes, offset, length, position) => {
      requested += length;
      assert.ok(bytes.length <= original.length + 1 && length <= original.length + 1);
      const count = read(fd, bytes, offset, length, position); observed += count; return count;
    };
    fs.closeSync = (...args) => { if (args[0] === readerDescriptor) closed++; return close(...args); };
    fs.readFileSync = () => { throw Error('Whole-file descriptor reads are forbidden'); };
    assert.throws(() => readBoundedNativeSource(file), /grew|truncated/);
    assert.equal(observed, original.length + 1);
    assert.equal(requested, original.length + 1);
    assert.equal(closed, 1);
  } finally {
    fs.fstatSync = fstat; fs.readSync = read; fs.closeSync = close; fs.readFileSync = whole;
  }
}));

test('native reader rejects linked files and linked ancestors before reading their bytes', () => fixture(root => {
  const directory = path.join(root, 'reviewed'); fs.mkdirSync(directory);
  const file = path.join(directory, 'source.mjs'); fs.writeFileSync(file, 'public');
  const linked = path.join(root, 'linked.mjs'), ancestor = path.join(root, 'alias');
  fs.symlinkSync(file, linked); fs.symlinkSync(directory, ancestor, 'dir');
  assert.throws(() => readBoundedNativeSource(linked), /No symlink/);
  assert.throws(() => readBoundedNativeSource(path.join(ancestor, 'source.mjs')), /No symlink/);
}));
