import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeConsole } from './preservation-normalize.mjs';
const digest = data => createHash('sha256').update(data).digest('hex');
const baseline = JSON.parse(fs.readFileSync(new URL('../../docs/successor/PRESERVATION_BASELINE.json', import.meta.url)));
const changes = JSON.parse(fs.readFileSync(new URL('../../config/next-deployment-contract-changes.json', import.meta.url)));
const candidate = JSON.parse(fs.readFileSync(new URL('../../config/explicit-governor-source-v1.json', import.meta.url)));
const compiler = JSON.parse(fs.readFileSync(new URL('../../config/compiler-optimizer-transition-v1.json', import.meta.url)));
const compilerChanges = Object.fromEntries(Object.entries(compiler.configs).map(([file, change]) => [file, { ...change, purpose: compiler.scope }]));
const reviewedChanges = [changes.files, changes.evidenceInputs, candidate.changedContracts, compilerChanges,
  Object.fromEntries(Object.entries(candidate.inputs).filter(([, input]) => input.reviewReason).map(([file, input]) => [file, {
    beforeSha256: input.predecessorSha256, afterSha256: input.sha256, purpose: input.reviewReason,
  }]))];
function currentExpected(file, historicalHash) {
  const transitions = reviewedChanges.map(inventory => inventory?.[file]).filter(Boolean);
  const seen = new Set();
  let expected = historicalHash;
  while (true) {
    assert.ok(!seen.has(expected), file + ' must not contain a review transition cycle');
    seen.add(expected);
    const next = transitions.filter(change => change.beforeSha256 === expected && change.afterSha256 !== expected);
    if (!next.length) return expected;
    assert.equal(new Set(next.map(change => change.afterSha256)).size, 1, file + ' must have one reviewed source successor');
    for (const change of next) {
      assert.equal(change.beforeSha256, expected, file + ' must bind the preserved historical source');
      assert.ok(change.purpose || change.reason, file + ' requires an explicit change rationale');
    }
    expected = next[0].afterSha256;
  }
}

test('historical baseline is preserved with only exact inventoried next-deployment source changes', () => {
  const originalTest = 'test/fixtures/preservation.pre-c174-integration.test.mjs.txt';
  assert.equal(candidate.protectedHistory['scripts/successor/preservation.test.mjs'].retainedPath, originalTest);
  assert.equal(digest(fs.readFileSync(originalTest)), 'a8803040142613f6b193b74aa42522813ebc94056673947dbd8a183ae0a3577b', 'Original preservation assertions must remain available unchanged');
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
  assert.equal(digest(fs.readFileSync('docs/qualification/mainnet-cutover-next-deployment.json')), '36bc8cfb2d3d8e15b04372ea1fbed3fe407a921c0d70b525d673be4447f63746', 'Historical next-deployment fork evidence must remain unchanged');
  const currentFork = read('docs/qualification/mainnet-cutover-integrated-20261017.json');
  const { sourceSha256: currentHashes, ...currentOutcomes } = currentFork;
  assert.deepEqual(currentOutcomes, oldOutcomes);
  assert.deepEqual(Object.keys(currentHashes).sort(), [...Object.keys(oldHashes), 'hardhat/compiler-optimizer.cjs', 'config/compiler-optimizer-transition-v1.json'].sort());
  for (const [file, hash] of Object.entries(currentHashes)) assert.equal(digest(fs.readFileSync(file)), hash, file);
  // Historical Slither records are preserved, not promoted into a current review.
  // The separate strict security workflow must re-run and review changed source.

  assert.deepEqual(newOutcomes, oldOutcomes);
  assert.deepEqual(Object.keys(newHashes), Object.keys(oldHashes));
  for (const [file, hash] of Object.entries(newHashes)) {
    assert.ok(Object.hasOwn(currentHashes, file), file + ' must remain covered by the separate actual integrated execution');
    if (!['package.json', 'package-lock.json', 'hardhat/package.json', 'hardhat/package-lock.json'].includes(file)) assert.equal(hash, oldHashes[file]);
  }
});

test('runtime-bytecode review preserves the v1.18.0 expectations and binds the rerun source exactly', () => {
  const review = JSON.parse(fs.readFileSync('config/runtime-bytecode-qualification-20261016.json'));
  assert.equal(review.schema, 'agijobmanager/runtime-bytecode-qualification/v1');
  assert.deepEqual(Object.keys(review.files).sort(), [
    'hardhat/scripts/deploy.cjs', 'hardhat/scripts/deployment-safety.cjs', 'hardhat/test/deployment-preflight.test.cjs',
  ]);
  for (const [file, change] of Object.entries(review.files)) {
    assert.equal(digest(fs.readFileSync(file)), change.afterSha256, file);
    assert.ok(change.purpose, file);
  }
  for (const [file, record] of Object.entries(review.preservedRecords)) {
    assert.equal(digest(fs.readFileSync(file)), record.sha256, file + ' must retain the exact prior expected bytes');
  }
  const historical = JSON.parse(fs.readFileSync(review.fork.previousExpected));
  const current = JSON.parse(fs.readFileSync(review.fork.currentExpected));
  assert.equal(digest(fs.readFileSync(review.fork.currentExpected)), review.fork.reportSha256);
  assert.equal(current.passed, 23); assert.equal(current.publicTransactionsBroadcast, 0);
  assert.equal(current.productionActivationApproved, false);
  const changedInputs = Object.keys(current.sourceSha256).filter(file => current.sourceSha256[file] !== historical.sourceSha256[file]);
  assert.deepEqual(changedInputs, ['hardhat/scripts/deployment-safety.cjs']);
  assert.equal(current.sourceSha256[changedInputs[0]], review.files[changedInputs[0]].afterSha256);
  assert.equal(changes.evidenceInputs[changedInputs[0]].afterSha256, review.files[changedInputs[0]].afterSha256);
  const { sourceSha256: previousHashes, ...previousOutcomes } = historical;
  const { sourceSha256: currentHashes, ...currentOutcomes } = current;
  assert.deepEqual(Object.keys(currentHashes), Object.keys(previousHashes));
  assert.deepEqual(currentOutcomes, previousOutcomes);
});
