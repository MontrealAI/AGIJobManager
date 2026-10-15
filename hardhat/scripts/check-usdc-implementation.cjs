'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { JsonRpcProvider, getAddress, keccak256, ZeroAddress } = require('ethers');
const { createCanonicalReader } = require('./canonical-state.cjs');

// Circle's UpgradeabilityProxy uses this slot, not EIP-1967.
// Source: https://github.com/circlefin/stablecoin-evm/blob/master/contracts/upgradeability/UpgradeabilityProxy.sol
const IMPLEMENTATION_SLOT = '0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3';
const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const PROXY_TYPE = 'circle-fiat-token-zeppelinos-v1';
const KEYS = ['schema', 'chainId', 'token', 'proxyType', 'proxyCodeHash', 'implementation', 'implementationCodeHash'];
function normalizeBinding(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== KEYS.length || KEYS.some(key => !Object.hasOwn(value, key))) {
    throw new Error('Reviewed USDC binding requires exactly the documented schema fields.');
  }
  if (value.schema !== 'reviewed-usdc-implementation-v1' || value.chainId !== 1 || value.proxyType !== PROXY_TYPE) {
    throw new Error('Unsupported USDC binding schema, chain or proxy type; only the reviewed Ethereum Circle proxy route is supported.');
  }
  const token = getAddress(value.token), implementation = getAddress(value.implementation);
  if (token !== TOKEN || implementation === ZeroAddress || implementation === token) throw new Error('Invalid native USDC token or implementation address.');
  for (const key of ['proxyCodeHash', 'implementationCodeHash']) {
    if (typeof value[key] !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value[key]) || /^0x0{64}$/.test(value[key])) {
      throw new Error(`${key} must be a reviewed nonzero bytes32 hash.`);
    }
  }
  return { ...value, token, implementation, proxyCodeHash: value.proxyCodeHash.toLowerCase(), implementationCodeHash: value.implementationCodeHash.toLowerCase() };
}
async function checkUsdcImplementation({ provider, binding, snapshot }) {
  const expected = normalizeBinding(binding);
  // Raw chain/block reads avoid provider network and block caches. Never create a signer.
  const chain = await provider.send('eth_chainId', []);
  if (chain !== '0x1') throw new Error('Provider chain differs from the reviewed Ethereum USDC binding.');
  if (snapshot !== undefined && (!snapshot || !Number.isSafeInteger(snapshot.number) || snapshot.number < 0 ||
      !/^0x[0-9a-fA-F]{64}$/.test(snapshot.hash || ''))) throw new Error('Invalid requested snapshot number/hash.');
  const selectedBlock = snapshot ? `0x${snapshot.number.toString(16)}` : 'latest';
  const raw = await provider.send('eth_getBlockByNumber', [selectedBlock, false]);
  if (!raw || !/^0x[0-9a-fA-F]+$/.test(raw.number || '') || !/^0x[0-9a-fA-F]{64}$/.test(raw.hash || '')) throw new Error('Invalid canonical snapshot block.');
  const number = Number(BigInt(raw.number));
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid canonical snapshot height.');
  if (snapshot && (number !== snapshot.number || raw.hash.toLowerCase() !== snapshot.hash.toLowerCase())) throw new Error('Requested snapshot is not the canonical block returned by the provider.');
  const pinned = createCanonicalReader(provider, { number, hash: raw.hash });
  const proxyCode = await pinned.getCode(TOKEN);
  if (proxyCode === '0x' || keccak256(proxyCode) !== expected.proxyCodeHash) throw new Error('USDC proxy runtime differs from the reviewed supported proxy.');
  const word = await pinned.getStorage(TOKEN, IMPLEMENTATION_SLOT);
  if (!/^0x0{24}[0-9a-fA-F]{40}$/.test(word)) throw new Error('USDC implementation storage word has non-address padding.');
  const implementation = getAddress(`0x${word.slice(-40)}`);
  if (implementation === ZeroAddress || implementation !== expected.implementation) throw new Error('USDC implementation differs from the reviewed binding.');
  const code = await pinned.getCode(implementation);
  if (code === '0x' || keccak256(code) !== expected.implementationCodeHash) throw new Error('USDC implementation code differs from the reviewed binding.');
  const again = await provider.send('eth_getBlockByNumber', [raw.number, false]);
  if (!again || again.number !== raw.number || again.hash?.toLowerCase() !== raw.hash.toLowerCase()) throw new Error('Canonical block changed or disappeared; no USDC implementation report qualifies.');
  if (await provider.send('eth_chainId', []) !== chain) throw new Error('Provider chain changed during USDC review.');
  return {
    checksPassed: true, schema: 'usdc-implementation-review-v1', chainId: 1,
    blockNumber: number, blockHash: raw.hash.toLowerCase(), stateReference: 'EIP-1898 canonical hash; no number fallback',
    expected, observed: { token: TOKEN, proxyType: PROXY_TYPE, proxyCodeHash: keccak256(proxyCode), implementation, implementationCodeHash: keccak256(code), implementationSlot: IMPLEMENTATION_SLOT },
    transactionsBroadcast: 0,
    scope: 'Read-only match to supplied reviewed USDC implementation binding. Does not establish human approval, issuer safety, full A2 financial/policy readiness, or deployment/activation authorization.',
  };
}
async function main() {
  if (!process.env.READINESS_USDC_CONFIG || !process.env.MAINNET_RPC_URL || !process.env.USDC_IMPLEMENTATION_REPORT) {
    throw new Error('Set READINESS_USDC_CONFIG, MAINNET_RPC_URL and a new USDC_IMPLEMENTATION_REPORT path. No signing key is used.');
  }
  const bytes = fs.readFileSync(process.env.READINESS_USDC_CONFIG);
  const binding = normalizeBinding(JSON.parse(bytes));
  let snapshot;
  if (process.env.USDC_SNAPSHOT_BLOCK_NUMBER !== undefined || process.env.USDC_SNAPSHOT_BLOCK_HASH !== undefined) {
    if (!/^(0|[1-9][0-9]*)$/.test(process.env.USDC_SNAPSHOT_BLOCK_NUMBER || '')) throw new Error('Explicit snapshot requires a decimal block number and matching hash.');
    snapshot = { number: Number(process.env.USDC_SNAPSHOT_BLOCK_NUMBER), hash: process.env.USDC_SNAPSHOT_BLOCK_HASH };
  }
  const provider = new JsonRpcProvider(process.env.MAINNET_RPC_URL);
  try {
    const report = await checkUsdcImplementation({ provider, binding, snapshot });
    report.reviewedBindingSha256 = createHash('sha256').update(bytes).digest('hex');
    // Exclusive creation preserves prior evidence. No deployment receipt is edited.
    fs.writeFileSync(process.env.USDC_IMPLEMENTATION_REPORT, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log('USDC implementation matches the supplied binding at the reported canonical block. No transactions were sent. This is one A2 check, not activation approval.');
  } finally { provider.destroy(); }
}
if (require.main === module) main().catch(() => {
  // Do not echo provider error objects or RPC URLs that can contain credentials.
  console.error('USDC implementation check failed; no qualifying new report. Review inputs, canonical RPC support and the supplied binding.');
  process.exitCode = 1;
});
module.exports = { IMPLEMENTATION_SLOT, TOKEN, PROXY_TYPE, normalizeBinding, checkUsdcImplementation };
