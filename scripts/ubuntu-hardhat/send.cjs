'use strict';
const fs = require('node:fs'), path = require('node:path');
const { GOVERNOR, need, sha, canonical, real, writeNew } = require('./safety.cjs');
const { hiddenKey } = require('./prompt.cjs');
const FIELDS = ['type', 'chainId', 'from', 'nonce', 'to', 'value', 'data', 'gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas', 'accessList'];
function unsigned(E, envelope, creator) {
  need(Object.keys(envelope).sort().join() === [...FIELDS].sort().join(), 'EXACT_ENVELOPE_FIELDS_REQUIRED');
  need(envelope.type === 2 && BigInt(envelope.chainId) === 1n && envelope.from.toLowerCase() === creator.toLowerCase() && creator.toLowerCase() !== GOVERNOR.toLowerCase(), 'DIRECT_CREATOR_TYPE2_REQUIRED');
  need(BigInt(envelope.value) === 0n && Array.isArray(envelope.accessList) && !envelope.accessList.length && /^0x(?:[0-9a-fA-F]{2})+$/.test(envelope.data), 'ZERO_VALUE_EXACT_CALL_REQUIRED');
  need(Number.isSafeInteger(envelope.nonce) && envelope.nonce >= 0 && BigInt(envelope.gasLimit) > 0n && BigInt(envelope.maxFeePerGas) > 0n && BigInt(envelope.maxPriorityFeePerGas) <= BigInt(envelope.maxFeePerGas), 'INVALID_REVIEWED_FEES_OR_NONCE');
  const { from, ...tx } = envelope; return E.Transaction.from(tx).unsignedSerialized;
}
function review(native, operation, E) {
  const serialized = unsigned(E, operation.envelope, native.binding.creator);
  return { schema: 'ubuntu-hardhat-operation-review-v1', ...native.binding, index: operation.index, operation: operation.operation, envelope: operation.envelope, unsignedSerialized: serialized, unsignedHash: E.keccak256(serialized), maximumFeeWei: (BigInt(operation.envelope.gasLimit) * BigInt(operation.envelope.maxFeePerGas)).toString(), activationAuthorized: false, productionApproved: false };
}
async function fresh(runtime, native, op) {
  await native.fresh(op); const { rpc, E } = runtime, e = op.envelope;
  need(BigInt(await rpc('eth_chainId', [])) === 1n, 'CHAIN_MISMATCH');
  const block = await rpc('eth_getBlockByNumber', ['latest', false]);
  need(block?.hash && BigInt(e.gasLimit) <= BigInt(block.gasLimit) && BigInt(e.maxFeePerGas) >= BigInt(block.baseFeePerGas || 0), 'STALE_GAS_OR_FEE_PLAN');
  const tag = { blockHash: block.hash, requireCanonical: true };
  const code = await rpc('eth_getCode', [e.from, tag]);
  // Marker accounts need a separately qualified transport. Never remove/change delegation.
  need(code === '0x', 'TERMINAL_ROUTE_REQUIRES_EMPTY_CODE_DEPLOYER');
  need(BigInt(await rpc('eth_getTransactionCount', [e.from, tag])) === BigInt(e.nonce) && BigInt(await rpc('eth_getTransactionCount', [e.from, 'pending'])) === BigInt(e.nonce), 'NONCE_OR_PENDING_TRANSACTION_CHANGED');
  need(BigInt(await rpc('eth_getBalance', [e.from, tag])) >= BigInt(e.gasLimit) * BigInt(e.maxFeePerGas), 'DEPLOYER_FEE_BALANCE_INSUFFICIENT');
  if (native.plan.expiresAt) need(Date.now() < Date.parse(native.plan.expiresAt), 'NATIVE_PLAN_EXPIRED');
  if (native.plan.initialBlock) need((await rpc('eth_getBlockByNumber', [E.toQuantity(native.plan.initialBlock.number), false]))?.hash === native.plan.initialBlock.hash, 'NATIVE_PLAN_ANCHOR_CHANGED');
  if (native.plan.config?.expiresAfterBlock !== undefined) need(Number(BigInt(block.number)) <= native.plan.config.expiresAfterBlock, 'NATIVE_PLAN_EXPIRED');
  need((await rpc('eth_getBlockByNumber', [block.number, false]))?.hash === block.hash, 'PREFLIGHT_REORG');
  native.assert(); runtime.assert(); unsigned(E, e, native.binding.creator);
}
async function sendOne({ runtime, native, expectedReview, assertInputs, prompt = hiddenKey }) {
  const stateDir = native.binding.session + '.ubuntu-hardhat';
  if (!fs.existsSync(stateDir)) { fs.mkdirSync(stateDir, { mode: 0o700 }); const fd = fs.openSync(path.dirname(stateDir), 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
  const dir = real(stateDir, true); need(dir.uid === process.getuid() && !(dir.mode & 0o077), 'PRIVATE_ATTEMPT_DIRECTORY_REQUIRED');
  // One global terminal command per original native session, regardless of config/output name.
  const lock = path.join(stateDir, 'active-send'); fs.mkdirSync(lock, { mode: 0o700 });
  let key, wallet, raw;
  try {
    const op = await native.current(), actual = review(native, op, runtime.E);
    need(canonical(actual) === canonical(expectedReview), 'REVIEW_CHANGED');
    const attempt = path.join(stateDir, `${actual.index}-${actual.unsignedHash.slice(2)}.json`);
    need(!fs.existsSync(attempt), 'SUBMISSION_ALREADY_ATTEMPTED_RECONCILE_ONLY');
    assertInputs(); await fresh(runtime, native, op);
    key = await prompt();
    try {
      need(Buffer.isBuffer(key) && key.length === 32, 'LOCAL_KEY_BYTES_REQUIRED');
      wallet = new runtime.E.Wallet(new runtime.E.SigningKey(key));
      need(wallet.address.toLowerCase() === native.binding.creator.toLowerCase(), 'CHOSEN_DEPLOYER_KEY_MISMATCH');
      // Recheck public inputs and full native state after the user finishes typing.
      assertInputs(); await fresh(runtime, native, op);
      need(canonical(review(native, await native.current(), runtime.E)) === canonical(actual), 'NATIVE_HANDOFF_CHANGED');
      const { from, ...transaction } = op.envelope;
      raw = await wallet.signTransaction(transaction);
    } finally { if (key) key.fill(0); key = undefined; wallet = undefined; }
    const parsed = runtime.E.Transaction.from(raw), checked = native.checkSigned(raw, op);
    need(parsed.from?.toLowerCase() === native.binding.creator.toLowerCase() && parsed.unsignedSerialized === actual.unsignedSerialized && checked.hash === parsed.hash, 'SIGNED_TRANSACTION_MISMATCH');
    assertInputs(); native.assert(); runtime.assert();
    // Only public identity is durable. Signed bytes and key never enter a file.
    writeNew(attempt, { schema: 'ubuntu-hardhat-attempt-v1', ...native.binding, index: actual.index, unsignedHash: actual.unsignedHash, transactionHash: parsed.hash, status: 'SUBMISSION_MAY_HAVE_OCCURRED', resendAllowed: false, activationAuthorized: false });
    // Exactly one send call. No sendTransaction population, fee bump, fallback,
    // second endpoint, unlocked account, automatic retry or raw-capability export.
    const returned = await runtime.transmit(raw);
    need(returned === parsed.hash, 'SUBMISSION_RESULT_UNCERTAIN_RECONCILE_ONLY');
    return { transactionHash: parsed.hash, nativeReconciliationRequired: true, resendAllowed: false };
  } finally {
    if (key) key.fill(0); key = undefined; wallet = undefined; raw = undefined;
    fs.rmdirSync(lock);
  }
}
module.exports = { unsigned, review, fresh, sendOne };
