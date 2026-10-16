import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { reproduceLocalBuild, digest } from '../trust/local-build.mjs';

const nativeCompiler = process.env.COMPANION_TEST_NATIVE_SOLC && fs.realpathSync(process.env.COMPANION_TEST_NATIVE_SOLC);
const required = process.env.COMPANION_REQUIRE_NATIVE_COMPILER === '1';
const compiled = { skip: !nativeCompiler && !required };
const clone = value => JSON.parse(JSON.stringify(value));
const source = { repository: 'SYNTHETIC-INDEPENDENT-COMPILER-UNIT-ONLY', commit: '7'.repeat(40), tree: '8'.repeat(40) };
const write = (file, value) => { fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 }); return { path: file, sha256: digest(fs.readFileSync(file)) }; };
function fixture(t) {
  assert.ok(nativeCompiler, 'COMPANION_TEST_NATIVE_SOLC is required for this independent compiler acceptance');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'independent-compiler-boundary-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const checkout = path.join(directory, 'source'); fs.mkdirSync(checkout, { mode: 0o700 });
  const content = 'pragma solidity 0.8.37;contract C{uint256 public immutable n;constructor(uint256 x){n=x;}}';
  const input = { language: 'Solidity', sources: { 'C.sol': { content } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'osaka', outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'] } } } };
  const output = JSON.parse(execFileSync(nativeCompiler, ['--standard-json'], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  const sourceFile = write(path.join(checkout, 'C.sol'), content), inputFile = write(path.join(directory, 'input.json'), input), outputFile = write(path.join(directory, 'output.json'), output);
  const version = execFileSync(nativeCompiler, ['--version'], { encoding: 'utf8' }).split(/\r?\n/).find(x => x.startsWith('Version: ')).slice(9);
  const policy = { schema: 'manual-ledger-local-build-policy-v1', source: clone(source), campaignSha256: '1'.repeat(64), planSha256: '2'.repeat(64), builds: [{ id: 'independent-native-compiler-unit', compiler: { kind: 'native', path: nativeCompiler, sha256: digest(fs.readFileSync(nativeCompiler)), version }, input: inputFile, sources: { 'C.sol': sourceFile }, outputs: [{ kind: 'compiler-output', ...outputFile }], contracts: { C: 'C.sol:C' } }] };
  return { directory, checkout, sourceFile, outputFile, policy, args: { policy, expectedPolicySha256: digest(policy), sourceRoot: checkout, observeSource: () => clone(source) } };
}

test('independent native-compiler acceptance cannot silently skip when required', () => { if (required) assert.ok(nativeCompiler, 'COMPANION_TEST_NATIVE_SOLC is required'); });
test('independent: local source revision drift after actual compilation rejects the build receipt', compiled, t => {
  const f = fixture(t); let reads = 0;
  assert.throws(() => reproduceLocalBuild({ ...f.args, observeSource: () => ++reads === 1 ? clone(source) : { ...source, commit: '9'.repeat(40) } }), { code: 'TRUST_SOURCE_CHANGED_DURING_BUILD' });
  assert.equal(reads, 2);
});
test('independent: published compiler source closure cannot resolve through a same-bytes symlink', compiled, t => {
  const f = fixture(t), alias = path.join(f.checkout, 'alias.sol'); fs.symlinkSync(f.sourceFile.path, alias);
  f.policy.builds[0].sources['C.sol'] = { ...f.sourceFile, path: alias };
  assert.throws(() => reproduceLocalBuild({ ...f.args, expectedPolicySha256: digest(f.policy) }), { code: 'TRUST_REAL_FILE_REQUIRED' });
});
test('independent: immutable compiler records and receipt resist caller mutation', compiled, t => {
  const f = fixture(t), build = reproduceLocalBuild(f.args);
  assert.equal(typeof build.contracts.set, 'undefined'); assert.equal(typeof build.contracts.delete, 'undefined');
  assert.ok(Object.isFrozen(build.contracts)); assert.ok(Object.isFrozen(build.contracts.get('C'))); assert.ok(Object.isFrozen(build.contracts.get('C').abi));
  assert.throws(() => { build.contracts.get('C').bytecode = '00'; }, TypeError);
  const names = build.contracts.names(); names.push('UNREVIEWED'); assert.deepEqual(build.contracts.names(), ['C']);
  f.policy.source.commit = '3'.repeat(40); assert.equal(build.receipt.source.commit, source.commit);
  assert.equal(build.receipt.physicalQualified, false); assert.equal(build.receipt.authorityComplete, false); assert.equal(build.receipt.activationAuthorized, false);
});
test('independent: a semantically equal but byte-changed retained compiler output invalidates restart trust', compiled, t => {
  const f = fixture(t), build = reproduceLocalBuild(f.args); assert.equal(build.assertUnchanged(), true);
  fs.appendFileSync(f.outputFile.path, '\n');
  assert.throws(() => build.assertUnchanged(), { code: 'TRUST_FILE_CHANGED' });
});
