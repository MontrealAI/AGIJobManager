import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeConsole } from './preservation-normalize.mjs';
const digest = data => createHash('sha256').update(data).digest('hex');
const baseline = JSON.parse(fs.readFileSync(new URL('../../docs/successor/PRESERVATION_BASELINE.json', import.meta.url)));
const changes = JSON.parse(fs.readFileSync(new URL('../../config/next-deployment-contract-changes.json', import.meta.url)));
const reviewedChanges = { ...changes.files, ...changes.evidenceInputs };
function currentExpected(file, historicalHash) {
  const change = reviewedChanges[file];
  if (!change) return historicalHash;
  assert.equal(change.beforeSha256, historicalHash, file + ' must bind the preserved historical source');
  assert.ok(change.purpose, file + ' requires an explicit change rationale');
  return change.afterSha256;
}

test('historical baseline is preserved with only exact inventoried next-deployment source changes', () => {
  for (const [file, expected] of Object.entries(baseline.protectedFiles)) {
    const normalized = baseline.normalizedConsoleFiles[file];
    assert.equal(digest(normalized ? normalizeConsole(fs.readFileSync(file, 'utf8')) : fs.readFileSync(file)), normalized || currentExpected(file, expected), file + ' must match preserved or explicitly reviewed source');
  }
  for (const [file, blocks] of Object.entries(baseline.mermaidBlocks)) {
    const actual = [...fs.readFileSync(file, 'utf8').matchAll(/```mermaid[^\n]*\n[\s\S]*?```/g)].map(m => digest(m[0]));
    for (const expected of blocks) assert.ok(actual.includes(expected), file + ' must retain its original diagram');
  }
  const mainnet = JSON.parse(fs.readFileSync('config/mainnet/agi-jobs-usdc.json'));
  assert.equal(mainnet.activation.intakeActivationAuthorized, false); assert.equal(mainnet.activation.gates.length, 5);
});
test('all existing hosted routes survive, and Builder editions have exact source inventories', () => {
  for (const route of [...baseline.routes, 'successor/index.html', 'fr/successor/index.html']) assert.ok(fs.existsSync('build/pages/' + route), route);
  const info = JSON.parse(fs.readFileSync('build/pages/build-info.json'));
  for (const [file, record] of Object.entries(info.files)) { const bytes = fs.readFileSync('build/pages/' + file); assert.equal(bytes.length, record.bytes); assert.equal(digest(bytes), record.sha256); }
  for (const lang of ['', 'fr/']) {
    const home = fs.readFileSync(`build/pages/${lang}index.html`, 'utf8'); assert.ok(home.includes('data-successor-entry="home" href="./successor/"'));
    const page = fs.readFileSync(`build/pages/${lang}successor/index.html`, 'utf8'); assert.ok(page.includes("connect-src 'none'")); assert.ok(page.includes('sandbox=""')); assert.ok(Buffer.byteLength(page) < 750000, 'Initial uncompressed Builder must remain below 750 KB');
  }
});

test('historical reviews stay unchanged and new fork evidence binds the candidate source', () => {
  const read = name => JSON.parse(fs.readFileSync(name));
  const oldReview = read('scripts/security/slither-reviewed-findings.json'), newReview = read('scripts/security/slither-reviewed-findings-v1.16.1.json');
  assert.deepEqual(newReview.reports, oldReview.reports);
  assert.deepEqual(Object.keys(newReview.source_sha256).sort(), Object.keys(oldReview.source_sha256).sort());
  for (const [file, hash] of Object.entries(newReview.source_sha256)) {
    assert.equal(digest(fs.readFileSync(file)), currentExpected(file, hash), file);
    if (file !== 'package-lock.json') assert.equal(hash, oldReview.source_sha256[file]);
  }
  const oldFork = read('docs/qualification/mainnet-cutover.json'), newFork = read('docs/qualification/mainnet-cutover-v1.16.1.json');
  const { sourceSha256: oldHashes, ...oldOutcomes } = oldFork, { sourceSha256: newHashes, ...newOutcomes } = newFork;
  const currentFork = read('docs/qualification/mainnet-cutover-next-deployment.json');
  const { sourceSha256: currentHashes, ...currentOutcomes } = currentFork;
  assert.deepEqual(currentOutcomes, oldOutcomes);
  assert.deepEqual(Object.keys(currentHashes), Object.keys(oldHashes));
  for (const [file, hash] of Object.entries(currentHashes)) assert.equal(digest(fs.readFileSync(file)), hash, file);
  // Historical Slither records are preserved, not promoted into a current review.
  // The separate strict security workflow must re-run and review changed source.

  assert.deepEqual(newOutcomes, oldOutcomes);
  assert.deepEqual(Object.keys(newHashes), Object.keys(oldHashes));
  for (const [file, hash] of Object.entries(newHashes)) {
    assert.equal(digest(fs.readFileSync(file)), currentExpected(file, hash), file);
    if (!['package.json', 'package-lock.json', 'hardhat/package.json', 'hardhat/package-lock.json'].includes(file)) assert.equal(hash, oldHashes[file]);
  }
});
