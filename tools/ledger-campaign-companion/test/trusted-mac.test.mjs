import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Interface, Transaction, getCreateAddress, keccak256 } from 'ethers';
import { reproduceLocalBuild, bindCampaignToLocalBuild, createTrustedCampaignContext, assertCampaignUnstartedForReplacement, assertTrustedSigningHost, digest } from '../trust/local-build.mjs';

const driver = fileURLToPath(new URL('../trust/soljson-driver.cjs', import.meta.url));
const compiler = process.env.COMPANION_TEST_SOLJSON && fs.realpathSync(process.env.COMPANION_TEST_SOLJSON);
const nativeCompiler = process.env.COMPANION_TEST_NATIVE_SOLC && fs.realpathSync(process.env.COMPANION_TEST_NATIVE_SOLC);
const requireCompiler = process.env.COMPANION_REQUIRE_COMPILER === '1';
const source = { repository: 'SYNTHETIC-TRUST-TEST-NOT-NATIVE-COORDINATOR', commit: '1'.repeat(40), tree: '2'.repeat(40) };
const governor = '0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99', creator = '0x1111111111111111111111111111111111111111';
const clone = value => JSON.parse(JSON.stringify(value));
const compilerTest = { skip: !compiler && !requireCompiler };
const write = (filename, value) => { fs.writeFileSync(filename, typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 }); return { path: filename, sha256: digest(fs.readFileSync(filename)) }; };
function link(object, references, libraries) { let output = object; for (const names of Object.values(references || {})) for (const [name, rows] of Object.entries(names)) for (const row of rows) output = output.slice(0, row.start * 2) + libraries[name].slice(2).toLowerCase() + output.slice((row.start + row.length) * 2); return output; }
let fixtureValue;
function fixture(t) {
  assert.ok(compiler, 'COMPANION_TEST_SOLJSON must name the independently pinned compiler for this required acceptance run');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-local-build-')); fs.chmodSync(root, 0o700); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const checkout = path.join(root, 'reviewed-checkout'); fs.mkdirSync(checkout, { mode: 0o700 });
  const names = [...Array.from({ length: 8 }, (_, index) => `L${index}`), 'C'];
  const content = 'pragma solidity 0.8.37;' + names.slice(0, 8).map(name => `library ${name}{function f(uint256 x) external pure returns(uint256){return x+1;}}`).join('') + 'contract C{address public immutable governor;constructor(address selected){governor=selected;}function f(uint256 x)external view returns(uint256){return L0.f(x);}}';
  const input = { language: 'Solidity', sources: { 'T.sol': { content } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'osaka', outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'] } } } };
  if (!fixtureValue) {
    const result = JSON.parse(execFileSync(fs.realpathSync(process.execPath), [driver], { input: JSON.stringify({ compilerPath: compiler, compilerSha256: digest(fs.readFileSync(compiler)), expectedVersion: '0.8.37+commit.f401782d.Emscripten.clang', input }), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
    assert.equal(result.version, '0.8.37+commit.f401782d.Emscripten.clang'); assert.ok(result.output.contracts['T.sol'].C.evm.deployedBytecode.immutableReferences); fixtureValue = result.output;
  }
  const output = clone(fixtureValue), sourceFile = write(path.join(checkout, 'T.sol'), content), inputFile = write(path.join(root, 'input.json'), input), outputFile = write(path.join(root, 'output.json'), output);
  const libraries = Object.fromEntries(names.slice(0, 8).map((name, nonce) => [name, getCreateAddress({ from: creator, nonce })]));
  const operations = names.map((name, nonce) => {
    const contract = output.contracts['T.sol'][name], args = name === 'C' ? [governor] : [];
    const envelope = { type: 2, chainId: 1, from: creator, nonce, to: null, value: '0', data: '0x' + link(contract.evm.bytecode.object, contract.evm.bytecode.linkReferences, libraries) + new Interface(contract.abi).encodeDeploy(args).slice(2), gasLimit: '8000000', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000', accessList: [] };
    return { name, predictedAddress: getCreateAddress({ from: creator, nonce }), constructorArguments: args, libraries, envelope };
  });
  const plan = { operations, payloadSha256: '3'.repeat(64) }, planPath = path.join(root, 'plan.json'); write(planPath, plan);
  const campaign = { adapter: 'manager', actors: { creator, governor }, coordinator: { planPath }, reviewedManifest: { source, planSha256: plan.payloadSha256, operations: operations.map((operation, index) => { const { from, ...envelope } = operation.envelope; const tx = Transaction.from(envelope); return { operationId: `toy-${index}`, unsignedHex: tx.unsignedSerialized, expectedUnsignedHash: keccak256(tx.unsignedSerialized), review: { expectedSender: from } }; }) } };
  const policy = { schema: 'manual-ledger-local-build-policy-v1', source, campaignSha256: digest(campaign), planSha256: plan.payloadSha256, builds: [{ id: 'toy-compiler-acceptance', compiler: { kind: 'soljson', path: compiler, sha256: digest(fs.readFileSync(compiler)), version: '0.8.37+commit.f401782d.Emscripten.clang', nodePath: fs.realpathSync(process.execPath), nodeSha256: digest(fs.readFileSync(fs.realpathSync(process.execPath))), nodeVersion: process.versions.node }, input: inputFile, sources: { 'T.sol': sourceFile }, outputs: [{ kind: 'compiler-output', ...outputFile }], contracts: Object.fromEntries(names.map(name => [name, `T.sol:${name}`])) }] };
  const argumentsValue = { policy, expectedPolicySha256: digest(policy), sourceRoot: checkout, observeSource: () => clone(source) };
  return { root, checkout, input, output, sourceFile, campaign, plan, policy, argumentsValue, reanchor() { this.argumentsValue.expectedPolicySha256 = digest(this.policy); } };
}

test('required compiler acceptance never silently skips a missing compiler', () => { if (requireCompiler) assert.ok(compiler, 'COMPANION_TEST_SOLJSON is required'); });
test('genuine pinned soljson compiles complete source and binds nine toy CREATEs, linked library and immutable reference', compilerTest, t => {
  const f = fixture(t), build = reproduceLocalBuild(f.argumentsValue), result = bindCampaignToLocalBuild({ campaign: f.campaign, plan: f.plan, build, nativePlanValidated: true });
  assert.equal(result.operations.length, 9); assert.equal(result.locallyRecompiled, true); assert.equal(result.exactTransactionBytesValidated, true); assert.equal(result.physicalQualified, false); assert.equal(result.activationAuthorized, false); assert.equal(typeof build.contracts.set, 'undefined'); assert.ok(Object.keys(build.contracts.get('C').immutableReferences).length > 0); assert.equal(build.assertUnchanged(), true);
});
test('independent review anchor and exact source observer are mandatory before compiler execution', compilerTest, t => {
  const f = fixture(t); assert.throws(() => reproduceLocalBuild({ ...f.argumentsValue, expectedPolicySha256: 'a'.repeat(64) }), /INDEPENDENT_TRUST_POLICY_REQUIRED/);
  assert.throws(() => reproduceLocalBuild({ ...f.argumentsValue, observeSource: () => ({ ...source, commit: '4'.repeat(40) }) }), /TRUST_SOURCE_MISMATCH/);
});
test('changed compiler, Node binary, version and source bytes are independently rejected', compilerTest, t => {
  for (const change of [f => { f.policy.builds[0].compiler.sha256 = 'a'.repeat(64); }, f => { f.policy.builds[0].compiler.nodeSha256 = 'a'.repeat(64); }, f => { f.policy.builds[0].compiler.nodeVersion = '0.0.0'; }, f => fs.appendFileSync(f.sourceFile.path, '\n// altered')]) { const f = fixture(t); change(f); f.reanchor(); assert.throws(() => reproduceLocalBuild(f.argumentsValue)); }
});
test('missing, external, URL or changed compiler source closure cannot rely on Ubuntu claims', compilerTest, t => {
  for (const change of [f => { f.policy.builds[0].sources = {}; }, f => { f.policy.builds[0].sources['T.sol'] = write(path.join(f.root, 'outside.sol'), f.input.sources['T.sol'].content); }, f => { f.input.sources['T.sol'] = { urls: ['https://untrusted.invalid/T.sol'] }; f.policy.builds[0].input = write(f.policy.builds[0].input.path, f.input); }, f => { f.input.sources['T.sol'].content += 'contract Evil{}'; f.policy.builds[0].input = write(f.policy.builds[0].input.path, f.input); }]) { const f = fixture(t); change(f); f.reanchor(); assert.throws(() => reproduceLocalBuild(f.argumentsValue)); }
});
test('recomputed Ubuntu output hash does not replace local compiler reproduction', compilerTest, t => {
  const f = fixture(t); f.output.contracts['T.sol'].C.evm.bytecode.object += '00'; f.policy.builds[0].outputs[0] = { kind: 'compiler-output', ...write(path.join(f.root, 'output.json'), f.output) }; f.reanchor(); assert.throws(() => reproduceLocalBuild(f.argumentsValue), /LOCAL_COMPILER_OUTPUT_MISMATCH/);
});
test('compiler input settings and build artifacts must reproduce exactly', compilerTest, t => {
  const f = fixture(t); f.input.settings.optimizer.runs++; f.policy.builds[0].input = write(f.policy.builds[0].input.path, f.input); f.reanchor(); assert.throws(() => reproduceLocalBuild(f.argumentsValue), /LOCAL_COMPILER_OUTPUT_MISMATCH/);
});
test('full locally reproduced initcode, nonce/address, governor and campaign bindings reject substitutions', compilerTest, t => {
  const f = fixture(t), build = reproduceLocalBuild(f.argumentsValue);
  assert.throws(() => bindCampaignToLocalBuild({ campaign: f.campaign, plan: f.plan, build }), /LOCAL_NATIVE_PLAN_VALIDATION_REQUIRED/);
  for (const change of [x => { x.plan.operations[8].constructorArguments = [creator]; }, x => { x.plan.operations[0].predictedAddress = governor; }, x => { x.plan.operations[8].libraries.L0 = governor; }, x => { x.campaign.actors.governor = creator; }, x => { const tx = Transaction.from(x.campaign.reviewedManifest.operations[8].unsignedHex); tx.nonce++; x.campaign.reviewedManifest.operations[8].unsignedHex = tx.unsignedSerialized; }]) { const x = { campaign: clone(f.campaign), plan: clone(f.plan) }; change(x); assert.throws(() => bindCampaignToLocalBuild({ ...x, build, nativePlanValidated: true })); }
});
test('restart guard rehashes compiler/source/output closure and the local native plan', compilerTest, t => {
  const f = fixture(t), context = createTrustedCampaignContext({ ...f.argumentsValue, campaign: f.campaign, plan: f.plan, nativePlanValidated: true }); assert.equal(context.assertUnchanged(), true);
  fs.appendFileSync(f.sourceFile.path, '\n'); assert.throws(() => context.assertUnchanged(), /TRUST_FILE_CHANGED/);
  fs.writeFileSync(f.sourceFile.path, f.input.sources['T.sol'].content); const changed = clone(f.plan); changed.operations[0].predictedAddress = governor; write(f.campaign.coordinator.planPath, changed); assert.throws(() => context.assertUnchanged(), /LOCAL_NATIVE_PLAN_CHANGED/);
});
test('native compiler and fixed CAPI compiler produce exactly the same standard JSON output', { skip: !compiler || !nativeCompiler }, t => {
  const f = fixture(t); const output = JSON.parse(execFileSync(nativeCompiler, ['--standard-json'], { input: JSON.stringify(f.input), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })); assert.deepEqual(output, f.output);
});
test('creator replacement is allowed only with untouched local/native campaign state', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-reselection-')); fs.chmodSync(root, 0o700); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const nativeSessionPath = path.join(root, 'native-session.json');
  assert.equal(assertCampaignUnstartedForReplacement({ privateDirectory: root, nativeSessionPath }), true);
  const statePath = path.join(root, 'state-00000001.json'); write(statePath, { state: { steps: [{ index: 0, state: 'awaiting-owner-approval' }] } }); assert.equal(assertCampaignUnstartedForReplacement({ privateDirectory: root, nativeSessionPath }), true);
  for (const marker of [{ prepared: {} }, { signingRequestedAt: '2026-10-16T00:00:00.000Z' }, { transactionHash: '0x' + 'a'.repeat(64) }, { relayAttempted: true }, { capabilityFile: 'private' }, { state: 'recovery-required' }]) { write(statePath, { state: { steps: [{ state: 'awaiting-owner-approval', ...marker }] } }); assert.throws(() => assertCampaignUnstartedForReplacement({ privateDirectory: root, nativeSessionPath }), /REQUIRES_RECONCILIATION/); }
  fs.unlinkSync(statePath); write(nativeSessionPath, {}); assert.throws(() => assertCampaignUnstartedForReplacement({ privateDirectory: root, nativeSessionPath }), /NATIVE_SESSION_REQUIRES_RECONCILIATION/);
});
test('production signing host gate keeps experimental Linux out of device signing', () => { if (process.platform === 'darwin') assert.equal(assertTrustedSigningHost(), true); else assert.throws(() => assertTrustedSigningHost(), /TRUSTED_MAC_SIGNING_HOST_REQUIRED/); });
