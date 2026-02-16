#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Web3 = require('web3');
const web3 = new Web3();

const LEGACY_ADDRESS = '0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477';
const SNAPSHOT_PATH = path.join(__dirname, '..', 'migrations', 'snapshots', 'legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json');
const DEFAULT_RPC = 'https://ethereum-rpc.publicnode.com';
const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';
const ETHERSCAN_TXLIST = 'https://etherscan.io/txs';

const HINTS = { agiToken: '0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa', baseIpfsUrl: 'https://ipfs.io/ipfs/', ens: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', nameWrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401', clubRootNode: '0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16', agentRootNode: '0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d', alphaClubRootNode: '0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e', alphaAgentRootNode: '0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e', merkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b', aimythicalNft: '0x130909390AC76c53986957814Bde8786B8605fF3', aimythicalPayoutPercentage: '80' };

const assert = (c, m) => { if (!c) throw new Error(m); };
const parseArgs = (argv) => { const o = {}; for (let i = 2; i < argv.length; i += 1) { if (!argv[i].startsWith('--')) continue; const k = argv[i].slice(2); const n = argv[i + 1]; if (!n || n.startsWith('--')) o[k] = true; else { o[k] = n; i += 1; } } return o; };
const toHex = (n) => `0x${BigInt(n).toString(16)}`;
const checksum = (a) => web3.utils.toChecksumAddress(a);

function curlJson(url, method = 'GET', data = null) {
  const args = ['-sS', url];
  if (method !== 'GET') args.push('-X', method);
  if (data != null) { args.push('-H', 'content-type: application/json', '--data', JSON.stringify(data)); }
  const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  return JSON.parse(out);
}
function curlText(url) { return execFileSync('curl', ['-sS', url], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }); }
function rpc(url, method, params = []) { const j = curlJson(url, 'POST', { jsonrpc: '2.0', id: 1, method, params }); if (j.error) throw new Error(`${method} failed: ${j.error.message}`); return j.result; }

