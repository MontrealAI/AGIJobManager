'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { keccak256, id } = require('ethers');
const { IMPLEMENTATION_SLOT, TOKEN, PROXY_TYPE, normalizeBinding, checkUsdcImplementation } = require('../scripts/check-usdc-implementation.cjs');
const impl = '0x1111111111111111111111111111111111111111';
const hash = '0x' + 'ab'.repeat(32);
const proxyCode = '0x60016000', implementationCode = '0x60026000';
const binding = () => ({ schema: 'reviewed-usdc-implementation-v1', chainId: 1, token: TOKEN,
  proxyType: PROXY_TYPE, proxyCodeHash: keccak256(proxyCode), implementation: impl, implementationCodeHash: keccak256(implementationCode) });
function fixture(change = {}) {
  const calls = []; let chainReads = 0, blockReads = 0;
  return { calls, async send(method, params) {
    calls.push([method, params]);
    if (method === 'eth_chainId') return ++chainReads === 2 && change.chainChanged ? '0x2' : change.chain || '0x1';
    if (method === 'eth_getBlockByNumber') {
      blockReads++;
      if (blockReads === 2 && change.disappeared) return null;
      return { number: change.blockNumber || '0x123', hash: blockReads === 2 && change.reorg ? '0x'+'cd'.repeat(32) : hash };
    }
    assert.deepEqual(params.at(-1), { blockHash: hash, requireCanonical: true });
    if (change.unsupported) throw new Error('Endpoint secret must never appear in canonical read error');
    if (method === 'eth_getCode') return params[0].toLowerCase() === TOKEN.toLowerCase() ? change.proxyCode ?? proxyCode : change.implementationCode ?? implementationCode;
    if (method === 'eth_getStorageAt') {
      assert.equal(BigInt(params[1]), BigInt(IMPLEMENTATION_SLOT));
      return change.word ?? '0x' + '0'.repeat(24) + impl.slice(2);
    }
    throw new Error('Unexpected RPC method: ' + method);
  } };
}
test('slot matches Circle documented ZeppelinOS constant, not EIP-1967', () => assert.equal(IMPLEMENTATION_SLOT, id('org.zeppelinos.proxy.implementation')));
test('valid reviewed binding passes using only read-only canonical-hash RPC', async () => {
  const provider = fixture(); const result = await checkUsdcImplementation({ provider, binding: binding() });
  assert.equal(result.checksPassed, true); assert.equal(result.transactionsBroadcast, 0); assert.equal(result.observed.implementation, impl);
  assert.equal(result.blockNumber, 291); assert.equal(result.blockHash, hash);
  assert.deepEqual([...new Set(provider.calls.map(([method]) => method))].sort(), ['eth_chainId','eth_getBlockByNumber','eth_getCode','eth_getStorageAt'].sort());
});
for (const [label, update] of [
  ['missing field', b => { delete b.implementationCodeHash; }], ['unknown field', b => { b.approved = true; }],
  ['wrong schema', b => { b.schema = 'observed-candidate'; }], ['unsupported Sepolia', b => { b.chainId = 11155111; }],
  ['unsupported proxy', b => { b.proxyType = 'eip1967'; }], ['wrong token', b => { b.token = impl; }],
  ['zero implementation', b => { b.implementation = '0x'+'00'.repeat(20); }], ['self implementation', b => { b.implementation = TOKEN; }],
  ['bad hash', b => { b.proxyCodeHash = '0x123'; }], ['zero hash', b => { b.implementationCodeHash = '0x'+'00'.repeat(32); }],
]) test('rejects binding: ' + label, () => { const b = binding(); update(b); assert.throws(() => normalizeBinding(b)); });
for (const [label, change] of [
  ['wrong chain', { chain: '0x2' }], ['chain changes', { chainChanged: true }], ['reorg', { reorg: true }], ['block disappears', { disappeared: true }],
  ['invalid height', { blockNumber: '0x20000000000000' }], ['malformed height', { blockNumber: 'oops' }],
  ['empty proxy code', { proxyCode: '0x' }], ['unexpected proxy code', { proxyCode: '0x6003' }],
  ['empty implementation code', { implementationCode: '0x' }], ['unexpected implementation code', { implementationCode: '0x6003' }],
  ['nonzero address padding', { word: '0x'+'1'.repeat(24)+impl.slice(2) }], ['truncated slot', { word: '0x1234' }],
  ['zero implementation slot', { word: '0x'+'00'.repeat(32) }], ['different implementation', { word: '0x'+'0'.repeat(24)+'22'.repeat(20) }],
  ['unsupported canonical reads', { unsupported: true }],
]) test('fails closed: ' + label, async () => assert.rejects(checkUsdcImplementation({ provider: fixture(change), binding: binding() })));
test('unsupported canonical RPC error does not expose provider secrets', async () => {
  await assert.rejects(checkUsdcImplementation({ provider: fixture({ unsupported: true }), binding: binding() }), error => {
    assert.match(error.message, /CANONICAL_STATE_READ_BLOCKED/); assert.doesNotMatch(error.message, /Endpoint secret/); return true;
  });
});

test('supports the same explicit snapshot as a separate financial/readiness report', async () => {
  const provider = fixture(); const result = await checkUsdcImplementation({ provider, binding: binding(), snapshot: { number: 291, hash } });
  assert.equal(result.blockHash, hash); assert.deepEqual(provider.calls[1], ['eth_getBlockByNumber', ['0x123', false]]);
});
for (const snapshot of [{ number: 292, hash }, { number: 291, hash: '0x'+'cd'.repeat(32) }, { number: 291 }, { number: -1, hash }, { number: '291', hash }]) {
  test('rejects inconsistent explicit snapshot ' + JSON.stringify(snapshot), async () => {
    await assert.rejects(checkUsdcImplementation({ provider: fixture(), binding: binding(), snapshot }));
  });
}
