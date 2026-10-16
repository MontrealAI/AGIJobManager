import test from 'node:test';
import assert from 'node:assert/strict';
import { Transaction, SigningKey, computeAddress, keccak256 } from 'ethers';
import { validateIntent, attachAndValidateSignature, validatePath, policyDigest } from '../src/envelope.mjs';
import { readFile } from 'node:fs/promises';

const key = new SigningKey(`0x${'11'.repeat(32)}`);
const now = Date.parse('2026-10-16T14:00:00Z');
const review = { chainId: '1', expectedSender: computeAddress(key.publicKey), expiresAt: '2026-10-16T15:00:00Z', maxGasLimit: '5000000', maxFeePerGas: '20000000000', maxPriorityFeePerGas: '2000000000', maxTotalFeeWei: '100000000000000000', maxValueWei: '0', operationId: 'new-campaign-create-01', sourceSha256: `0x${'42'.repeat(32)}` };
const fields = { type: 2, chainId: 1, nonce: 7, to: null, data: '0x60006000f3', value: 0, gasLimit: 500000, maxFeePerGas: 10000000000n, maxPriorityFeePerGas: 1000000000n, accessList: [] };
const encode = changes => Transaction.from({ ...fields, ...changes }).unsignedSerialized;
const unsigned = encode({});
const hash = keccak256(unsigned);
const prepare = (bytes = unsigned, r = review, time = now) => validateIntent(bytes, hash, r, policyDigest(r, hash), time);
const gate = (f, code) => assert.throws(f, error => error.code === code);
const sign = p => { const s = key.sign(p.expectedUnsignedHash); return { r: s.r, s: s.s, v: s.yParity }; };

