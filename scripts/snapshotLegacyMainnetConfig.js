#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const Web3 = require('web3');
const Abi = require('web3-eth-abi');
const { execFileSync } = require('child_process');

const LEGACY_ADDRESS = '0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477';
const SNAPSHOT_PATH = path.join(__dirname, '..', 'migrations', 'snapshots', 'legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json');
const ETHERSCAN_API = 'https://api.etherscan.io/v2/api';
const BLOCKSCOUT_API = 'https://eth.blockscout.com/api';
const EIP1967_IMPL_SLOT = '0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC';
const EIP1967_ADMIN_SLOT = '0xB53127684A568B3173AE13B9F8A6016E243E63B6E8EE1178D6A717850B5D6103';

const EXPECTED_HINTS = {
  agiToken: '0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa', baseIpfsUrl: 'https://ipfs.io/ipfs/', ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', nameWrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
  clubRootNode: '0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16', agentRootNode: '0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d',
  alphaClubRootNode: '0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e', alphaAgentRootNode: '0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e',
  merkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b', aiMythicalNft: '0x130909390AC76c53986957814Bde8786B8605fF3', aiMythicalPct: '80',
};

const args = process.argv.slice(2);
const blockArg = args.includes('--block') ? args[args.indexOf('--block') + 1] : 'latest';

function curlJson(url, method = 'GET', body = null) {
  const args = ['-sS', '--fail'];
  if (method === 'POST') {
    args.push('-X', 'POST', '-H', 'content-type: application/json', '--data', JSON.stringify(body));
  }
  args.push(url);
  const out = execFileSync('curl', args, { encoding: 'utf8' });
  return JSON.parse(out);
}

function rpc(url, method, params = []) {
  const b = curlJson(url, 'POST', { jsonrpc: '2.0', id: 1, method, params });
  if (b.error) throw new Error(`${method} failed: ${b.error.message || JSON.stringify(b.error)}`);
  return b.result;
}

function explorerGet(base, params) {
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const b = curlJson(url.toString());
  if (b.status === '0' && b.message !== 'No transactions found') throw new Error(b.result || b.message);
  return b.result;
}

const checksum = (v) => (!v || v === '0x' ? '0x0000000000000000000000000000000000000000' : Web3.utils.toChecksumAddress(v));
const b32 = (v) => (v || ('0x' + '00'.repeat(32))).toLowerCase();

function decoder(abiItems) {
  const sigs = ['addModerator(address)','removeModerator(address)','addAdditionalAgent(address)','removeAdditionalAgent(address)','addAdditionalValidator(address)','removeAdditionalValidator(address)','blacklistAgent(address,bool)','blacklistValidator(address,bool)','addAGIType(address,uint256)','disableAGIType(address)'];
  const m = Object.fromEntries(sigs.map((s) => [Web3.utils.keccak256(s).slice(0, 10), s]));
  return (input) => {
    if (!input || input.length < 10) return null;
    const s = m[input.slice(0, 10)]; if (!s) return null;
    const abi = abiItems.find((x) => x.type === 'function' && `${x.name}(${(x.inputs || []).map((i) => i.type).join(',')})` === s);
    if (!abi) return null;
    const decoded = Abi.decodeParameters(abi.inputs, '0x' + input.slice(10));
    return { signature: s, args: abi.inputs.map((_, i) => decoded[i]) };
  };
}

