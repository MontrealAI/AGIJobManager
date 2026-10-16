import test from 'node:test';
import assert from 'node:assert/strict';
import { Transaction, SigningKey, computeAddress, keccak256, decodeRlp, encodeRlp, toBeHex } from 'ethers';
import { validateIntent, attachAndValidateSignature, policyDigest } from '../src/envelope.mjs';
import { coordinatorImport } from '../src/coordinator-import.mjs';

const key = new SigningKey(`0x${'11'.repeat(32)}`), otherKey = new SigningKey(`0x${'22'.repeat(32)}`);
const now = Date.parse('2026-10-16T14:00:00Z'), expiry = Date.parse('2026-10-16T15:00:00Z');
const review = { chainId: '1', expectedSender: computeAddress(key.publicKey), expiresAt: new Date(expiry).toISOString(), maxGasLimit: '5000000', maxFeePerGas: '20000000000', maxPriorityFeePerGas: '2000000000', maxTotalFeeWei: '100000000000000000', maxValueWei: '0', operationId: 'synthetic-bridge-01', sourceSha256: `0x${'42'.repeat(32)}` };
const fields = { type: 2, chainId: 1, nonce: 7, to: null, data: '0x60006000f3', value: 0, gasLimit: 500000, maxFeePerGas: 10000000000n, maxPriorityFeePerGas: 1000000000n, accessList: [] };
const unsigned = Transaction.from(fields).unsignedSerialized, hash = keccak256(unsigned);
const prepared = validateIntent(unsigned, hash, review, policyDigest(review, hash), now);
const signature = key.sign(hash), capability = attachAndValidateSignature(prepared, { r: signature.r, s: signature.s, v: signature.yParity }, now);
const clone = value => JSON.parse(JSON.stringify(value));
const gate = (fn, code) => assert.throws(fn, error => error.code === code);
const signedBytes = (change, signingKey = key) => { const tx = Transaction.from({ ...fields, ...change }); tx.signature = signingKey.sign(tx.unsignedHash); return tx.serialized; };

