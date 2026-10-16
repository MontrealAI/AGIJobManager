import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Wallet, Transaction, keccak256 } from 'ethers';
import manager, { MANAGER_SUPPORTED, MANAGER_CURRENT, MANAGER_CORRECTED, MANAGER_COMPATIBILITY } from '../coordinators/manager.mjs';
import alpha, { ALPHA_SUPPORTED, ALPHA_CURRENT, ALPHA_COMPATIBILITY } from '../coordinators/alpha.mjs';
import { comparePacket, validateSignedRaw, reviewedOperation, runtime, sha256, cleanEnvironment } from '../coordinators/common.mjs';
import { policyDigest, validateIntent } from '../src/envelope.mjs';

const wallet = Wallet.createRandom(), envelope = { type: 2, chainId: 1, from: wallet.address, nonce: 7, to: null, data: '0x60006000f3', value: '0', gasLimit: '8000000', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000', accessList: [] };
const { from, ...unsigned } = envelope, unsignedHex = Transaction.from(unsigned).unsignedSerialized;
const review = { chainId: '1', expectedSender: wallet.address, expiresAt: '2099-01-01T00:00:00.000Z', maxGasLimit: '8000000', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000', maxTotalFeeWei: '80000000000000000', maxValueWei: '0', operationId: 'manager-0', sourceSha256: '0x' + '34'.repeat(32) };
const expectedUnsignedHash = keccak256(unsignedHex), prepared = validateIntent(unsignedHex, expectedUnsignedHash, review, policyDigest(review, expectedUnsignedHash));
const operation = { operationId: review.operationId, unsignedHex, expectedUnsignedHash, expectedPolicyHash: policyDigest(review, expectedUnsignedHash), review };
const checked = { manifest: { planSha256: 'ab'.repeat(32) }, operation, prepared };
const packet = { schema: MANAGER_SUPPORTED.packetSchema, index: 0, planSha256: checked.manifest.planSha256, envelope, unsignedSerialized: unsignedHex };

test('Current Manager allowlist excludes the known defective #1586 source', () => {
  assert.equal(MANAGER_SUPPORTED.commit, 'eb6f725e0b40ac81e50a374304e54a5ff6859fcf');
  const campaign = { coordinator: {}, reviewedManifest: { source: { repository: MANAGER_SUPPORTED.repository, commit: '3c974ad3cb1d828e5c89464fd8424d8ae853d9dd', tree: 'a45070671985671c169c6bfa35c5089b1e9674b4' } } };
  assert.throws(() => manager.inspectCampaign(campaign), /UNREVIEWED_COORDINATOR_SOURCE/);
});
test('Alpha allowlist binds actual published d69 head rather than stale PR prose or R4', () => {
  assert.equal(ALPHA_SUPPORTED.commit, 'd69cdd3ddc0f36933d07f0f64abfe15e742bf68c');
  for (const commit of ['70a7a3699755b9e612a97f3d946e3569bc3ae67f', '495fa5f8eb7f653372c58518514d1e2a4238cbb9']) {
    assert.throws(() => alpha.inspectCampaign({ coordinator: {}, reviewedManifest: { source: { repository: ALPHA_SUPPORTED.repository, commit, tree: ALPHA_SUPPORTED.tree } } }), /UNREVIEWED_COORDINATOR_SOURCE/);
  }
});
test('Only numeric in-range step indexes are accepted before filesystem or subprocess work', () => {
  for (const step of [-1, 9, 1.5, '0', null]) assert.throws(() => reviewedOperation({}, MANAGER_SUPPORTED, 9, step), /UNSUPPORTED_OPERATION_INDEX/);
});
test('Child runtime requires an explicit supported version and exact independently selected executable hash', () => {
  const nodePath = fs.realpathSync(process.execPath), nodeVersion = MANAGER_SUPPORTED.nodeVersions[0];
  assert.throws(() => runtime({ nodePath }, MANAGER_SUPPORTED), /REVIEWED_NODE_RUNTIME_PIN_REQUIRED/);
  assert.throws(() => runtime({ nodePath, nodeVersion: '0.0.0', nodeSha256: 'a'.repeat(64) }, MANAGER_SUPPORTED), /REVIEWED_NODE_RUNTIME_PIN_REQUIRED/);
  assert.throws(() => runtime({ nodePath, nodeVersion, nodeSha256: 'a'.repeat(64) }, MANAGER_SUPPORTED), /NODE_EXECUTABLE_HASH_MISMATCH/);
  if (process.versions.node === nodeVersion) runtime({ nodePath, nodeVersion, nodeSha256: sha256(fs.readFileSync(nodePath)) }, MANAGER_SUPPORTED);
});
test('Explorer API credential is not inherited by coordinator subprocess environments', () => {
  const previous = process.env.ETHERSCAN_API_KEY; process.env.ETHERSCAN_API_KEY = 'SYNTHETIC-REDACTION-TEST';
  try { assert.equal(Object.hasOwn(cleanEnvironment(), 'ETHERSCAN_API_KEY'), false); }
  finally { if (previous === undefined) delete process.env.ETHERSCAN_API_KEY; else process.env.ETHERSCAN_API_KEY = previous; }
});
test('Genuine packet identity and exact independently reviewed unsigned envelope are all required', () => {
  comparePacket(packet, checked, MANAGER_SUPPORTED, 0);
  for (const mutation of [{ schema: 'manager-external-signing-handoff-v2' }, { index: 1 }, { planSha256: 'ef'.repeat(32) }, { unsignedSerialized: '0x02' }, { envelope: { ...envelope, from: Wallet.createRandom().address } }, { envelope: { ...envelope, data: '0x00' } }, { envelope: { ...envelope, nonce: 8 } }]) {
    assert.throws(() => comparePacket({ ...packet, ...mutation }, checked, MANAGER_SUPPORTED, 0));
  }
});
test('Exact signature is accepted and every material signed field/account mutation is refused', async () => {
  const raw = await wallet.signTransaction(unsigned); assert.equal(validateSignedRaw(raw, prepared), keccak256(raw));
  assert.throws(() => validateSignedRaw('0x02', prepared), /SIGNED_CAPABILITY_INVALID/);
  for (const mutation of [{ nonce: 8 }, { value: 1 }, { chainId: 2 }, { gasLimit: 7000000 }, { maxFeePerGas: '11000000000' }, { maxPriorityFeePerGas: '2' }, { to: Wallet.createRandom().address }, { data: '0x00' }, { accessList: [{ address: wallet.address, storageKeys: [] }] }]) {
    const changed = await wallet.signTransaction({ ...unsigned, ...mutation }); assert.throws(() => validateSignedRaw(changed, prepared), /SIGNED_CAPABILITY_MISMATCH/);
  }
  const wrong = await Wallet.createRandom().signTransaction(unsigned); assert.throws(() => validateSignedRaw(wrong, prepared), /SIGNED_CAPABILITY_MISMATCH/);
});

// Execute the actual pinned companion adapters with synthetic native command
// responses. No coordinator checkout, provider, hardware or process is invoked.
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import * as realCommon from '../coordinators/common.mjs';
async function observationAdapter(id, changes = {}) {
  const cap = await wallet.signTransaction(unsigned), hash = keccak256(cap), planSha256 = checked.manifest.planSha256;
  let output, statusCalls = 0; const calls = [];
  const config = { checkout: '/synthetic/source', nodePath: '/synthetic/node', sessionPath: '/synthetic/session', lockDirectory: '/synthetic/locks', catalogSha256: 'ab'.repeat(32), catalogPath: '/synthetic/catalog', buildId: 'synthetic', mode: 'raw-relay' };
  const current = { status: changes.status ?? 'signed', txHash: changes.noHash ? undefined : hash };
  const fixture = { common: { ...realCommon,
    reviewed() { return { config }; },
    reviewedOperation() { return { config, manifest: { planSha256 }, operation, prepared: { ...prepared, expired: changes.expired === true } }; },
    directory() {}, privateWrite() { return '/synthetic/input'; },
    ordinary() { return Buffer.from(changes.raw ?? cap); }, readJson() { return output; },
    async execute(_config, supported, script, args) {
      assert.equal(supported.commit, id === 'manager' ? 'eb6f725e0b40ac81e50a374304e54a5ff6859fcf' : 'd69cdd3ddc0f36933d07f0f64abfe15e742bf68c');
      const action = script === '-e' ? 'status' : args[0]; calls.push(action);
      if (action === 'status') {
        statusCalls++;
        if (id === 'manager') return JSON.stringify({ planSha256, states: [{ status: current.status, transactionHash: current.txHash }, ...Array.from({length:8},()=>({status:'planned'}))] });
        output = { state: { schema: 'agialpha.new-graph-session.v1', planSha256, operations: [{ ...current, ...(changes.attemptDuringRecovery && statusCalls > 1 ? { status: 'submission-attempted' } : {}) }] }, commandBlocked: changes.commandBlocked === true, relayAcknowledgement: changes.missingAck ? null : 'NATIVE_EXACT_ACK' };
      } else if (action === 'recover') {
        if (id === 'manager') throw new Error('synthetic receipt unavailable');
        output = { resolved: false };
      } else if (action === 'retrieve-handoff') {
        output = { schema: 'manager-retrieved-handoff-v1', planSha256, unsignedSerialized: prepared.unsignedHex, index: 0, transactionHash: hash, status: 'signed', relayAlreadyAttempted: false, relayAcknowledgement: 'NATIVE_EXACT_ACK', ...changes.packet };
      } else throw new Error('Unexpected native action: ' + action);
      return '';
    }
  } };
  const names = Object.keys(realCommon);
  const bundled = await build({ entryPoints: [new URL(`../coordinators/${id}.mjs`, import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['ethers'], plugins: [{ name: 'synthetic-native-responses', setup(b) {
    b.onResolve({filter:/^\.\/common\.mjs$/},()=>({path:'common',namespace:'synthetic'}));
    b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:names.map(name=>`export const ${name}=(...args)=>globalThis.fixture.common.${name}(...args);`).join('\n'),loader:'js'}));
  }}] });
  const module = { exports: {} };runInNewContext(bundled.outputFiles[0].text,{module,exports:module.exports,require:createRequire(import.meta.url),fixture,Buffer,process});
  const adapter = module.exports.default;
  const supported = id === 'manager' ? MANAGER_SUPPORTED : ALPHA_SUPPORTED;
  const campaign = { reviewedManifest: { source: { repository: supported.repository, commit: supported.commit, tree: supported.tree }, planSha256, operations: [operation] } };
  return { run: () => adapter.observe({ campaign, step: 0, operationId: operation.operationId, privateDir: '/synthetic/private' }), calls, hash };
}
for (const id of ['manager', 'alpha']) test(`${id} exact supported native status restores only existing signed acknowledgement`,async()=>{
  const f=await observationAdapter(id);const result=await f.run();assert.equal(result.state,'signed');assert.equal(result.transactionHash,f.hash);assert.equal(result.acknowledgement,'NATIVE_EXACT_ACK');assert.equal(result.relayAlreadyAttempted,false);assert.equal(f.calls.includes('relay'),false);assert.equal(f.calls.includes('import'),false);
});
test('Alpha d69 unsigned unresolved observation omits absent hash',async()=>{
 const f=await observationAdapter('alpha',{status:'handed-off',noHash:true});const result=await f.run();assert.equal(result.state,'pending');assert.equal(Object.hasOwn(result,'transactionHash'),false);assert.equal(result.acknowledgement,undefined);
});
for(const changes of [{expired:true},{attemptDuringRecovery:true},{missingAck:true}]) test(`Alpha d69 acknowledgement suppressed ${JSON.stringify(changes)}`,async()=>{
 const f=await observationAdapter('alpha',changes);const result=await f.run();assert.equal(result.acknowledgement,undefined);
});
for(const changes of [{commandBlocked:true},{raw:'0x02'}]) test(`Alpha d69 observation rejects unavailable native gate/capability ${JSON.stringify(changes)}`,async()=>{
 const f=await observationAdapter('alpha',changes);await assert.rejects(f.run());
});
for(const packet of [{relayAlreadyAttempted:true},{status:'submission-attempted'},{planSha256:'ff'.repeat(32)},{unsignedSerialized:'0x02'},{index:1},{transactionHash:'0x'+'12'.repeat(32)},{relayAcknowledgement:null},{schema:'unknown'}]) test(`Manager eb6 retrieval refuses changed identity/attempt/ack ${JSON.stringify(packet)}`,async()=>{
 const f=await observationAdapter('manager',{packet});const result=await f.run();assert.equal(result.state,'recovery-required');assert.equal(result.acknowledgement,undefined);
});

for (const [id, adapter, legacy, current, entries] of [['manager', manager, MANAGER_SUPPORTED, MANAGER_CURRENT, MANAGER_COMPATIBILITY], ['alpha', alpha, ALPHA_SUPPORTED, ALPHA_CURRENT, ALPHA_COMPATIBILITY]]) test(`${id} exact source dispatch preserves legacy and isolates current compatibility identity`, () => {
  assert.equal(entries.length, id === 'manager' ? 3 : 2); assert.equal(entries[0], legacy);
  for (const supported of entries) {
    const source = { repository: supported.repository, commit: supported.commit, tree: supported.tree };
    const concrete = adapter.forCampaign({ reviewedManifest: { source } });
    assert.equal(concrete.supported, supported); assert.equal(Object.isFrozen(concrete), true);
    assert.throws(() => adapter.forCampaign({ reviewedManifest: { source: { ...source, tree: '0'.repeat(40) } } }), /UNREVIEWED_COORDINATOR_SOURCE/);
  }
  assert.equal(current.runtimeEvidenceRequired, true); assert.equal(legacy.runtimeEvidenceRequired, undefined);
});
test('Manager unsigned unresolved observation omits absent transaction hash', async () => {
  const fixture = await observationAdapter('manager', { status: 'handed-off', noHash: true });
  const result = await fixture.run(); assert.equal(result.state, 'recovery-required');
  assert.equal(Object.hasOwn(result, 'transactionHash'), false); assert.equal(result.acknowledgement, undefined);
});

test('Corrected Manager exact source is additive and cannot inherit the c2 tree', () => {
  assert.equal(MANAGER_COMPATIBILITY.includes(MANAGER_CURRENT), true); assert.equal(MANAGER_COMPATIBILITY.includes(MANAGER_CORRECTED), true);
  assert.equal(MANAGER_CORRECTED.commit, 'd371d95cfcc44b9133cda4bba55304f727917f18');
  assert.throws(() => manager.forCampaign({ reviewedManifest: { source: { repository: MANAGER_CORRECTED.repository, commit: MANAGER_CORRECTED.commit, tree: MANAGER_CURRENT.tree } } }), /UNREVIEWED_COORDINATOR_SOURCE/);
});
