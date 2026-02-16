#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const Abi = require('web3-eth-abi');
const Web3Utils = require('web3-utils');

const LEGACY = '0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477';
const DEFAULT_RPC = 'https://ethereum-rpc.publicnode.com';
const OUT = path.join(__dirname, '..', 'migrations', 'snapshots', `legacy.mainnet.${LEGACY}.json`);

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function shCurl(url, method = 'GET', body) {
  const args = ['-4', '-sS', '--max-time', '60'];
  if (method !== 'GET') args.push('-H', 'content-type: application/json', '--data', JSON.stringify(body));
  args.push(url);
  const out = execFileSync('curl', args, { encoding: 'utf8' });
  return JSON.parse(out);
}

function rpc(method, params, rpcUrl) {
  const res = shCurl(rpcUrl, 'POST', { jsonrpc: '2.0', id: 1, method, params });
  if (res.error) throw new Error(`RPC ${method} failed: ${JSON.stringify(res.error)}`);
  return res.result;
}

function toChecksum(a) { return Web3Utils.toChecksumAddress(a); }
function hexToBnStr(v) { return BigInt(v).toString(); }
function namehash(name) {
  let node = Buffer.alloc(32, 0);
  if (!name) return '0x' + node.toString('hex');
  const labels = name.split('.').filter(Boolean).reverse();
  for (const l of labels) {
    const labelHash = Buffer.from(Web3Utils.keccak256(l).slice(2), 'hex');
    node = Buffer.from(Web3Utils.keccak256(Buffer.concat([node, labelHash])).slice(2), 'hex');
  }
  return '0x' + node.toString('hex');
}