async function main() {
  const rpcUrl = (process.env.MAINNET_RPC_URL || '').trim();
  const apiKey = (process.env.ETHERSCAN_API_KEY || '').trim();
  if (!rpcUrl) throw new Error('Missing MAINNET_RPC_URL');

  const chainId = Number(parseInt(rpc(rpcUrl, 'eth_chainId'), 16));
  if (chainId !== 1) throw new Error(`MAINNET_RPC_URL chainId mismatch: ${chainId}`);
  const latest = parseInt(rpc(rpcUrl, 'eth_blockNumber'), 16);
  const blockNumber = blockArg === 'latest' ? latest : Number(blockArg);
  const blockHex = '0x' + blockNumber.toString(16);
  const blockData = rpc(rpcUrl, 'eth_getBlockByNumber', [blockHex, false]);

  let sourceMeta = { Proxy: '0', Implementation: null };
  let abi;
  let explorerUsed = 'etherscan';
  try {
    if (!apiKey) throw new Error('Missing ETHERSCAN_API_KEY');
    const src = explorerGet(ETHERSCAN_API, { chainid: 1, module: 'contract', action: 'getsourcecode', address: LEGACY_ADDRESS, apikey: apiKey });
    sourceMeta = src[0]; abi = JSON.parse(sourceMeta.ABI);
  } catch (e) {
    console.warn(`Etherscan source fetch failed (${e.message}); falling back to Blockscout.`);
    explorerUsed = 'blockscout';
    abi = JSON.parse(explorerGet(BLOCKSCOUT_API, { module: 'contract', action: 'getabi', address: LEGACY_ADDRESS }));
  }

  const code = rpc(rpcUrl, 'eth_getCode', [LEGACY_ADDRESS, blockHex]);
  if (!code || code === '0x') throw new Error('Legacy contract has no code');

  const implSlot = rpc(rpcUrl, 'eth_getStorageAt', [LEGACY_ADDRESS, EIP1967_IMPL_SLOT, blockHex]);
  const adminSlot = rpc(rpcUrl, 'eth_getStorageAt', [LEGACY_ADDRESS, EIP1967_ADMIN_SLOT, blockHex]);
  const impl = checksum('0x' + implSlot.slice(-40));
  const admin = checksum('0x' + adminSlot.slice(-40));

  function call(name) {
    const fn = abi.find((x) => x.type === 'function' && x.name === name && (x.inputs || []).length === 0);
    if (!fn) return { present: false, value: null };
    const data = Abi.encodeFunctionCall(fn, []);
    const out = rpc(rpcUrl, 'eth_call', [{ to: LEGACY_ADDRESS, data }, blockHex]);
    const decoded = Abi.decodeParameters(fn.outputs, out);
    return { present: true, value: decoded[0] };
  }

  const fields = {};
  for (const f of ['owner','agiToken','ens','nameWrapper','ensJobPages','clubRootNode','agentRootNode','alphaClubRootNode','alphaAgentRootNode','validatorMerkleRoot','agentMerkleRoot','requiredValidatorApprovals','requiredValidatorDisapprovals','voteQuorum','premiumReputationThreshold','validationRewardPercentage','maxJobPayout','jobDurationLimit','completionReviewPeriod','disputeReviewPeriod','agentBond','agentBondBps','agentBondMax','validatorBondBps','validatorBondMin','validatorBondMax','validatorSlashBps','challengePeriodAfterApproval','settlementPaused','lockIdentityConfig','paused','useEnsJobTokenURI','baseIpfsUrl']) fields[f]=call(f);

  let txlist;
  try {
    if (!apiKey) throw new Error('Missing ETHERSCAN_API_KEY');
    txlist = explorerGet(ETHERSCAN_API, { chainid: 1, module: 'account', action: 'txlist', address: LEGACY_ADDRESS, startblock: 0, endblock: blockNumber, page: 1, offset: 10000, sort: 'asc', apikey: apiKey });
  } catch (e) {
    console.warn(`Etherscan txlist fetch failed (${e.message}); falling back to Blockscout txlist.`);
    txlist = explorerGet(BLOCKSCOUT_API, { module: 'account', action: 'txlist', address: LEGACY_ADDRESS, startblock: 0, endblock: blockNumber, page: 1, offset: 10000, sort: 'asc' });
  }

  const parseInput = decoder(abi);
  const stateMaps = { moderators:new Map(), additionalAgents:new Map(), additionalValidators:new Map(), blacklistedAgents:new Map(), blacklistedValidators:new Map() };
  for (const tx of txlist) {
    if (!tx.to || tx.to.toLowerCase() !== LEGACY_ADDRESS.toLowerCase()) continue;
    const d = parseInput(tx.input); if (!d) continue;
    const src = { txHash: tx.hash, blockNumber: Number(tx.blockNumber), transactionIndex: Number(tx.transactionIndex) };
    const a = checksum(d.args[0]);
    if (d.signature === 'addModerator(address)') stateMaps.moderators.set(a,{enabled:true,source:src});
    if (d.signature === 'removeModerator(address)') stateMaps.moderators.set(a,{enabled:false,source:src});
    if (d.signature === 'addAdditionalAgent(address)') stateMaps.additionalAgents.set(a,{enabled:true,source:src});
    if (d.signature === 'removeAdditionalAgent(address)') stateMaps.additionalAgents.set(a,{enabled:false,source:src});
    if (d.signature === 'addAdditionalValidator(address)') stateMaps.additionalValidators.set(a,{enabled:true,source:src});
    if (d.signature === 'removeAdditionalValidator(address)') stateMaps.additionalValidators.set(a,{enabled:false,source:src});
    if (d.signature === 'blacklistAgent(address,bool)') stateMaps.blacklistedAgents.set(a,{enabled:Boolean(d.args[1]),source:src});
    if (d.signature === 'blacklistValidator(address,bool)') stateMaps.blacklistedValidators.set(a,{enabled:Boolean(d.args[1]),source:src});
  }

  const topic = Web3.utils.keccak256('AGITypeUpdated(address,uint256)');
  const logs = [];
  const step = 50000;
  for (let from = 0; from <= blockNumber; from += step) {
    const to = Math.min(blockNumber, from + step - 1);
    const chunk = rpc(rpcUrl, 'eth_getLogs', [{ address: LEGACY_ADDRESS, fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16), topics: [topic] }]);
    logs.push(...chunk);
  }
  const agiTypes = new Map();
  logs.sort((a,b)=>parseInt(a.blockNumber,16)-parseInt(b.blockNumber,16)||parseInt(a.transactionIndex,16)-parseInt(b.transactionIndex,16)||parseInt(a.logIndex,16)-parseInt(b.logIndex,16));
  for (const l of logs) {
    const nft = checksum('0x' + l.topics[1].slice(-40));
    const pctHex = l.topics[2] || l.data;
    const pct = BigInt(pctHex).toString();
    const src = { txHash:l.transactionHash, blockNumber:parseInt(l.blockNumber,16), transactionIndex:parseInt(l.transactionIndex,16), logIndex:parseInt(l.logIndex,16) };
    if (!agiTypes.has(nft)) agiTypes.set(nft,{ nftAddress:nft, payoutPercentage:pct, enabled:pct!=='0', source:[src] });
    else { const x=agiTypes.get(nft); x.payoutPercentage=pct; x.enabled=pct!=='0'; x.source.push(src);} 
  }

  const snapshot = {
    schemaVersion:'1.0.0', generatedAt:new Date().toISOString(),
    source:{ chainId:String(chainId), blockNumber:String(blockNumber), blockTimestamp:String(parseInt(blockData.timestamp,16)), explorerUsed, legacyAddress:LEGACY_ADDRESS,
      proxy:{ detected:sourceMeta.Proxy==='1' || impl !== '0x0000000000000000000000000000000000000000', etherscanProxyFlag:sourceMeta.Proxy || '0', etherscanImplementation:sourceMeta.Implementation || null, eip1967Implementation:impl, eip1967Admin:admin } },
    addresses:{ owner:checksum(fields.owner.value), agiToken:checksum(fields.agiToken.value), ensRegistry:checksum(fields.ens.value), nameWrapper:checksum(fields.nameWrapper.value), ensJobPages:checksum(fields.ensJobPages.value) },
    constructor:{ baseIpfsUrl:fields.baseIpfsUrl.value || EXPECTED_HINTS.baseIpfsUrl, ensConfig:[checksum(fields.ens.value),checksum(fields.nameWrapper.value)], rootNodes:[b32(fields.clubRootNode.value),b32(fields.agentRootNode.value),b32(fields.alphaClubRootNode.value),b32(fields.alphaAgentRootNode.value)], merkleRoots:[b32(fields.validatorMerkleRoot.value),b32(fields.agentMerkleRoot.value)], derivedNamehashes:[{name:'alpha.club.agi.eth',value:EXPECTED_HINTS.alphaClubRootNode,derived:fields.alphaClubRootNode.value===EXPECTED_HINTS.alphaClubRootNode},{name:'alpha.agent.agi.eth',value:EXPECTED_HINTS.alphaAgentRootNode,derived:fields.alphaAgentRootNode.value===EXPECTED_HINTS.alphaAgentRootNode}] },
    booleans:{ paused:Boolean(fields.paused.value), settlementPaused:Boolean(fields.settlementPaused.value), lockIdentityConfig:Boolean(fields.lockIdentityConfig.value), useEnsJobTokenURI:fields.useEnsJobTokenURI.present?Boolean(fields.useEnsJobTokenURI.value):null },
    params:Object.fromEntries(['requiredValidatorApprovals','requiredValidatorDisapprovals','voteQuorum','premiumReputationThreshold','validationRewardPercentage','maxJobPayout','jobDurationLimit','completionReviewPeriod','disputeReviewPeriod','validatorBondBps','validatorBondMin','validatorBondMax','agentBond','agentBondBps','agentBondMax','validatorSlashBps','challengePeriodAfterApproval'].map((k)=>[k, fields[k].value == null ? null : String(fields[k].value)])),
    dynamicSets:Object.fromEntries(Object.entries(stateMaps).map(([k,m])=>[k,Array.from(m.entries()).map(([address,state])=>({address,enabled:state.enabled,source:state.source}))])),
    agiTypes:Array.from(agiTypes.values()),
  };

  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n');

  const c=(k,a,e)=>console.log(`- ${k}: ${a} (${String(a).toLowerCase()===String(e).toLowerCase()?'MATCH':`DIFF expected ${e}`})`);
  console.log('Legacy mainnet snapshot summary');
  console.log(`- chainId: ${snapshot.source.chainId}`);
  console.log(`- block: ${snapshot.source.blockNumber} (timestamp ${snapshot.source.blockTimestamp})`);
  console.log(`- proxy detected: ${snapshot.source.proxy.detected}`);
  console.log(`- counts: moderators=${snapshot.dynamicSets.moderators.filter((x)=>x.enabled).length}, additionalAgents=${snapshot.dynamicSets.additionalAgents.filter((x)=>x.enabled).length}, additionalValidators=${snapshot.dynamicSets.additionalValidators.filter((x)=>x.enabled).length}, blacklistedAgents=${snapshot.dynamicSets.blacklistedAgents.filter((x)=>x.enabled).length}, blacklistedValidators=${snapshot.dynamicSets.blacklistedValidators.filter((x)=>x.enabled).length}, agiTypes=${snapshot.agiTypes.length}`);
  console.log('Hint comparisons:');
  c('agiToken', snapshot.addresses.agiToken, EXPECTED_HINTS.agiToken); c('baseIpfsUrl', snapshot.constructor.baseIpfsUrl, EXPECTED_HINTS.baseIpfsUrl); c('ensRegistry', snapshot.addresses.ensRegistry, EXPECTED_HINTS.ensRegistry); c('nameWrapper', snapshot.addresses.nameWrapper, EXPECTED_HINTS.nameWrapper);
  c('clubRootNode', snapshot.constructor.rootNodes[0], EXPECTED_HINTS.clubRootNode); c('agentRootNode', snapshot.constructor.rootNodes[1], EXPECTED_HINTS.agentRootNode); c('alphaClubRootNode', snapshot.constructor.rootNodes[2], EXPECTED_HINTS.alphaClubRootNode); c('alphaAgentRootNode', snapshot.constructor.rootNodes[3], EXPECTED_HINTS.alphaAgentRootNode);
  c('validatorMerkleRoot', snapshot.constructor.merkleRoots[0], EXPECTED_HINTS.merkleRoot); c('agentMerkleRoot', snapshot.constructor.merkleRoots[1], EXPECTED_HINTS.merkleRoot);
  const ai = snapshot.agiTypes.find((x)=>x.nftAddress.toLowerCase()===EXPECTED_HINTS.aiMythicalNft.toLowerCase());
  c('AIMYTHICAL payout', ai ? ai.payoutPercentage : 'NOT_FOUND', EXPECTED_HINTS.aiMythicalPct);
  console.log(`Snapshot written: ${SNAPSHOT_PATH}`);
}

main().catch((e)=>{ console.error(`snapshotLegacyMainnetConfig failed: ${e.message}`); process.exit(1); });
