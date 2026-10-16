import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Wallet, Transaction, keccak256 } from 'ethers';
import manager, { MANAGER_SUPPORTED } from '../coordinators/manager.mjs';
import alpha, { ALPHA_SUPPORTED } from '../coordinators/alpha.mjs';
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