async function main() {
  const blockArg = arg('--block', 'latest');
  const rpcUrl = process.env.MAINNET_RPC_URL || DEFAULT_RPC;
  const etherscanKey = (process.env.ETHERSCAN_API_KEY || '').trim();

  const chainId = Number(hexToBnStr(rpc('eth_chainId', [], rpcUrl)));
  if (chainId !== 1) throw new Error(`Expected chainId=1, got ${chainId}`);
  const latest = Number(hexToBnStr(rpc('eth_blockNumber', [], rpcUrl)));
  const blockNumber = blockArg === 'latest' ? latest : Number(blockArg);
  const blockTag = '0x' + blockNumber.toString(16);
  const block = rpc('eth_getBlockByNumber', [blockTag, false], rpcUrl);
  const blockTimestamp = Number(hexToBnStr(block.timestamp));

  let abi;
  let abiSource = 'etherscan-v2';
  if (etherscanKey) {
    const url = `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=${LEGACY}&apikey=${etherscanKey}`;
    const s = shCurl(url);
    if (s.status === '1' && s.result && s.result[0] && s.result[0].ABI) {
      abi = JSON.parse(s.result[0].ABI);
    }
  }
  if (!abi) {
    abiSource = 'blockscout-fallback';
    const sc = shCurl(`https://eth.blockscout.com/api/v2/smart-contracts/${LEGACY}`);
    abi = sc.abi;
    if (!Array.isArray(abi)) throw new Error('Unable to load ABI from Etherscan and Blockscout fallback');
  }

  const call = (name, args = []) => {
    const entry = abi.find((x) => x.type === 'function' && x.name === name && (x.inputs || []).length === args.length);
    if (!entry) return { exists: false };
    const data = Abi.encodeFunctionCall(entry, args);
    const raw = rpc('eth_call', [{ to: LEGACY, data }, blockTag], rpcUrl);
    const dec = Abi.decodeParameters(entry.outputs || [], raw);
    const norm = (entry.outputs || []).map((o, idx) => ({ type: o.type, value: dec[idx] }));
    return { exists: true, entry, outputs: norm };
  };

  const readVal = (name, convert = (x) => x) => {
    const r = call(name);
    if (!r.exists) return undefined;
    return convert(r.outputs[0].value);
  };

  const slot = (indexHex) => rpc('eth_getStorageAt', [LEGACY, indexHex, blockTag], rpcUrl);
  const eip1967ImplSlot = '0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC';
  const eip1967AdminSlot = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
  const implSlotVal = slot(eip1967ImplSlot);
  const adminSlotVal = slot(eip1967AdminSlot);
  const parseSlotAddress = (v) => (v && v !== '0x' + '0'.repeat(64) ? toChecksum('0x' + v.slice(26)) : null);

  const proxy = {
    implementation: parseSlotAddress(implSlotVal),
    admin: parseSlotAddress(adminSlotVal),
    detected: implSlotVal !== '0x' + '0'.repeat(64) || adminSlotVal !== '0x' + '0'.repeat(64),
  };

  const config = {
    owner: readVal('owner', toChecksum),
    agiToken: readVal('agiToken', toChecksum),
    ens: readVal('ens', toChecksum),
    nameWrapper: readVal('nameWrapper', toChecksum),
    ensJobPages: readVal('ensJobPages', toChecksum),
    useEnsJobTokenURI: readVal('useEnsJobTokenURI', (v) => Boolean(v)),
    lockIdentityConfig: readVal('lockIdentityConfig', (v) => Boolean(v)),
    paused: readVal('paused', (v) => Boolean(v)),
    settlementPaused: readVal('settlementPaused', (v) => Boolean(v)),
    clubRootNode: readVal('clubRootNode'),
    agentRootNode: readVal('agentRootNode'),
    alphaClubRootNode: readVal('alphaClubRootNode'),
    alphaAgentRootNode: readVal('alphaAgentRootNode'),
    validatorMerkleRoot: readVal('validatorMerkleRoot'),
    agentMerkleRoot: readVal('agentMerkleRoot'),
    requiredValidatorApprovals: readVal('requiredValidatorApprovals', String),
    requiredValidatorDisapprovals: readVal('requiredValidatorDisapprovals', String),
    voteQuorum: readVal('voteQuorum', String),
    premiumReputationThreshold: readVal('premiumReputationThreshold', String),
    validationRewardPercentage: readVal('validationRewardPercentage', String),
    maxJobPayout: readVal('maxJobPayout', String),
    jobDurationLimit: readVal('jobDurationLimit', String),
    completionReviewPeriod: readVal('completionReviewPeriod', String),
    disputeReviewPeriod: readVal('disputeReviewPeriod', String),
    validatorBondBps: readVal('validatorBondBps', String),
    validatorBondMin: readVal('validatorBondMin', String),
    validatorBondMax: readVal('validatorBondMax', String),
    agentBondBps: readVal('agentBondBps', String),
    agentBondMin: readVal('agentBond', String),
    agentBondMax: readVal('agentBondMax', String),
    validatorSlashBps: readVal('validatorSlashBps', String),
    challengePeriodAfterApproval: readVal('challengePeriodAfterApproval', String),
  };

  const blockscoutContract = shCurl(`https://eth.blockscout.com/api/v2/smart-contracts/${LEGACY}`);
  const constructorArgs = blockscoutContract.decoded_constructor_args || [];
  const ctorMap = Object.fromEntries(constructorArgs.map((x) => [x.name, x.value]));
  let baseIpfsUrl = ctorMap._baseIpfsUrl || ctorMap.baseIpfs || null;
  if (!baseIpfsUrl) {
    const nextTokenId = readVal('nextTokenId', String);
    const tokenUriFn = abi.find((x) => x.type === 'function' && x.name === 'tokenURI' && (x.inputs || []).length === 1);
    if (tokenUriFn && nextTokenId && BigInt(nextTokenId) > 0n) {
      const sampleCount = Math.min(Number(nextTokenId), 3);
      for (let i = 0; i < sampleCount; i++) {
        try {
          const data = Abi.encodeFunctionCall(tokenUriFn, [String(i)]);
          const raw = rpc('eth_call', [{ to: LEGACY, data }, blockTag], rpcUrl);
          const uri = Abi.decodeParameter('string', raw);
          const m = uri.match(/^(.*\/ipfs\/?)/i);
          if (m && m[1]) {
            baseIpfsUrl = m[1].replace(/\/+$/, '/') ;
            break;
          }
        } catch (_) {}
      }
    }
  }
  if (!baseIpfsUrl) {
    throw new Error('Unable to derive baseIpfsUrl from constructor args or tokenURI samples.');
  }

  const alphaClubRootNode = config.alphaClubRootNode || namehash('alpha.club.agi.eth');
  const alphaAgentRootNode = config.alphaAgentRootNode || namehash('alpha.agent.agi.eth');
  config.alphaClubRootNode = alphaClubRootNode;
  config.alphaAgentRootNode = alphaAgentRootNode;

  const selectors = {};
  for (const fn of abi.filter((x) => x.type === 'function')) {
    const sig = `${fn.name}(${(fn.inputs || []).map((i) => i.type).join(',')})`;
    selectors[Web3Utils.keccak256(sig).slice(0, 10)] = fn;
  }

  const txs = [];
  let next = null;
  for (let i = 0; i < 200; i++) {
    const params = new URLSearchParams(next || {}).toString();
    const url = `https://eth.blockscout.com/api/v2/addresses/${LEGACY}/transactions${params ? `?${params}` : ''}`;
    const page = shCurl(url);
    for (const it of page.items || []) {
      if (!it.raw_input || it.raw_input === '0x') continue;
      const bn = Number(it.block_number);
      if (bn > blockNumber) continue;
      txs.push({ hash: it.hash, blockNumber: bn, txIndex: Number(it.position || 0), input: it.raw_input, timestamp: it.timestamp });
    }
    if (!page.next_page_params) break;
    next = page.next_page_params;
  }
  txs.sort((a, b) => (a.blockNumber - b.blockNumber) || (a.txIndex - b.txIndex));

  const state = {
    moderators: new Map(),
    additionalAgents: new Map(),
    additionalValidators: new Map(),
    blacklistedAgents: new Map(),
    blacklistedValidators: new Map(),
    agiTypes: [],
  };
  const findAgi = (addr) => state.agiTypes.find((x) => x.nftAddress === addr);

  for (const tx of txs) {
    const sel = tx.input.slice(0, 10);
    const fn = selectors[sel];
    if (!fn) continue;
    const vals = Abi.decodeParameters(fn.inputs || [], '0x' + tx.input.slice(10));
    const src = `tx:${tx.hash}`;
    const getAddr = (i) => toChecksum(vals[i]);
    switch (fn.name) {
      case 'addModerator': state.moderators.set(getAddr(0), { enabled: true, source: src }); break;
      case 'removeModerator': state.moderators.delete(getAddr(0)); break;
      case 'addAdditionalAgent': state.additionalAgents.set(getAddr(0), { enabled: true, source: src }); break;
      case 'removeAdditionalAgent': state.additionalAgents.delete(getAddr(0)); break;
      case 'addAdditionalValidator': state.additionalValidators.set(getAddr(0), { enabled: true, source: src }); break;
      case 'removeAdditionalValidator': state.additionalValidators.delete(getAddr(0)); break;
      case 'blacklistAgent': {
        const a = getAddr(0); const st = Boolean(vals[1]);
        if (st) state.blacklistedAgents.set(a, { enabled: true, source: src }); else state.blacklistedAgents.delete(a);
        break;
      }
      case 'blacklistValidator': {
        const a = getAddr(0); const st = Boolean(vals[1]);
        if (st) state.blacklistedValidators.set(a, { enabled: true, source: src }); else state.blacklistedValidators.delete(a);
        break;
      }
      case 'addAGIType': {
        const a = getAddr(0); const pct = String(vals[1]);
        const ex = findAgi(a);
        if (ex) { ex.payoutPercentage = pct; ex.enabled = BigInt(pct) > 0n; ex.source = src; }
        else state.agiTypes.push({ nftAddress: a, payoutPercentage: pct, enabled: BigInt(pct) > 0n, source: src });
        break;
      }
      case 'disableAGIType': {
        const a = getAddr(0); const ex = findAgi(a);
        if (ex) { ex.payoutPercentage = '0'; ex.enabled = false; ex.source = src; }
        else state.agiTypes.push({ nftAddress: a, payoutPercentage: '0', enabled: false, source: src, inferredMissingAdd: true });
        break;
      }
      default: break;
    }
  }

  // Probe array getter for legacy AGI types as sanity check
  const agiTypesFromGetter = [];
  const agiTypeFn = abi.find((x) => x.type === 'function' && x.name === 'agiTypes' && (x.inputs || []).length === 1);
  if (agiTypeFn) {
    for (let i = 0; i < 128; i++) {
      try {
        const data = Abi.encodeFunctionCall(agiTypeFn, [String(i)]);
        const raw = rpc('eth_call', [{ to: LEGACY, data }, blockTag], rpcUrl);
        const dec = Abi.decodeParameters(agiTypeFn.outputs, raw);
        const nft = toChecksum(dec[0]);
        const pct = String(dec[1]);
        agiTypesFromGetter.push({ nftAddress: nft, payoutPercentage: pct, enabled: BigInt(pct) > 0n, source: `getter:index:${i}` });
      } catch (_) { break; }
    }
  }
  if (agiTypesFromGetter.length > 0) state.agiTypes = agiTypesFromGetter;

  const expectedHints = {
    agiToken: '0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA',
    baseIpfsUrl: 'https://ipfs.io/ipfs/',
    ens: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    nameWrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
    clubRootNode: '0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16',
    agentRootNode: '0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d',
    alphaClubRootNode: '0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e',
    alphaAgentRootNode: '0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e',
    merkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
    aiMythical: { nftAddress: '0x130909390AC76c53986957814Bde8786B8605fF3', payoutPercentage: '80' },
  };

  const derivedRoots = [
    { name: 'alpha.club.agi.eth', value: alphaClubRootNode, derived: true },
    { name: 'alpha.agent.agi.eth', value: alphaAgentRootNode, derived: true },
  ];

  const snapshot = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    generatedBy: 'scripts/snapshotLegacyMainnetConfig.js',
    abiSource,
    legacyAddress: LEGACY,
    chainId,
    blockNumber,
    blockTimestamp,
    rpcUrl,
    proxy,
    constructor: {
      baseIpfsUrl,
      decodedArgsSource: 'blockscout.decoded_constructor_args',
    },
    config,
    derivedRoots,
    dynamic: {
      moderators: [...state.moderators.entries()].map(([address, meta]) => ({ address, source: meta.source })),
      additionalAgents: [...state.additionalAgents.entries()].map(([address, meta]) => ({ address, source: meta.source })),
      additionalValidators: [...state.additionalValidators.entries()].map(([address, meta]) => ({ address, source: meta.source })),
      blacklistedAgents: [...state.blacklistedAgents.entries()].map(([address, meta]) => ({ address, source: meta.source })),
      blacklistedValidators: [...state.blacklistedValidators.entries()].map(([address, meta]) => ({ address, source: meta.source })),
      agiTypes: state.agiTypes,
      replay: {
        txCount: txs.length,
        firstTx: txs[0]?.hash || null,
        lastTx: txs[txs.length - 1]?.hash || null,
      },
    },
    sanity: {
      expectedHints,
      differences: {
        agiToken: config.agiToken === toChecksum(expectedHints.agiToken) ? null : { expected: toChecksum(expectedHints.agiToken), actual: config.agiToken },
        baseIpfsUrl: baseIpfsUrl === expectedHints.baseIpfsUrl ? null : { expected: expectedHints.baseIpfsUrl, actual: baseIpfsUrl },
        ens: config.ens === toChecksum(expectedHints.ens) ? null : { expected: toChecksum(expectedHints.ens), actual: config.ens },
        nameWrapper: config.nameWrapper === toChecksum(expectedHints.nameWrapper) ? null : { expected: toChecksum(expectedHints.nameWrapper), actual: config.nameWrapper },
      },
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');

  console.log('Legacy snapshot generated:');
  console.log(`- file: ${OUT}`);
  console.log(`- chainId/block: ${chainId}/${blockNumber} @ ${blockTimestamp}`);
  console.log(`- owner: ${config.owner}`);
  console.log(`- agiToken: ${config.agiToken}`);
  console.log(`- ens/nameWrapper: ${config.ens} / ${config.nameWrapper}`);
  console.log(`- root nodes: club=${config.clubRootNode} agent=${config.agentRootNode} alphaClub=${config.alphaClubRootNode} alphaAgent=${config.alphaAgentRootNode}`);
  console.log(`- merkle roots: validator=${config.validatorMerkleRoot} agent=${config.agentMerkleRoot}`);
  console.log(`- counts: moderators=${snapshot.dynamic.moderators.length} additionalAgents=${snapshot.dynamic.additionalAgents.length} additionalValidators=${snapshot.dynamic.additionalValidators.length} blacklistedAgents=${snapshot.dynamic.blacklistedAgents.length} blacklistedValidators=${snapshot.dynamic.blacklistedValidators.length} agiTypes=${snapshot.dynamic.agiTypes.length}`);
  console.log('- hint differences:', JSON.stringify(snapshot.sanity.differences, null, 2));
}

main().catch((e) => {
  console.error('Snapshot failed:', e.message);
  process.exit(1);
});
