#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Web3 = require('web3');

const LEGACY_ADDRESS = '0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477';
const SNAPSHOT_PATH = path.join(__dirname, '..', 'migrations', 'snapshots', 'legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json');
const IMPLEMENTATION_SLOT = '0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC';

const HINTS = {
  agiToken: '0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa', baseIpfsUrl: 'https://ipfs.io/ipfs/', ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', nameWrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
  clubRootNode: '0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16', agentRootNode: '0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d', alphaClubRootNode: '0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e', alphaAgentRootNode: '0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e',
  validatorMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b', agentMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
  aimythicalNft: '0x130909390AC76c53986957814Bde8786B8605fF3', aimythicalPct: '80',
};

function parseArgs(argv) { const out = {}; for (let i = 2; i < argv.length; i += 1) if (argv[i] === '--block') out.block = argv[++i]; return out; }
function curlJson(url) { return JSON.parse(execFileSync('curl', ['-sS', '--fail', url], { encoding: 'utf8', maxBuffer: 25 * 1024 * 1024 })); }
function curlRpc(url, payload) {
  const body = execFileSync('curl', ['-sS', '--fail', '-H', 'content-type: application/json', '--data', JSON.stringify(payload), url], { encoding: 'utf8', maxBuffer: 15 * 1024 * 1024 });
  const parsed = JSON.parse(body);
  if (parsed.error) throw new Error(`RPC error ${parsed.error.code}: ${parsed.error.message}`);
  return parsed.result;
}
function etherscanV2Url(params) { const u = new URL('https://api.etherscan.io/v2/api'); Object.entries({ chainid: '1', ...params }).forEach(([k, v]) => u.searchParams.set(k, v)); return u.toString(); }
function blockscoutUrl(params) { const u = new URL('https://eth.blockscout.com/api'); Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v)); return u.toString(); }

