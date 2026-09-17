'use strict';
const assert = require('node:assert/strict');
const BN = require('bn.js');
const { isEvmRevertError } = require('./test-runtime.cjs');

async function expectRevert(promise, reason) {
  let caught;
  try { await promise; } catch (error) { caught = error; }
  assert(caught, 'Expected a transaction revert, but execution succeeded');
  assert(isEvmRevertError(caught), `Expected an EVM revert, received: ${caught.stack || caught}`);
  if (reason) assert(caught.message.includes(reason), `Expected revert reason ${reason}, received: ${caught.message}`);
}
expectRevert.unspecified = promise => expectRevert(promise);

function expectEvent(receipt, event, expected = {}) {
  const events = receipt.logs.filter(log => log.event === event);
  assert(events.length, `Missing event ${event}`);
  const matches = events.some(log => Object.entries(expected).every(([key, value]) => {
    const actual = log.args[key];
    if (BN.isBN(value) || BN.isBN(actual)) return String(actual) === String(value);
    return actual === value;
  }));
  assert(matches, `No ${event} event matched ${JSON.stringify(expected)}`);
  return events.find(log => Object.entries(expected).every(([key, value]) => String(log.args[key]) === String(value)));
}
expectEvent.inTransaction = async (hash, instance, event, expected) => {
  const receipt = await global.__contractTestRuntime.receiptFor(hash, instance.constructor.interface, instance.address);
  return expectEvent(receipt, event, expected);
};
const time = { increase: async seconds => {
  const amount = Number(seconds.toString());
  assert(Number.isSafeInteger(amount) && amount >= 0, 'Time increase must be a nonnegative safe integer');
  await global.__contractTestRuntime.rpc('evm_increaseTime', [amount]);
  await global.__contractTestRuntime.rpc('evm_mine');
} };
module.exports = { BN, expectEvent, expectRevert, time };