test('exact reviewed CREATE preserves absent recipient and maximum fee calculation', () => {
  const p = prepare();
  assert.equal(Transaction.from(p.unsignedHex).to, null);
  assert.equal(p.summary.maximumGasCostWei, '5000000000000000');
  assert.equal(p.summary.destination, 'CREATE — recipient absent');
});
test('valid synthetic test signature recovers sender and exact signed envelope', () => {
  const p = prepare(), result = attachAndValidateSignature(p, sign(p), now);
  const tx = Transaction.from(result.signedTransaction);
  assert.equal(result.status, 'SIGNED_NOT_SUBMITTED');
  assert.equal(tx.from, review.expectedSender);
  assert.equal(tx.unsignedSerialized, unsigned);
  assert.equal(tx.to, null);
});
for (const v of [0, 1, 27, 28]) test(`valid recovery encoding ${v} is accepted only for its real parity`, () => {
  const p = prepare(), s = sign(p), parity = v % 27;
  if (parity === s.v) assert.equal(attachAndValidateSignature(p, { ...s, v }, now).status, 'SIGNED_NOT_SUBMITTED');
  else gate(() => attachAndValidateSignature(p, { ...s, v }, now), 'SIGNER_MISMATCH');
});
const mutations = {
  chainId: { chainId: 5 }, nonce: { nonce: 8 }, destination: { to: '0x2222222222222222222222222222222222222222' }, zeroDestination: { to: '0x0000000000000000000000000000000000000000' }, value: { value: 1 }, initcode: { data: '0x60016000f3' }, gasLimit: { gasLimit: 500001 }, fee: { maxFeePerGas: 10000000001n }, priority: { maxPriorityFeePerGas: 1000000001n }, accessList: { accessList: [{ address: '0x2222222222222222222222222222222222222222', storageKeys: [`0x${'00'.repeat(32)}`] }] }, type: { type: 1, gasPrice: 10n, maxFeePerGas: null, maxPriorityFeePerGas: null }
};
for (const [name, change] of Object.entries(mutations)) test(`independently pinned hash rejects mutated ${name}`, () => gate(() => prepare(encode(change)), 'UNSIGNED_HASH_MISMATCH'));
for (const [name, change, code] of [
  ['gas', { maxGasLimit: '499999' }, 'GAS_LIMIT_EXCEEDS_REVIEW'],
  ['fee', { maxFeePerGas: '9999999999' }, 'FEE_EXCEEDS_REVIEW'],
  ['priority', { maxPriorityFeePerGas: '999999999' }, 'PRIORITY_EXCEEDS_REVIEW'],
  ['total fee', { maxTotalFeeWei: '4999999999999999' }, 'TOTAL_FEE_EXCEEDS_REVIEW'],
  ['chain policy', { chainId: '2' }, 'CHAIN_MUST_BE_MAINNET'],
  ['expiry', { expiresAt: '2026-10-16T14:00:00Z' }, 'INTENT_EXPIRED'],
  ['expiry time zone', { expiresAt: '2026-10-16T15:00:00' }, 'INVALID_EXPIRY'],
  ['invalid calendar date', { expiresAt: '2026-02-30T15:00:00Z' }, 'INVALID_EXPIRY'],
  ['source syntax', { sourceSha256: 'not-a-hash' }, 'INVALID_SOURCE_HASH'],
  ['operation path', { operationId: '../sensitive' }, 'INVALID_OPERATION_ID'],
  ['unknown policy', { sendNow: true }, 'INVALID_REVIEW_FIELDS'],
  ['floating amount', { maxGasLimit: 500000 }, 'INVALID_GAS_CEILING'],
  ['negative amount', { maxGasLimit: '-1' }, 'INVALID_GAS_CEILING'],
  ['scientific notation', { maxGasLimit: '5e6' }, 'INVALID_GAS_CEILING'],
  ['leading zero', { maxGasLimit: '05000000' }, 'INVALID_GAS_CEILING'],
  ['uint overflow', { maxFeePerGas: (1n << 256n).toString() }, 'INVALID_FEE_CEILING'],
  ['zero sender', { expectedSender: '0x0000000000000000000000000000000000000000' }, 'ZERO_SENDER']
]) test(`independent ${name} gate rejects before signing`, () => gate(() => prepare(unsigned, { ...review, ...change }), code));
test('missing policy field fails', () => { const r = { ...review }; delete r.maxValueWei; gate(() => prepare(unsigned, r), 'INVALID_REVIEW_FIELDS'); });
for (const [name, value] of Object.entries({ chainId: '2', expectedSender: '0x2222222222222222222222222222222222222222', expiresAt: '2026-10-16T16:00:00Z', maxGasLimit: '6000000', maxFeePerGas: '30000000000', maxPriorityFeePerGas: '3000000000', maxTotalFeeWei: '200000000000000000', maxValueWei: '1', operationId: 'relabeled-create', sourceSha256: `0x${'43'.repeat(32)}` })) test(`independent policy digest rejects metadata substitution: ${name}`, () => {
  gate(() => validateIntent(unsigned, hash, { ...review, [name]: value }, policyDigest(review, hash), now), 'POLICY_HASH_MISMATCH');
});
test('canonical policy digest ignores object-key insertion order', () => assert.equal(policyDigest(review, hash), policyDigest(Object.fromEntries(Object.entries(review).reverse()), hash)));
test('independent policy digest binds the exact unsigned hash to its operation metadata', () => {
  const bytes = encode({ nonce: 8 }), changedHash = keccak256(bytes);
  gate(() => validateIntent(bytes, changedHash, review, policyDigest(review, hash), now), 'POLICY_HASH_MISMATCH');
});
test('missing independent policy digest rejects', () => gate(() => validateIntent(unsigned, hash, review, undefined, now), 'INVALID_INDEPENDENT_POLICY_HASH'));
for (const [gasLimit, accepted] of [[16777216n, true], [16777217n, false]]) test(`Mainnet hard transaction gas cap boundary ${gasLimit}`, () => {
  const r = { ...review, maxGasLimit: '20000000', maxTotalFeeWei: '1000000000000000000' }, bytes = encode({ gasLimit });
  const check = () => validateIntent(bytes, keccak256(bytes), r, policyDigest(r, keccak256(bytes)), now);
  if (accepted) assert.equal(check().summary.gasLimit, gasLimit.toString());
  else gate(check, 'MAINNET_TRANSACTION_GAS_CAP_EXCEEDED');
});
test('zero destination remains distinct from CREATE even with a matching independent hash', () => {
  const bytes = encode(mutations.zeroDestination);
  gate(() => validateIntent(bytes, keccak256(bytes), review, policyDigest(review, keccak256(bytes)), now), 'ZERO_DESTINATION_IS_NOT_CREATE');
});
test('oversized CREATE initcode fails normal EIP-3860 limit', () => {
  const bytes = encode({ data: `0x${'60'.repeat(49153)}` });
  gate(() => validateIntent(bytes, keccak256(bytes), review, policyDigest(review, keccak256(bytes)), now), 'INITCODE_TOO_LARGE');
});
test('value ceiling is checked even with a matching transaction hash', () => {
  const bytes = encode({ value: 1 });
  gate(() => validateIntent(bytes, keccak256(bytes), review, policyDigest(review, keccak256(bytes)), now), 'VALUE_EXCEEDS_REVIEW');
});
test('non-mainnet transaction with matching hash fails', () => {
  const bytes = encode({ chainId: 5 });
  gate(() => validateIntent(bytes, keccak256(bytes), review, policyDigest(review, keccak256(bytes)), now), 'TRANSACTION_CHAIN_MISMATCH');
});
test('already signed input with matching hash is rejected', () => {
  const p = prepare(), signed = attachAndValidateSignature(p, sign(p), now).signedTransaction;
  gate(() => validateIntent(signed, keccak256(signed), review, policyDigest(review, keccak256(signed)), now), 'INPUT_ALREADY_SIGNED');
});
test('legacy and type-1 transactions with matching hashes are rejected', () => {
  for (const type of [0, 1]) { const bytes = encode({ type, accessList: type === 0 ? null : [], gasPrice: 10n, maxFeePerGas: null, maxPriorityFeePerGas: null }); gate(() => validateIntent(bytes, keccak256(bytes), review, policyDigest(review, keccak256(bytes)), now), 'TYPE_2_REQUIRED'); }
});
test('type-4 delegated execution is rejected with a matching independent hash', () => {
  const bytes = encode({ type: 4, to: '0x2222222222222222222222222222222222222222', authorizationList: [] });
  gate(() => validateIntent(bytes, keccak256(bytes), review, policyDigest(review, keccak256(bytes)), now), 'TYPE_2_REQUIRED');
});
test('wrong signer rejects a valid signature', () => {
  const p = prepare(unsigned, { ...review, expectedSender: '0x2222222222222222222222222222222222222222' });
  gate(() => attachAndValidateSignature(p, sign(p), now), 'SIGNER_MISMATCH');
});
test('signature from a different intent rejects', () => {
  const p = prepare(), s = key.sign(keccak256(encode({ nonce: 8 })));
  gate(() => attachAndValidateSignature(p, { r: s.r, s: s.s, v: s.yParity }, now), 'SIGNER_MISMATCH');
});
for (const [name, change] of Object.entries({ missing: null, v: { v: 37 }, r: { r: '0x1234' }, s: { s: '0x1234' }, highS: { s: `0x${'ff'.repeat(32)}` }, zeroR: { r: `0x${'00'.repeat(32)}` } })) test(`malformed ${name} signature rejects`, () => {
  const p = prepare(); gate(() => attachAndValidateSignature(p, change === null ? null : { ...sign(p), ...change }, now), 'INVALID_DEVICE_SIGNATURE');
});
test('valid returned signature after expiry remains a private recovery capability marked DO NOT RELAY', () => {
  const p = prepare();
  const result = attachAndValidateSignature(p, sign(p), Date.parse(review.expiresAt));
  assert.equal(result.status, 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY');
  assert.equal(Transaction.from(result.signedTransaction).from, review.expectedSender);
});
test('tampered prepared bytes cannot override independently supplied hash', () => {
  const p = { ...prepare(), unsignedHex: encode({ nonce: 8 }) };
  gate(() => attachAndValidateSignature(p, sign(prepare()), now), 'UNSIGNED_HASH_MISMATCH');
});
for (const path of ["44'/60'/0'/0/0", "44'/60'/9'/0/2"]) test(`valid owner-selected path ${path}`, () => assert.equal(validatePath(path), path));
for (const path of ['', 'm/44/60/0', "44'/60'/2147483648'/0/0", "44'/60'/0'/0/0;send", "44'/60'"]) test(`invalid path ${JSON.stringify(path)}`, () => gate(() => validatePath(path), 'INVALID_DERIVATION_PATH'));
test('own frontend has no RPC, console, browser storage or SDK logger sink', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const device = await readFile(new URL('../src/device.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(app + device, /console\.|localStorage|sessionStorage|indexedDB|sendRawTransaction|broadcastTransaction|JsonRpcProvider|\.addLogger\(/);
  assert.ok(device.indexOf('requireCurrent(prepared)') < device.indexOf('new DeviceManagementKitBuilder'));
});
test('HTML and server enforce no outbound connections and loopback-only serving', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const server = await readFile(new URL('../scripts/serve.mjs', import.meta.url), 'utf8');
  assert.match(html, /connect-src 'none'/);
  assert.match(server, /connect-src 'none'/);
  assert.match(server, /\.listen\(4173, '127\.0\.0\.1'/);
});
