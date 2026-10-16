import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { Transaction, SigningKey, computeAddress, keccak256 } from 'ethers';
import { policyDigest, attachAndValidateSignature } from '../src/envelope.mjs';

const result = await build({ entryPoints: [new URL('../src/app.mjs', import.meta.url).pathname], write: false, bundle: true, platform: 'browser', format: 'iife', plugins: [{ name: 'no-device-fixture', setup(builder) {
  builder.onResolve({ filter: /^\.\/device\.mjs$/ }, () => ({ path: 'device-fixture', namespace: 'bridge-test' }));
  builder.onLoad({ filter: /.*/, namespace: 'bridge-test' }, () => ({ contents: 'export const makeUsbSigner = () => ({ sign: prepared => globalThis.__syntheticResult(prepared), cancel: () => {} });', loader: 'js' }));
} }] });
function harness({ respondAt } = {}) {
  const key = new SigningKey(`0x${'11'.repeat(32)}`), clock = { value: Date.parse('2026-10-16T14:00:00Z') }, expiry = Date.parse('2026-10-16T15:00:00Z');
  const review = { chainId: '1', expectedSender: computeAddress(key.publicKey), expiresAt: new Date(expiry).toISOString(), maxGasLimit: '5000000', maxFeePerGas: '20000000000', maxPriorityFeePerGas: '2000000000', maxTotalFeeWei: '100000000000000000', maxValueWei: '0', operationId: 'synthetic-ui-only', sourceSha256: `0x${'42'.repeat(32)}` };
  const unsigned = Transaction.from({ type: 2, chainId: 1, nonce: 7, to: null, data: '0x60006000f3', value: 0, gasLimit: 500000, maxFeePerGas: 10000000000n, maxPriorityFeePerGas: 1000000000n, accessList: [] }).unsignedSerialized;
  const values = { unsigned, expectedHash: keccak256(unsigned), review: JSON.stringify(review), expectedPolicyHash: policyDigest(review, keccak256(unsigned)), path: "44'/60'/0'/0/0" };
  const buttons = ['sign', 'cancel', 'download', 'downloadImport'];
  const elements = Object.fromEntries([...Object.keys(values), 'ack', 'validate', 'summary', 'status', ...buttons].map(id => [id, { value: values[id] ?? '', checked: id === 'ack', disabled: buttons.includes(id), textContent: '', addEventListener() {} }]));
  const files = [], urls = new Map(); let serial = 0, syntheticCalls = 0, forbiddenCalls = 0;
  const forbidden = () => { forbiddenCalls++; throw new Error('No device/network access allowed in fixture'); };
  const context = { Blob, Date: class extends Date { static now() { return clock.value; } }, document: { getElementById: id => elements[id], createElement: () => ({ click() { files.push({ filename: this.download, blob: urls.get(this.href) }); } }) }, window: { addEventListener() {} }, URL: { createObjectURL(blob) { const id = `fixture:${serial++}`; urls.set(id, blob); return id; }, revokeObjectURL(id) { urls.delete(id); } }, setTimeout(fn) { fn(); }, navigator: { get hid() { return forbidden(); }, get usb() { return forbidden(); } }, fetch: forbidden, __syntheticResult(prepared) { syntheticCalls++; const signature = key.sign(prepared.expectedUnsignedHash); if (respondAt !== undefined) clock.value = respondAt; return Promise.resolve(attachAndValidateSignature(prepared, { r: signature.r, s: signature.s, v: signature.yParity }, clock.value)); } };
  runInNewContext(result.outputFiles[0].text, context);
  return { elements, files, clock, expiry, counts: () => ({ syntheticCalls, forbiddenCalls }) };
}
test('actual UI download callbacks create separate private JSON formats using only a synthetic adapter', async () => {
  const h = harness(); h.elements.validate.onclick(); await h.elements.sign.onclick();
  assert.equal(h.elements.download.disabled, false); assert.equal(h.elements.downloadImport.disabled, false);
  h.elements.downloadImport.onclick(); h.elements.download.onclick();
  assert.equal(h.files.length, 2);
  assert.match(h.files[0].filename, /\.coordinator-import\.private\.json$/);
  const imported = JSON.parse(await h.files[0].blob.text()), recovery = JSON.parse(await h.files[1].blob.text());
  assert.deepEqual(Object.keys(imported), ['raw']); assert.equal(imported.raw, recovery.signedTransaction);
  assert.equal(recovery.format, 'mainnet-ledger-signed-capability-v1'); assert.equal(recovery.status, 'SIGNED_NOT_SUBMITTED');
  assert.deepEqual(h.counts(), { syntheticCalls: 1, forbiddenCalls: 0 });
});
test('UI rechecks expiry on click, creates no import, and retains the full DO_NOT_RELAY recovery download', async () => {
  const h = harness(); h.elements.validate.onclick(); await h.elements.sign.onclick(); h.clock.value = h.expiry;
  h.elements.downloadImport.onclick();
  assert.equal(h.files.length, 0); assert.equal(h.elements.downloadImport.disabled, true); assert.equal(h.elements.download.disabled, false);
  assert.match(h.elements.status.textContent, /COORDINATOR_IMPORT_EXPIRED_DO_NOT_RELAY/);
  h.elements.download.onclick(); const recovery = JSON.parse(await h.files[0].blob.text());
  assert.equal(recovery.status, 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY');
  assert.equal(Transaction.from(recovery.signedTransaction).from, recovery.review.expectedSender);
  assert.ok(recovery.expectedPolicyHash); assert.ok(recovery.unsignedTransaction);
  assert.deepEqual(h.counts(), { syntheticCalls: 1, forbiddenCalls: 0 });
});
test('UI keeps full recovery when a synthetic response arrives only after expiry', async () => {
  const h = harness({ respondAt: Date.parse('2026-10-16T15:00:00Z') });
  h.elements.validate.onclick(); await h.elements.sign.onclick();
  assert.equal(h.elements.download.disabled, false); assert.equal(h.elements.downloadImport.disabled, true);
  assert.match(h.elements.status.textContent, /DO_NOT_RELAY/);
  h.elements.download.onclick(); const recovery = JSON.parse(await h.files[0].blob.text());
  assert.equal(recovery.status, 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY');
  assert.deepEqual(h.counts(), { syntheticCalls: 1, forbiddenCalls: 0 });
});