function encodeCall(sig, args) {
  const types = sig.slice(sig.indexOf('(') + 1, -1).split(',').filter(Boolean);
  return web3.eth.abi.encodeFunctionCall({ name: sig.split('(')[0], type: 'function', inputs: types.map((type, i) => ({ type, name: `arg${i}` })) }, args);
}
async function read(rpcUrl, to, sig, outs, blockTag, args = []) {
  const out = rpc(rpcUrl, 'eth_call', [{ to, data: encodeCall(sig, args) }, blockTag]);
  const dec = web3.eth.abi.decodeParameters(outs, out);
  return outs.length === 1 ? dec[0] : dec;
}
function namehash(name) { let node = `0x${'00'.repeat(32)}`; for (const label of name.split('.').reverse()) { node = web3.utils.keccak256(web3.eth.abi.encodeParameters(['bytes32', 'bytes32'], [node, web3.utils.keccak256(label)])); } return node.toLowerCase(); }
function fetchAbi(address, key) { if (!key) return { abiSource: 'local-fallback', abiMetadata: null }; const j = curlJson(`${ETHERSCAN_BASE}?chainid=1&module=contract&action=getsourcecode&address=${address}&apikey=${key}`); if (j.status !== '1') throw new Error(`Etherscan getsourcecode failed: ${j.result || j.message}`); return { abiSource: 'etherscan-v2', abiMetadata: j.result[0] }; }
function txHashesFromHtml(address) { const hashes = []; const seen = new Set(); let p = 1; let maxP = 1; while (p <= maxP) { const html = curlText(`${ETHERSCAN_TXLIST}?a=${address}&p=${p}`); for (const m of html.matchAll(/href="\/tx\/(0x[a-fA-F0-9]{64})"/g)) if (!seen.has(m[1])) { seen.add(m[1]); hashes.push(m[1]); } const ps = [...html.matchAll(/&p=(\d+)"/g)].map((x) => Number(x[1])).filter(Boolean); if (ps.length) maxP = Math.max(maxP, ...ps); p += 1; } return hashes; }

async function main() {
  const args = parseArgs(process.argv);
  const rpcUrl = args.rpc || process.env.MAINNET_RPC_URL || DEFAULT_RPC;
  const blockLatest = Number(BigInt(rpc(rpcUrl, 'eth_blockNumber')));
  const blockNumber = args.block ? Number(args.block) : blockLatest;
  const blockTag = toHex(blockNumber);
  const chainId = Number(BigInt(rpc(rpcUrl, 'eth_chainId')));
  assert(chainId === 1, `Expected chainId=1 got ${chainId}`);
  const block = rpc(rpcUrl, 'eth_getBlockByNumber', [blockTag, false]);

  const target = checksum(LEGACY_ADDRESS);
  assert(rpc(rpcUrl, 'eth_getCode', [target, blockTag]) !== '0x', 'No contract code at legacy address');

  const { abiSource, abiMetadata } = fetchAbi(target, process.env.ETHERSCAN_API_KEY || '');

  const owner = checksum(await read(rpcUrl, target, 'owner()', ['address'], blockTag));
  const agiToken = checksum(await read(rpcUrl, target, 'agiToken()', ['address'], blockTag));
  const ens = checksum(await read(rpcUrl, target, 'ens()', ['address'], blockTag));
  const nameWrapper = checksum(await read(rpcUrl, target, 'nameWrapper()', ['address'], blockTag));

  const roots = { clubRootNode: String(await read(rpcUrl, target, 'clubRootNode()', ['bytes32'], blockTag)).toLowerCase(), agentRootNode: String(await read(rpcUrl, target, 'agentRootNode()', ['bytes32'], blockTag)).toLowerCase(), alphaClubRootNode: namehash('alpha.club.agi.eth'), alphaAgentRootNode: namehash('alpha.agent.agi.eth') };
  const merkleRoots = { validatorMerkleRoot: String(await read(rpcUrl, target, 'validatorMerkleRoot()', ['bytes32'], blockTag)).toLowerCase(), agentMerkleRoot: String(await read(rpcUrl, target, 'agentMerkleRoot()', ['bytes32'], blockTag)).toLowerCase() };

  const params = { requiredValidatorApprovals: String(await read(rpcUrl, target, 'requiredValidatorApprovals()', ['uint256'], blockTag)), requiredValidatorDisapprovals: String(await read(rpcUrl, target, 'requiredValidatorDisapprovals()', ['uint256'], blockTag)), premiumReputationThreshold: String(await read(rpcUrl, target, 'premiumReputationThreshold()', ['uint256'], blockTag)), validationRewardPercentage: String(await read(rpcUrl, target, 'validationRewardPercentage()', ['uint256'], blockTag)), maxJobPayout: String(await read(rpcUrl, target, 'maxJobPayout()', ['uint256'], blockTag)), jobDurationLimit: String(await read(rpcUrl, target, 'jobDurationLimit()', ['uint256'], blockTag)), voteQuorum: '3', completionReviewPeriod: '604800', disputeReviewPeriod: '1209600', validatorBondBps: '1500', validatorBondMin: '10000000000000000000', validatorBondMax: '88888888000000000000000000', validatorSlashBps: '8000', challengePeriodAfterApproval: '86400', agentBond: '1000000000000000000', agentBondBps: '500', agentBondMin: '1000000000000000000', agentBondMax: '88888888000000000000000000' };

  const sigs = { addModerator: web3.eth.abi.encodeFunctionSignature('addModerator(address)'), removeModerator: web3.eth.abi.encodeFunctionSignature('removeModerator(address)'), addAdditionalAgent: web3.eth.abi.encodeFunctionSignature('addAdditionalAgent(address)'), removeAdditionalAgent: web3.eth.abi.encodeFunctionSignature('removeAdditionalAgent(address)'), addAdditionalValidator: web3.eth.abi.encodeFunctionSignature('addAdditionalValidator(address)'), removeAdditionalValidator: web3.eth.abi.encodeFunctionSignature('removeAdditionalValidator(address)'), blacklistAgent: web3.eth.abi.encodeFunctionSignature('blacklistAgent(address,bool)'), blacklistValidator: web3.eth.abi.encodeFunctionSignature('blacklistValidator(address,bool)'), addAGIType: web3.eth.abi.encodeFunctionSignature('addAGIType(address,uint256)'), disableAGIType: web3.eth.abi.encodeFunctionSignature('disableAGIType(address)') };

  const sets = { moderators: new Map(), additionalAgents: new Map(), additionalValidators: new Map(), blacklistedAgents: new Map(), blacklistedValidators: new Map(), agiTypes: new Map(), agiTypeOrder: [] };
  const hashes = txHashesFromHtml(target);
  const decodeAddrOnly = (input) => checksum(web3.eth.abi.decodeParameter('address', `0x${input.slice(10).slice(24, 64)}`));
  for (const hash of hashes) {
    const tx = rpc(rpcUrl, 'eth_getTransactionByHash', [hash]); if (!tx || !tx.to || checksum(tx.to) !== target || Number(BigInt(tx.blockNumber)) > blockNumber) continue;
    const rc = rpc(rpcUrl, 'eth_getTransactionReceipt', [hash]); if (!rc || rc.status !== '0x1') continue;
    const input = tx.input; const sel = input.slice(0, 10); const src = { txHash: hash, blockNumber: Number(BigInt(tx.blockNumber)), transactionIndex: Number(BigInt(tx.transactionIndex)) };
    if (sel === sigs.addModerator) sets.moderators.set(decodeAddrOnly(input), { enabled: true, source: { ...src, method: 'addModerator' } });
    else if (sel === sigs.removeModerator) sets.moderators.set(decodeAddrOnly(input), { enabled: false, source: { ...src, method: 'removeModerator' } });
    else if (sel === sigs.addAdditionalAgent) sets.additionalAgents.set(decodeAddrOnly(input), { enabled: true, source: { ...src, method: 'addAdditionalAgent' } });
    else if (sel === sigs.removeAdditionalAgent) sets.additionalAgents.set(decodeAddrOnly(input), { enabled: false, source: { ...src, method: 'removeAdditionalAgent' } });
    else if (sel === sigs.addAdditionalValidator) sets.additionalValidators.set(decodeAddrOnly(input), { enabled: true, source: { ...src, method: 'addAdditionalValidator' } });
    else if (sel === sigs.removeAdditionalValidator) sets.additionalValidators.set(decodeAddrOnly(input), { enabled: false, source: { ...src, method: 'removeAdditionalValidator' } });
    else if (sel === sigs.blacklistAgent) { const d = web3.eth.abi.decodeParameters(['address', 'bool'], `0x${input.slice(10)}`); sets.blacklistedAgents.set(checksum(d[0]), { enabled: Boolean(d[1]), source: { ...src, method: 'blacklistAgent' } }); }
    else if (sel === sigs.blacklistValidator) { const d = web3.eth.abi.decodeParameters(['address', 'bool'], `0x${input.slice(10)}`); sets.blacklistedValidators.set(checksum(d[0]), { enabled: Boolean(d[1]), source: { ...src, method: 'blacklistValidator' } }); }
    else if (sel === sigs.addAGIType) { const d = web3.eth.abi.decodeParameters(['address', 'uint256'], `0x${input.slice(10)}`); const nft = checksum(d[0]); if (!sets.agiTypes.has(nft)) sets.agiTypeOrder.push(nft); sets.agiTypes.set(nft, { nftAddress: nft, payoutPercentage: String(d[1]), enabled: String(d[1]) !== '0', source: { ...src, method: 'addAGIType' } }); }
    else if (sel === sigs.disableAGIType) { const d = web3.eth.abi.decodeParameters(['address'], `0x${input.slice(10)}`); const nft = checksum(d[0]); if (!sets.agiTypes.has(nft)) sets.agiTypeOrder.push(nft); sets.agiTypes.set(nft, { nftAddress: nft, payoutPercentage: '0', enabled: false, source: { ...src, method: 'disableAGIType' } }); }
  }

  const materialize = async (map, getterSig) => {
    const out = [];
    for (const [a, v] of map.entries()) {
      const onchain = Boolean(await read(rpcUrl, target, `${getterSig}(address)`, ['bool'], blockTag, [a]));
      if (onchain !== v.enabled) throw new Error(`Could not derive ${getterSig}[${a}] deterministically.`);
      if (v.enabled) out.push({ address: a, source: v.source });
    }
    return out;
  };

  const agiTypes = [];
  for (let i = 0; i < sets.agiTypeOrder.length; i += 1) {
    const nft = sets.agiTypeOrder[i];
    const e = sets.agiTypes.get(nft);
    const row = await read(rpcUrl, target, 'agiTypes(uint256)', ['address', 'uint256'], blockTag, [String(i)]);
    if (checksum(row[0]) !== nft || String(row[1]) !== e.payoutPercentage) throw new Error(`AGI type order mismatch at ${i}.`);
    agiTypes.push(e);
  }

  const snapshot = {
    schemaVersion: '1.0.0', generatedAt: new Date().toISOString(), chainId, blockNumber, blockTimestamp: Number(BigInt(block.timestamp)), legacyAddress: target, abiSource, abiMetadata,
    proxy: { eip1967Slots: { implementation: rpc(rpcUrl, 'eth_getStorageAt', [target, '0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC', blockTag]), admin: rpc(rpcUrl, 'eth_getStorageAt', [target, '0xb53127684a568b3173ae13b9f8a6016e019bbf6f6b1be5a6b7e2f7f7f7f7f7f7', blockTag]), beacon: rpc(rpcUrl, 'eth_getStorageAt', [target, '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50', blockTag]) }, detected: false },
    addressConfig: { owner, agiTokenAddress: agiToken, baseIpfsUrl: HINTS.baseIpfsUrl, ensRegistry: ens, nameWrapper, ensJobPages: '0x0000000000000000000000000000000000000000' },
    rootNodes: { ...roots, derived: { alphaClubRootNode: { name: 'alpha.club.agi.eth', value: roots.alphaClubRootNode, derived: true }, alphaAgentRootNode: { name: 'alpha.agent.agi.eth', value: roots.alphaAgentRootNode, derived: true } } },
    merkleRoots,
    booleans: { paused: Boolean(await read(rpcUrl, target, 'paused()', ['bool'], blockTag)), settlementPaused: false, lockIdentityConfig: false, useEnsJobTokenURI: false },
    params,
    dynamicSets: { moderators: await materialize(sets.moderators, 'moderators'), additionalAgents: await materialize(sets.additionalAgents, 'additionalAgents'), additionalValidators: await materialize(sets.additionalValidators, 'additionalValidators'), blacklistedAgents: await materialize(sets.blacklistedAgents, 'blacklistedAgents'), blacklistedValidators: await materialize(sets.blacklistedValidators, 'blacklistedValidators'), provenanceMode: 'etherscan-html-tx-replay', txReplayCount: hashes.length },
    agiTypes,
    extractionNotes: ['Legacy baseIpfsUrl private/no getter: pinned to expected production value.', 'Legacy has no settlementPaused/lockIdentityConfig/useEnsJobTokenURI; pinned false.', 'Legacy has no voteQuorum/review/bond getters; pinned to new-contract defaults.'],
  };

  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);

  const cmp = (k, a, e) => console.log(`- ${k}: ${a} ${String(a).toLowerCase() === String(e).toLowerCase() ? '✓' : `✗ (hint ${e})`}`);
  console.log('Legacy mainnet snapshot summary');
  console.log(`- chainId=${chainId} block=${blockNumber} ts=${Number(BigInt(block.timestamp))}`);
  cmp('agiToken', agiToken, HINTS.agiToken); cmp('ensRegistry', ens, HINTS.ens); cmp('nameWrapper', nameWrapper, HINTS.nameWrapper);
  cmp('clubRootNode', roots.clubRootNode, HINTS.clubRootNode); cmp('agentRootNode', roots.agentRootNode, HINTS.agentRootNode); cmp('alphaClubRootNode', roots.alphaClubRootNode, HINTS.alphaClubRootNode); cmp('alphaAgentRootNode', roots.alphaAgentRootNode, HINTS.alphaAgentRootNode); cmp('validatorMerkleRoot', merkleRoots.validatorMerkleRoot, HINTS.merkleRoot); cmp('agentMerkleRoot', merkleRoots.agentMerkleRoot, HINTS.merkleRoot);
  console.log(`- counts: moderators=${snapshot.dynamicSets.moderators.length} additionalAgents=${snapshot.dynamicSets.additionalAgents.length} additionalValidators=${snapshot.dynamicSets.additionalValidators.length} blacklistedAgents=${snapshot.dynamicSets.blacklistedAgents.length} blacklistedValidators=${snapshot.dynamicSets.blacklistedValidators.length} agiTypes=${agiTypes.length}`);
  const aim = agiTypes.find((x) => x.nftAddress.toLowerCase() === HINTS.aimythicalNft.toLowerCase());
  console.log(`- AIMYTHICAL: ${aim ? `${aim.payoutPercentage} ${aim.payoutPercentage === HINTS.aimythicalPayoutPercentage ? '✓' : `✗ (hint ${HINTS.aimythicalPayoutPercentage})`}` : 'not found'}`);
  console.log(`Snapshot written to ${SNAPSHOT_PATH}`);
}

main().catch((err) => { console.error(`ERROR: ${err.message}`); process.exit(1); });
