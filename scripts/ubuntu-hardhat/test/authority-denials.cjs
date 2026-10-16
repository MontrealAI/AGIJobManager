'use strict';
// Disposable eth_call checks only: a positive control proves the operation is
// valid for the expected authority, then the same call must deny the deployer.
const assert = require('node:assert/strict');
async function authorityDenials({ E, rpc, targets, creator }) {
  const iface = new E.Interface(['function owner() view returns(address)', 'function transferOwnership(address)', 'function addModerator(address)']);
  const block = await rpc('eth_getBlockByNumber', ['latest', false]), tag = block.number, result = [];
  for (const [name, address, expectedOwner] of targets) {
    const owner = iface.decodeFunctionResult('owner', await rpc('eth_call', [{ to: address, data: iface.encodeFunctionData('owner') }, tag]))[0];
    assert.equal(owner, expectedOwner); assert.notEqual(owner.toLowerCase(), creator.toLowerCase());
    const methods = [['transferOwnership', ['0x9999999999999999999999999999999999999999']]];
    if (name === 'AGIJobManager') methods.push(['addModerator', [creator]]);
    for (const [method, args] of methods) {
      const call = { to: address, value: '0x0', data: iface.encodeFunctionData(method, args) };
      await rpc('eth_call', [{ ...call, from: owner }, tag]);
      await assert.rejects(rpc('eth_call', [{ ...call, from: creator }, tag]));
      result.push({ contract: name, method, ownerPositiveControl: true, creatorDenied: true, chainMutation: false });
    }
  }
  assert.equal((await rpc('eth_getBlockByNumber', [tag, false])).hash, block.hash);
  return { schema: 'ubuntu-hardhat-disposable-authority-denials-v1', snapshot: { number: Number(BigInt(tag)), hash: block.hash }, checks: result, governorSignatures: 0, chainTransactions: 0, comprehensiveAuthorityComplete: false };
}
module.exports = { authorityDenials };