async function main() {
  const web3 = new Web3();
  const args = parseArgs(process.argv);
  const rpcUrl = (process.env.MAINNET_RPC_URL || '').trim() || 'https://ethereum-rpc.publicnode.com';
  const etherscanKey = (process.env.ETHERSCAN_API_KEY || '').trim();

  const chainId = Number(curlRpc(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }));
  if (chainId !== 1) throw new Error(`Expected mainnet chainId=1 but got ${chainId}`);
  const latestBlock = Number(curlRpc(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }));
  const blockNumber = args.block ? Number(args.block) : latestBlock;
  const blockTag = `0x${blockNumber.toString(16)}`;
  const block = curlRpc(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: [blockTag, false] });

  function getSourceCode(address) {
    if (etherscanKey) {
      const e = curlJson(etherscanV2Url({ module: 'contract', action: 'getsourcecode', address, apikey: etherscanKey }));
      if (String(e.status) === '1' && e.result?.[0]) return { provider: 'etherscan', data: e.result[0] };
    }
    const b = curlJson(blockscoutUrl({ module: 'contract', action: 'getsourcecode', address }));
    if (!b.result?.[0]) throw new Error(`source metadata unavailable for ${address}`);
    return { provider: 'blockscout', data: b.result[0] };
  }
  function getTxList(address) {
    if (etherscanKey) {
      const e = curlJson(etherscanV2Url({ module: 'account', action: 'txlist', address, startblock: '0', endblock: String(blockNumber), sort: 'asc', apikey: etherscanKey }));
      if (String(e.status) === '1' && Array.isArray(e.result)) return { provider: 'etherscan', txs: e.result };
    }
    const b = curlJson(blockscoutUrl({ module: 'account', action: 'txlist', address, startblock: '0', endblock: String(blockNumber), sort: 'asc' }));
    if (!Array.isArray(b.result)) throw new Error(`txlist unavailable for ${address}`);
    return { provider: 'blockscout', txs: b.result };
  }

  const legacyMeta = getSourceCode(LEGACY_ADDRESS);
  const meta = legacyMeta.data;
  const implSlotRaw = curlRpc(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'eth_getStorageAt', params: [LEGACY_ADDRESS, IMPLEMENTATION_SLOT, blockTag] });
  const implFromStorage = implSlotRaw && implSlotRaw.length >= 42 && implSlotRaw !== '0x' && implSlotRaw !== '0x0' ? `0x${implSlotRaw.slice(-40)}` : null;
  const isZero = (addr) => !addr || /^0x0{40}$/i.test(addr);
  const storageImpl = isZero(implFromStorage) ? null : implFromStorage;
  const metadataImpl = isZero(meta.Implementation || meta.implementationAddress) ? null : (meta.Implementation || meta.implementationAddress);
  const isProxy = String(meta.Proxy || meta.IsProxy || '0') === '1' || !!storageImpl || !!metadataImpl;
  const implementationAddress = (isProxy && (metadataImpl || storageImpl)) ? web3.utils.toChecksumAddress(metadataImpl || storageImpl) : null;

  let abiText = meta.ABI;
  let abiProvider = legacyMeta.provider;
  if (isProxy && implementationAddress) {
    const implMeta = getSourceCode(implementationAddress);
    if (implMeta.data.ABI && implMeta.data.ABI !== 'Contract source code not verified') { abiText = implMeta.data.ABI; abiProvider = implMeta.provider; }
  }
  if (!abiText || abiText === 'Contract source code not verified') throw new Error('Missing verified ABI for execution logic');
  const abi = JSON.parse(abiText);
  const fns = new Map(abi.filter((x) => x.type === 'function').map((x) => [x.name, x]));

  function callFn(fn, args = []) {
    const sig = `${fn.name}(${fn.inputs.map((i) => i.type).join(',')})`;
    const data = web3.eth.abi.encodeFunctionCall(fn, args);
    const out = curlRpc(rpcUrl, { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: LEGACY_ADDRESS, data }, blockTag] });
    if (!fn.outputs || fn.outputs.length === 0) return undefined;
    const decoded = web3.eth.abi.decodeParameters(fn.outputs, out);
    return fn.outputs.length === 1 ? decoded[0] : decoded;
  }

  function optionalCall(name) {
    const fn = fns.get(name);
    if (!fn || fn.inputs.length) return undefined;
    try { return callFn(fn); } catch (_) { return undefined; }
  }
  const asChecksum = (v) => (v ? web3.utils.toChecksumAddress(v) : v);
  const asString = (v) => (v === undefined || v === null ? undefined : String(v));

  const constructorAbi = (abi.find((x) => x.type === 'constructor') || { inputs: [] }).inputs;
  let ctorDecoded = null;
  if (meta.ConstructorArguments) { try { const raw=String(meta.ConstructorArguments); const hex=raw.startsWith('0x')?raw:`0x${raw}`; ctorDecoded = web3.eth.abi.decodeParameters(constructorAbi, hex); } catch (_) {} }

  const config = {
    owner: asChecksum(optionalCall('owner')),
    agiToken: asChecksum(optionalCall('agiToken')),
    ensRegistry: asChecksum(optionalCall('ens')),
    nameWrapper: asChecksum(optionalCall('nameWrapper')),
    ensJobPages: asChecksum(optionalCall('ensJobPages') || '0x0000000000000000000000000000000000000000'),
    useEnsJobTokenURI: Boolean(optionalCall('useEnsJobTokenURI')),
    paused: Boolean(optionalCall('paused')),
    settlementPaused: Boolean(optionalCall('settlementPaused')),
    lockIdentityConfig: Boolean(optionalCall('lockIdentityConfig')),
    baseIpfsUrl: optionalCall('baseIpfsUrl') || optionalCall('_baseIpfsUrl') || (ctorDecoded && ctorDecoded[1]) || null,
    clubRootNode: asString(optionalCall('clubRootNode')), agentRootNode: asString(optionalCall('agentRootNode')), alphaClubRootNode: asString(optionalCall('alphaClubRootNode')), alphaAgentRootNode: asString(optionalCall('alphaAgentRootNode')),
    validatorMerkleRoot: asString(optionalCall('validatorMerkleRoot')), agentMerkleRoot: asString(optionalCall('agentMerkleRoot')),
    requiredValidatorApprovals: asString(optionalCall('requiredValidatorApprovals')), requiredValidatorDisapprovals: asString(optionalCall('requiredValidatorDisapprovals')), voteQuorum: asString(optionalCall('voteQuorum')),
    premiumReputationThreshold: asString(optionalCall('premiumReputationThreshold')), validationRewardPercentage: asString(optionalCall('validationRewardPercentage')),
    maxJobPayout: asString(optionalCall('maxJobPayout')), jobDurationLimit: asString(optionalCall('jobDurationLimit')), completionReviewPeriod: asString(optionalCall('completionReviewPeriod')), disputeReviewPeriod: asString(optionalCall('disputeReviewPeriod')),
    validatorBondBps: asString(optionalCall('validatorBondBps')), validatorBondMin: asString(optionalCall('validatorBondMin')), validatorBondMax: asString(optionalCall('validatorBondMax')), validatorSlashBps: asString(optionalCall('validatorSlashBps')), challengePeriodAfterApproval: asString(optionalCall('challengePeriodAfterApproval')),
    agentBond: asString(optionalCall('agentBond')), agentBondBps: asString(optionalCall('agentBondBps')), agentBondMax: asString(optionalCall('agentBondMax')),
  };
  if (!config.baseIpfsUrl) throw new Error('Unable to derive baseIpfsUrl');

  const txFetch = getTxList(LEGACY_ADDRESS);
  const selectorMap = new Map();
  for (const fn of abi.filter((x) => x.type === 'function')) {
    const sig = `${fn.name}(${(fn.inputs || []).map((i) => i.type).join(',')})`;
    selectorMap.set(web3.eth.abi.encodeFunctionSignature(sig).toLowerCase(), fn);
  }
  const txs = txFetch.txs.filter((t) => (t.to || '').toLowerCase() === LEGACY_ADDRESS.toLowerCase() && String(t.isError || '0') === '0' && Number(t.blockNumber) <= blockNumber)
    .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.transactionIndex) - Number(b.transactionIndex));

  const state = { moderators: new Map(), additionalAgents: new Map(), additionalValidators: new Map(), blacklistedAgents: new Map(), blacklistedValidators: new Map(), agiTypes: [], agiTypeIndex: new Map() };
  const updateSet = (map, addr, enabled, txHash, fnName) => {
    const c = asChecksum(addr);
    if (enabled) map.set(c, { address: c, source: { txHash, function: fnName } }); else map.delete(c);
  };

  for (const tx of txs) {
    const input = (tx.input || '').toLowerCase(); if (input.length < 10) continue;
    const fn = selectorMap.get(input.slice(0, 10)); if (!fn) continue;
    let decoded; try { decoded = web3.eth.abi.decodeParameters(fn.inputs, `0x${input.slice(10)}`); } catch (_) { continue; }
    const n = fn.name;
    if (n === 'addModerator') updateSet(state.moderators, decoded[0], true, tx.hash, n);
    if (n === 'removeModerator') updateSet(state.moderators, decoded[0], false, tx.hash, n);
    if (n === 'addAdditionalAgent') updateSet(state.additionalAgents, decoded[0], true, tx.hash, n);
    if (n === 'removeAdditionalAgent') updateSet(state.additionalAgents, decoded[0], false, tx.hash, n);
    if (n === 'addAdditionalValidator') updateSet(state.additionalValidators, decoded[0], true, tx.hash, n);
    if (n === 'removeAdditionalValidator') updateSet(state.additionalValidators, decoded[0], false, tx.hash, n);
    if (n === 'blacklistAgent') updateSet(state.blacklistedAgents, decoded[0], Boolean(decoded[1]), tx.hash, n);
    if (n === 'blacklistValidator') updateSet(state.blacklistedValidators, decoded[0], Boolean(decoded[1]), tx.hash, n);

    if (n === 'addAGIType' || n === 'disableAGIType') {
      const nft = asChecksum(decoded[0]);
      const pct = n === 'addAGIType' ? asString(decoded[1]) : '0';
      const enabled = pct !== '0';
      if (!state.agiTypeIndex.has(nft)) { state.agiTypeIndex.set(nft, state.agiTypes.length); state.agiTypes.push({ nftAddress: nft, payoutPercentage: pct, enabled, source: { txHash: tx.hash, function: n } }); }
      else { const idx = state.agiTypeIndex.get(nft); state.agiTypes[idx] = { ...state.agiTypes[idx], payoutPercentage: pct, enabled, source: { txHash: tx.hash, function: n } }; }
    }
  }

  const namehash = (name) => { let node = '0x' + '00'.repeat(32); for (const label of name.toLowerCase().split('.').reverse()) node = web3.utils.keccak256(node + web3.utils.keccak256(label).slice(2)); return node; };
  const derivedRoots = [{ name: 'alpha.club.agi.eth', node: namehash('alpha.club.agi.eth'), derived: true }, { name: 'alpha.agent.agi.eth', node: namehash('alpha.agent.agi.eth'), derived: true }];

  if (!config.alphaClubRootNode) config.alphaClubRootNode = derivedRoots[0].node;
  if (!config.alphaAgentRootNode) config.alphaAgentRootNode = derivedRoots[1].node;

  const snapshot = {
    schemaVersion: '1.0.0', generatedAt: new Date().toISOString(), legacyContract: asChecksum(LEGACY_ADDRESS),
    metaSource: { metadataProvider: legacyMeta.provider, abiProvider, txProvider: txFetch.provider },
    chainId, blockNumber, blockTimestamp: Number(block.timestamp),
    proxy: { isProxy: Boolean(isProxy), implementationAddress, implementationSlot: IMPLEMENTATION_SLOT, implementationFromStorage: storageImpl ? asChecksum(storageImpl) : null },
    constructorArguments: ctorDecoded ? Object.fromEntries(constructorAbi.map((i, idx) => [i.name || `arg${idx}`, ctorDecoded[idx]])) : null,
    config,
    roleSets: {
      moderators: Array.from(state.moderators.values()), additionalAgents: Array.from(state.additionalAgents.values()), additionalValidators: Array.from(state.additionalValidators.values()), blacklistedAgents: Array.from(state.blacklistedAgents.values()), blacklistedValidators: Array.from(state.blacklistedValidators.values()),
    },
    agiTypes: state.agiTypes,
    derivedRoots,
  };

  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);

  const checks = [['agiToken', config.agiToken, HINTS.agiToken], ['baseIpfsUrl', config.baseIpfsUrl, HINTS.baseIpfsUrl], ['ensRegistry', config.ensRegistry, HINTS.ensRegistry], ['nameWrapper', config.nameWrapper, HINTS.nameWrapper], ['clubRootNode', config.clubRootNode, HINTS.clubRootNode], ['agentRootNode', config.agentRootNode, HINTS.agentRootNode], ['alphaClubRootNode', config.alphaClubRootNode, HINTS.alphaClubRootNode], ['alphaAgentRootNode', config.alphaAgentRootNode, HINTS.alphaAgentRootNode], ['validatorMerkleRoot', config.validatorMerkleRoot, HINTS.validatorMerkleRoot], ['agentMerkleRoot', config.agentMerkleRoot, HINTS.agentMerkleRoot]];
  const aim = state.agiTypes.find((x) => x.nftAddress.toLowerCase() === HINTS.aimythicalNft.toLowerCase());

  console.log('Legacy snapshot generated');
  console.log(`- output: ${SNAPSHOT_PATH}`);
  console.log(`- chainId: ${chainId}`);
  console.log(`- block: ${blockNumber} @ ${new Date(Number(block.timestamp) * 1000).toISOString()}`);
  console.log(`- providers: metadata=${legacyMeta.provider}, abi=${abiProvider}, tx=${txFetch.provider}`);
  console.log(`- owner=${config.owner}`);
  console.log(`- set counts: moderators=${state.moderators.size}, additionalAgents=${state.additionalAgents.size}, additionalValidators=${state.additionalValidators.size}, blacklistedAgents=${state.blacklistedAgents.size}, blacklistedValidators=${state.blacklistedValidators.size}, agiTypes=${state.agiTypes.length}`);
  console.log('- hint checks:');
  checks.forEach(([name, actual, expected]) => console.log(`  ${(String(actual || '').toLowerCase() === expected.toLowerCase()) ? 'MATCH' : 'DIFF '} ${name}: actual=${actual} expected=${expected}`));
  if (aim) console.log(`  ${(aim.payoutPercentage === HINTS.aimythicalPct) ? 'MATCH' : 'DIFF '} AIMYTHICAL: ${aim.nftAddress} payout=${aim.payoutPercentage}`);
  else console.log('  DIFF  AIMYTHICAL: not found');
}

main().catch((err) => { console.error(`Snapshot extraction failed: ${err.message}`); process.exit(1); });
