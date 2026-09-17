#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const manifest = require('./openzeppelin-compiler-patches.json');
const digest = source => crypto.createHash('sha256').update(source).digest('hex');

function patchSource(name, source) {
  const entry = manifest.files[name];
  if (!entry) throw new Error('Unreviewed OpenZeppelin compatibility patch path.');
  const current = digest(source);
  if (current === entry.patched) return source;
  if (current !== entry.original) throw new Error(`Unreviewed OpenZeppelin source ${name}; review compatibility before patching.`);
  let result = source.toString('utf8');
  if (entry.renamedIdentifiers) {
    result = result.replaceAll('RecoverError error', 'RecoverError recoverError')
      .replaceAll('(error ==', '(recoverError ==')
      .replaceAll('_throwError(error)', '_throwError(recoverError)');
  }
  result = result.replace(/^([ \t]*)\/\/\/ @solidity memory-safe-assembly\n\1assembly \{/gm, '$1assembly ("memory-safe") {');
  if (digest(result) !== entry.patched) throw new Error(`Unexpected OpenZeppelin compatibility patch result: ${name}.`);
  return Buffer.from(result);
}

function main() {
  let checked = 0;
  for (const workspace of [root, path.join(root, 'hardhat')]) {
    const directory = path.join(workspace, 'node_modules/@openzeppelin/contracts');
    if (!fs.existsSync(directory)) continue;
    const pending = Object.keys(manifest.files).map(name => {
      const file = path.join(directory, name);
      const source = fs.readFileSync(file);
      return { file, source, result: patchSource(name, source) };
    });
    for (const { file, source, result } of pending) {
      if (!source.equals(result)) fs.writeFileSync(file, result);
    }
    ++checked;
  }
  if (checked === 0) throw new Error('Install the pinned root OpenZeppelin dependency before compiling.');
  process.stdout.write(`Verified OpenZeppelin 4.9.6 compiler compatibility (${checked} installed copies).\n`);
}

module.exports = { patchSource, manifest };
if (require.main === module) main();
