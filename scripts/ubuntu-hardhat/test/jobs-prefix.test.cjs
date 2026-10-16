'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createJobsPrefixVerifier } = require('../native.cjs');
function fixture() {
  let head = '0x' + 'aa'.repeat(32), bad = false, drift = false;
  const operations = [0, 1, 2].map(i => ({ key: `synthetic:${i}`, state: 'accepted', transactionHash: '0x' + String(i + 1).repeat(64) })), calls = [];
  const profile = { revalidateSource() { if (drift) throw Error('SOURCE_DRIFT'); }, session: { inspect: async () => ({ head, operations }), requireObserved: async key => { calls.push(key); if (bad) throw Error('NONCANONICAL_NATIVE_RECEIPT'); } } };
  const provider = { getTransaction: async hash => ({ hash }) };
  return { calls, profile, provider, run: createJobsPrefixVerifier(profile, provider), changeHead() { head = '0x' + 'bb'.repeat(32); }, bad(value) { bad = value; }, drift(value) { drift = value; }, operations };
}
test('all receipts are verified before an in-memory proof can be reused, and restart verifies all again', async () => {
  const f = fixture(); await f.run(); assert.equal(f.calls.length, 3); await f.run(); assert.equal(f.calls.length, 4); assert.equal(f.calls.at(-1), 'synthetic:2');
  await createJobsPrefixVerifier(f.profile, f.provider)(); assert.equal(f.calls.length, 7);
});
test('journal changes invalidate reuse; a fixed head with changed operation bytes is rejected', async () => {
  const f = fixture(); await f.run(); f.changeHead(); await f.run(); assert.equal(f.calls.length, 6);
  f.operations[0].transactionHash = 'tampered'; await assert.rejects(f.run(), /JOURNAL_VIEW_CHANGED/);
});
test('a missing/reorged last canonical receipt fails after key-entry proof reuse and invalidates the cache', async () => {
  const f = fixture(); await f.run(); f.bad(true); await assert.rejects(f.run(), /NONCANONICAL/); f.bad(false); const before = f.calls.length; await f.run(); assert.equal(f.calls.length - before, 3);
});
test('source drift and failures during an initial receipt scan can never create a reusable proof', async () => {
  const f = fixture(); f.bad(true); await assert.rejects(f.run()); f.bad(false); await f.run(); f.drift(true); await assert.rejects(f.run(), /SOURCE_DRIFT/); f.drift(false); const before = f.calls.length; await f.run(); assert.equal(f.calls.length - before, 3);
});
