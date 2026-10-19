#!/usr/bin/env node
// Disposable filesystem tests only; no chain, Git fetch, install or secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const wrapper = path.join(root, 'scripts/qualification/run-native-campaigns.py');
const guard = (directory, file) => spawnSync('python3', ['-B', '-c', "import importlib.util,sys,pathlib;sys.dont_write_bytecode=True;s=importlib.util.spec_from_file_location('w',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.read_regular(pathlib.Path(sys.argv[2]),sys.argv[3])", wrapper, directory, file], { encoding: 'utf8', env: { PATH: '/usr/local/bin:/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' } });
for (const suite of ['full', 'marker']) {
  const script = path.join(root, 'runners', suite, 'scripts/qualification/core-session-native.mjs');
  const { copyTrackedFixtureEntry } = await import(pathToFileURL(script));
  for (const mode of [0o644, 0o755]) test(`${suite}: independent copy preserves ${mode.toString(8)} bytes/mode and source nlink1`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-fixture-copy-'));
    try {
      const source = path.join(dir, 'source'), copy = path.join(dir, 'copy');
      fs.writeFileSync(source, 'reviewed fixture bytes\n', { mode });
      assert.equal(fs.statSync(source).nlink, 1); assert.equal(guard(dir, 'source').status, 0);
      copyTrackedFixtureEntry(source, copy);
      assert.deepEqual(fs.readFileSync(copy), fs.readFileSync(source));
      assert.equal(fs.statSync(copy).mode & 0o777, mode);
      assert.notEqual(fs.statSync(copy).ino, fs.statSync(source).ino);
      assert.equal(fs.statSync(copy).nlink, 1); assert.equal(fs.statSync(source).nlink, 1);
      assert.equal(guard(dir, 'copy').status, 0); assert.equal(guard(dir, 'source').status, 0);
      fs.appendFileSync(copy, 'changed negative fixture\n'); fs.chmodSync(copy, 0o600);
      assert.equal(fs.readFileSync(source, 'utf8'), 'reviewed fixture bytes\n');
      assert.equal(fs.statSync(source).mode & 0o777, mode); assert.equal(fs.statSync(source).nlink, 1);
      assert.equal(guard(dir, 'source').status, 0);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test(`${suite}: tracked symlink target is preserved without dereference`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-fixture-symlink-'));
    try { const source = path.join(dir, 'source'), copy = path.join(dir, 'copy'); fs.symlinkSync('../relative-target', source); copyTrackedFixtureEntry(source, copy); assert(fs.lstatSync(copy).isSymbolicLink()); assert.equal(fs.readlinkSync(copy), '../relative-target'); assert.equal(fs.readlinkSync(source), '../relative-target'); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test(`${suite}: actual wrapper still rejects the old retained hardlink pattern`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-fixture-hardlink-'));
    try { fs.writeFileSync(path.join(dir, 'source'), 'reviewed\n'); fs.linkSync(path.join(dir, 'source'), path.join(dir, 'old-copy')); assert.equal(fs.statSync(path.join(dir, 'source')).nlink, 2); const result = guard(dir, 'source'); assert.notEqual(result.status, 0); assert.match(result.stderr, /Non-regular or hard-linked file/); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test(`${suite}: sourceCases invokes the tested copy helper and keeps hardlink creation absent`, () => {
    const code = fs.readFileSync(script, 'utf8'); assert.equal((code.match(/copyTrackedFixtureEntry\(from, into\);/g) || []).length, 1); assert(!code.includes('fs.linkSync(')); assert(code.includes('fs.constants.COPYFILE_EXCL'));
  });
}
