'use strict';
// Shared local lock protocol across reviewed deployers. Operators must also prevent
// signing elsewhere with this creator: a filesystem lock cannot coordinate machines.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const E = require('ethers');
function syncDirectory(directory) { const fd = fs.openSync(directory, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function durableWrite(file, data, { exclusive = false } = {}) {
  const target = exclusive ? file : `${file}.${crypto.randomUUID()}.tmp`;
  const fd = fs.openSync(target, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (!exclusive) fs.renameSync(target, file);
  syncDirectory(path.dirname(path.resolve(file)));
}
function identity(chainId, creator) {
  if (!Number.isSafeInteger(chainId) || chainId <= 0 || !E.isAddress(creator) || E.getAddress(creator) === E.ZeroAddress) throw Error('Invalid creator/chain identity.');
  return { chainId, creator: E.getAddress(creator) };
}
async function requireCreatorProfile({ provider, chainId, creator, transactionMode, blockTag }) {
  identity(chainId, creator);
  if (transactionMode !== 'eoa-create') throw Error('Unsupported creator transaction mode. Only reviewed eoa-create with empty account code is qualified; delegated EOA, factory and smart-account paths require separate qualification.');
  const code = await provider.getCode(creator, blockTag);
  if (code !== '0x') throw Error('eoa-create requires empty creator code; delegated EOA and contract accounts are not qualified.');
  return { transactionMode, creator: E.getAddress(creator), codeHash: E.keccak256('0x') };
}
function reserveCreator({ directory, chainId, creator, journalPath }) {
  const id = identity(chainId, creator);
  if (!directory || !journalPath) throw Error('DEPLOYMENT_LOCK_DIRECTORY and an explicit deployment journal are required before signing.');
  // Use an existing operator-selected shared directory; never silently substitute /tmp.
  const parent = fs.realpathSync(directory);
  const lockPath = path.join(parent, `${chainId}-${id.creator.toLowerCase()}`);
  try { fs.mkdirSync(lockPath, { mode: 0o700 }); } catch (error) {
    if (error.code === 'EEXIST') throw Error('Creator nonce lock already exists. Reconcile its journal; never break a stale lock or redeploy automatically.');
    throw error;
  }
  const lock = { schema: 'creator-nonce-lock-v1', ...id, journalPath: path.resolve(journalPath), token: crypto.randomUUID(), path: lockPath };
  durableWrite(path.join(lockPath, 'owner.json'), lock, { exclusive: true }); syncDirectory(parent);
  return lock;
}
function releaseCreator(lock) {
  if (!lock?.path || !lock.token) throw Error('Missing creator lock identity.');
  const stored = JSON.parse(fs.readFileSync(path.join(lock.path, 'owner.json'), 'utf8'));
  if (stored.token !== lock.token || stored.creator !== lock.creator || stored.journalPath !== lock.journalPath) throw Error('Creator lock ownership differs; no release performed.');
  fs.unlinkSync(path.join(lock.path, 'owner.json')); fs.rmdirSync(lock.path); syncDirectory(path.dirname(lock.path));
}
async function planCreation({ provider, chainId, creator, transactionMode, creationData, gasLimit, startBlock }) {
  const id = identity(chainId, creator);
  await requireCreatorProfile({ provider, ...id, transactionMode });
  if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(creationData || '') || !Number.isSafeInteger(startBlock) || startBlock < 0 || BigInt(gasLimit) <= 0n || BigInt(gasLimit) > 16777216n) throw Error('Invalid creation intent.');
  const [latest, pending] = await Promise.all([provider.getTransactionCount(id.creator, 'latest'), provider.getTransactionCount(id.creator, 'pending')]);
  if (!Number.isSafeInteger(pending) || pending < 0 || latest !== pending) throw Error('Creator has pending or inconsistent nonces. Reconcile outstanding transactions before reserving creation.');
  return { schema: 'creation-intent-v1', ...id, transactionMode, nonce: pending, to: null, value: '0',
    dataHash: E.keccak256(creationData), startBlock, address: E.getCreateAddress({ from: id.creator, nonce: pending }), gasLimit: String(gasLimit) };
}
function validateCreationIntent(intent) {
  identity(intent?.chainId, intent?.creator);
  if (!/^[1-9][0-9]*$/.test(intent.gasLimit || '') || BigInt(intent.gasLimit) > 16777216n || intent.schema !== 'creation-intent-v1' || intent.transactionMode !== 'eoa-create' || !Number.isSafeInteger(intent.nonce) || intent.nonce < 0 || !Number.isSafeInteger(intent.startBlock) || intent.startBlock < 0 || intent.to !== null || intent.value !== '0' || !/^0x[0-9a-fA-F]{64}$/.test(intent.dataHash || '') || E.getCreateAddress({ from: intent.creator, nonce: intent.nonce }) !== intent.address) throw Error('Malformed saved creation intent.');
  return intent;
}
function requireCreationTransaction(tx, intent) {
  validateCreationIntent(intent);
  if (!tx || tx.to !== null || E.getAddress(tx.from) !== intent.creator || Number(tx.chainId) !== intent.chainId ||
      Number(tx.nonce) !== intent.nonce || tx.gasLimit === undefined || BigInt(tx.gasLimit) !== BigInt(intent.gasLimit) || BigInt(tx.value) !== 0n || E.keccak256(tx.data) !== intent.dataHash ||
      E.getCreateAddress({ from: tx.from, nonce: tx.nonce }) !== intent.address) throw Error('Creation transaction differs from the durable creator/nonce/chain/calldata intent.');
  return tx;
}
async function recoverCreation({ provider, intent, maxBlocks = 2048 }) {
  validateCreationIntent(intent);
  if (!Number.isSafeInteger(maxBlocks) || maxBlocks < 1 || maxBlocks > 2048) throw Error('Canonical recovery scan limit must be 1..2048.');
  if (Number(BigInt(await provider.send('eth_chainId', []))) !== intent.chainId) throw Error('Recovery chain differs from creation intent.');
  const head = await provider.send('eth_getBlockByNumber', ['latest', false]);
  const end = Number(BigInt(head.number));
  if (end < intent.startBlock || end - intent.startBlock + 1 > maxBlocks) throw Error('Hashless recovery exceeds the bounded canonical scan. Supply separately reconciled transaction evidence; never redeploy.');
  let found;
  for (let number = intent.startBlock; number <= end; number++) {
    const block = await provider.send('eth_getBlockByNumber', [E.toQuantity(number), true]);
    if (!block?.hash || Number(BigInt(block.number)) !== number || !Array.isArray(block.transactions)) throw Error('Incomplete canonical block during recovery.');
    for (const entry of block.transactions) {
      const tx = typeof entry === 'string' ? await provider.getTransaction(entry) : entry;
      if (tx?.from?.toLowerCase() !== intent.creator.toLowerCase() || Number(BigInt(tx.nonce)) !== intent.nonce) continue;
      const normalized = { ...tx, data: tx.data || tx.input, gasLimit: tx.gasLimit ?? tx.gas };
      requireCreationTransaction(normalized, intent);
      if (found && found !== tx.hash) throw Error('Ambiguous creator nonce history.');
      found = tx.hash;
    }
    const check = await provider.send('eth_getBlockByNumber', [E.toQuantity(number), false]);
    if (check?.hash !== block.hash) throw Error('Canonical block changed during nonce recovery.');
  }
  const canonicalHead = await provider.send('eth_getBlockByNumber', [E.toQuantity(end), false]);
  if (canonicalHead?.hash !== head.hash) throw Error('Canonical scan head changed.');
  if (!found) throw Error('No canonical creation found for the saved nonce. Submission may still be pending; do not retry or redeploy.');
  return found;
}
module.exports = { durableWrite, requireCreatorProfile, reserveCreator, releaseCreator, planCreation, requireCreationTransaction, recoverCreation, validateCreationIntent };