test('coordinator format contains only the exact canonical raw transaction', () => {
  const exported = coordinatorImport(prepared, capability, now + 1);
  assert.deepEqual(Object.keys(exported), ['raw']);
  assert.equal(exported.raw, capability.signedTransaction);
  assert.equal(Transaction.from(exported.raw).from, review.expectedSender);
  assert.equal(Transaction.from(exported.raw).to, null);
  assert.deepEqual(JSON.parse(JSON.stringify(exported)), { raw: capability.signedTransaction });
  assert.ok(Object.isFrozen(exported));
});
test('exact expiry and a later download both refuse import while preserving full recovery capability', () => {
  const original = JSON.stringify(capability);
  coordinatorImport(prepared, capability, expiry - 1);
  for (const time of [expiry, expiry + 1]) gate(() => coordinatorImport(prepared, capability, time), 'COORDINATOR_IMPORT_EXPIRED_DO_NOT_RELAY');
  assert.equal(JSON.stringify(capability), original);
  assert.equal(capability.signedTransaction, Transaction.from(capability.signedTransaction).serialized);
});
test('an expired recovery marker stays blocked despite a clock before expiry', () => gate(() => coordinatorImport(prepared, { ...capability, status: 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY' }, now), 'COORDINATOR_IMPORT_EXPIRED_DO_NOT_RELAY'));
test('a signature returned after expiry cannot be relabeled fresh for import', () => {
  const late = attachAndValidateSignature(prepared, { r: signature.r, s: signature.s, v: signature.yParity }, expiry);
  gate(() => coordinatorImport(prepared, { ...late, status: 'SIGNED_NOT_SUBMITTED' }, expiry + 1), 'COORDINATOR_IMPORT_EXPIRED_DO_NOT_RELAY');
});
for (const [name, change] of Object.entries({ format: { format: 'other' }, unknown: { raw: capability.signedTransaction }, missing: { signedAt: undefined } })) test(`invalid capability schema rejects ${name}`, () => gate(() => coordinatorImport(prepared, clone({ ...capability, ...change }), now), 'INVALID_SIGNED_CAPABILITY'));
test('unknown status rejects', () => gate(() => coordinatorImport(prepared, { ...capability, status: 'RELAY_ALLOWED' }, now), 'INVALID_CAPABILITY_STATUS'));
test('independent review is required', () => gate(() => coordinatorImport(undefined, capability, now), 'INDEPENDENT_REVIEW_REQUIRED'));
for (const [name, value] of Object.entries({ expectedUnsignedHash: `0x${'00'.repeat(32)}`, expectedPolicyHash: `0x${'00'.repeat(32)}`, unsignedTransaction: Transaction.from({ ...fields, nonce: 8 }).unsignedSerialized })) test(`capability rejects changed embedded ${name}`, () => assert.throws(() => coordinatorImport(prepared, { ...capability, [name]: value }, now)));
for (const [name, value] of Object.entries({ operationId: 'different-campaign', sourceSha256: `0x${'43'.repeat(32)}`, expiresAt: new Date(expiry + 3600000).toISOString(), expectedSender: computeAddress(otherKey.publicKey) })) test(`recomputed embedded policy cannot override independent ${name}`, () => {
  const changedReview = { ...review, [name]: value }, changed = { ...capability, review: changedReview, expectedPolicyHash: policyDigest(changedReview, hash) };
  gate(() => coordinatorImport(prepared, changed, now), 'CAPABILITY_REVIEW_MISMATCH');
});
test('changing envelope and both embedded hashes together cannot override original pins', () => {
  const raw = signedBytes({ nonce: 8 }), tx = Transaction.from(raw);
  const changed = { ...capability, unsignedTransaction: tx.unsignedSerialized, expectedUnsignedHash: tx.unsignedHash, expectedPolicyHash: policyDigest(review, tx.unsignedHash), signedTransaction: raw, transactionHash: tx.hash };
  gate(() => coordinatorImport(prepared, changed, now), 'CAPABILITY_REVIEW_MISMATCH');
});
for (const [name, change] of Object.entries({ nonce: { nonce: 8 }, recipient: { to: '0x2222222222222222222222222222222222222222' }, data: { data: '0x60016000f3' }, value: { value: 1 }, gas: { gasLimit: 500001 }, fee: { maxFeePerGas: 10000000001n }, priority: { maxPriorityFeePerGas: 1000000001n }, accessList: { accessList: [{ address: '0x2222222222222222222222222222222222222222', storageKeys: [`0x${'00'.repeat(32)}`] }] }, chain: { chainId: 5 } })) test(`signed bytes reject changed ${name}`, () => {
  const raw = signedBytes(change);
  gate(() => coordinatorImport(prepared, { ...capability, signedTransaction: raw, transactionHash: keccak256(raw) }, now), 'SIGNED_ENVELOPE_MISMATCH');
});
test('valid signature from another synthetic sender rejects', () => {
  const raw = signedBytes({}, otherKey);
  gate(() => coordinatorImport(prepared, { ...capability, signedTransaction: raw, transactionHash: keccak256(raw) }, now), 'SIGNER_MISMATCH');
});
test('claimed signed hash must match actual signed bytes', () => gate(() => coordinatorImport(prepared, { ...capability, transactionHash: `0x${'00'.repeat(32)}` }, now), 'SIGNED_HASH_MISMATCH'));
for (const raw of [unsigned, '0x1234', capability.signedTransaction.toUpperCase(), `${capability.signedTransaction}00`]) test(`malformed or noncanonical signed encoding rejects ${raw.slice(0, 18)}`, () => gate(() => coordinatorImport(prepared, { ...capability, signedTransaction: raw }, now), 'INVALID_SIGNED_BYTES'));
for (const signedAt of ['invalid', '2026-10-16T14:00:00', '2026-10-16T14:00:00.001Z', null]) test(`invalid or future signing timestamp rejects ${signedAt}`, () => gate(() => coordinatorImport(prepared, { ...capability, signedAt }, now), 'INVALID_CAPABILITY_TIME'));
test('nonfinite clock fails closed', () => gate(() => coordinatorImport(prepared, capability, NaN), 'INVALID_REVIEW'));
for (const mode of ['high-S', 'zero-R']) test(`direct import rejects ${mode} signature bytes`, () => {
  const body = decodeRlp(`0x${capability.signedTransaction.slice(4)}`);
  if (mode === 'high-S') body[11] = toBeHex(0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n - BigInt(body[11]));
  else body[10] = '0x';
  const raw = `0x02${encodeRlp(body).slice(2)}`;
  gate(() => coordinatorImport(prepared, { ...capability, signedTransaction: raw, transactionHash: keccak256(raw) }, now), 'INVALID_SIGNED_BYTES');
});
for (const type of [0, 1]) test(`direct import rejects signed transaction type ${type}`, () => {
  const raw = signedBytes({ type, gasPrice: 10n, maxFeePerGas: null, maxPriorityFeePerGas: null, accessList: type === 0 ? null : [] });
  gate(() => coordinatorImport(prepared, { ...capability, signedTransaction: raw, transactionHash: keccak256(raw) }, now), 'SIGNED_ENVELOPE_MISMATCH');
});
