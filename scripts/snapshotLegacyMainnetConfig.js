#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Web3 = require('web3');

const LEGACY_ADDRESS = '0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477';
const ETHERSCAN_API = 'https://api.etherscan.io/api';
const EIP1967_IMPLEMENTATION_SLOT = '0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC';
const SNAPSHOT_PATH = path.join('migrations', 'snapshots', `legacy.mainnet.${LEGACY_ADDRESS}.json`);

const HINTS = {
  agiToken: '0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa',
  baseIpfsUrl: 'https://ipfs.io/ipfs/',
  ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  nameWrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
  clubRootNode: '0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16',
  agentRootNode: '0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d',
  alphaClubRootNode: '0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e',
  alphaAgentRootNode: '0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e',
  validatorMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
  agentMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
  aimythicalNft: '0x130909390AC76c53986957814Bde8786B8605fF3',
  aimythicalPct: '80',
};

function parseArgs() {
  const args = process.argv.slice(2);
  let block = 'latest';
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--block') {
      block = args[i + 1];
      i += 1;
    }
  }
  return { block };
}

function toChecksum(web3, value) {
  return web3.utils.toChecksumAddress(value);
}

function toStringNum(value) {
  if (value === undefined || value === null) return null;
  return String(value);
}

function normalizeBytes32(value) {
  if (!value) return '0x' + '00'.repeat(32);
  return value.toLowerCase();
}

function selectorOf(web3, signature) {
  return web3.eth.abi.encodeFunctionSignature(signature).toLowerCase();
}

async function etherscanQuery(params) {
  const url = new URL(ETHERSCAN_API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`Etherscan HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === '0' && data.message !== 'No transactions found') {
    throw new Error(`Etherscan error: ${data.result || data.message}`);
  }
  return data;
}

async function fetchSourceMetadata(address, apiKey) {
  const data = await etherscanQuery({
    module: 'contract',
    action: 'getsourcecode',
    address,
    apikey: apiKey || 'YourApiKeyToken',
  });
  if (!Array.isArray(data.result) || !data.result.length) {
    throw new Error(`No Etherscan source metadata for ${address}`);
  }
  return data.result[0];
}

async function fetchAllTxs(address, apiKey, endBlock) {
  const txs = [];
  let page = 1;
  const offset = 10000;
  while (true) {
    const data = await etherscanQuery({
      module: 'account',
      action: 'txlist',
      address,
      startblock: 0,
      endblock: endBlock,
      page,
      offset,
      sort: 'asc',
      apikey: apiKey || 'YourApiKeyToken',
    });
    if (!Array.isArray(data.result) || data.result.length === 0) break;
    txs.push(...data.result);
    if (data.result.length < offset) break;
    page += 1;
  }
  return txs;
}

function sortTxs(txs) {
  return txs.sort((a, b) => {
    const bn = Number(a.blockNumber) - Number(b.blockNumber);
    if (bn !== 0) return bn;
    return Number(a.transactionIndex) - Number(b.transactionIndex);
  });
}

function parseAbi(abiText, address) {
  try {
    return JSON.parse(abiText);
  } catch (err) {
    throw new Error(`Failed parsing ABI for ${address}: ${err.message}`);
  }
}

function buildFunctionIndex(web3, abi) {
  const bySelector = new Map();
  const named = new Map();
  abi.filter((i) => i.type === 'function').forEach((item) => {
    const signature = `${item.name}(${(item.inputs || []).map((i) => i.type).join(',')})`;
    const selector = selectorOf(web3, signature);
    bySelector.set(selector, item);
    if (!named.has(item.name)) named.set(item.name, []);
    named.get(item.name).push(item);
  });
  return { bySelector, named };
}

function parseAddr(web3, value) {
  if (!value || /^0x0+$/.test(value)) return '0x0000000000000000000000000000000000000000';
  return toChecksum(web3, value);
}

async function callIf(contract, methodName, blockTag, ...args) {
  if (!contract.methods[methodName]) return undefined;
  return contract.methods[methodName](...args).call({}, blockTag);
}

function namehash(web3, name) {
  let node = '0x' + '00'.repeat(32);
  if (!name) return node;
  const labels = name.split('.').filter(Boolean).reverse();
  for (const label of labels) {
    const labelHash = web3.utils.keccak256(label);
    node = web3.utils.keccak256(node + labelHash.slice(2));
  }
  return node.toLowerCase();
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const { block } = parseArgs();
  const rpcUrl = process.env.MAINNET_RPC_URL;
  const apiKey = process.env.ETHERSCAN_API_KEY;
  ensure(rpcUrl, 'MAINNET_RPC_URL is required.');

  const web3 = new Web3(rpcUrl);
  const chainId = Number(await web3.eth.getChainId());
  ensure(chainId === 1, `Expected chainId 1, got ${chainId}.`);

  const resolvedBlock = block === 'latest' ? await web3.eth.getBlockNumber() : Number(block);
  const header = await web3.eth.getBlock(resolvedBlock);
  ensure(header, `Block ${resolvedBlock} not found.`);

  const metadata = await fetchSourceMetadata(LEGACY_ADDRESS, apiKey);
  const proxyMetadataImpl = metadata.Implementation && metadata.Implementation !== '' ? metadata.Implementation : null;
  const storageImpl = await web3.eth.getStorageAt(LEGACY_ADDRESS, EIP1967_IMPLEMENTATION_SLOT, resolvedBlock);
  const storageImplAddr = storageImpl && storageImpl !== '0x' && storageImpl !== '0x0'
    ? toChecksum(web3, `0x${storageImpl.slice(26)}`)
    : null;

  const isProxy = metadata.Proxy === '1' || Boolean(proxyMetadataImpl) || (storageImplAddr && storageImplAddr !== '0x0000000000000000000000000000000000000000');
  const implementationAddress = proxyMetadataImpl || storageImplAddr;
  let logicAbi = parseAbi(metadata.ABI, LEGACY_ADDRESS);
  if (isProxy && implementationAddress) {
    const implMeta = await fetchSourceMetadata(implementationAddress, apiKey);
    logicAbi = parseAbi(implMeta.ABI, implementationAddress);
  }

  const contract = new web3.eth.Contract(logicAbi, LEGACY_ADDRESS);
  const fnIndex = buildFunctionIndex(web3, logicAbi);

  const sourceTxs = await fetchAllTxs(LEGACY_ADDRESS, apiKey, resolvedBlock);
  const sortedTxs = sortTxs(sourceTxs).filter((tx) => tx.to && tx.to.toLowerCase() === LEGACY_ADDRESS.toLowerCase());

  const state = {
    moderators: new Map(),
    additionalAgents: new Map(),
    additionalValidators: new Map(),
    blacklistedAgents: new Map(),
    blacklistedValidators: new Map(),
    agiTypes: new Map(),
    agiTypeOrder: [],
  };

  function upsertAgiType(nftAddress, payoutPercentage, txHash, enabledOverride) {
    const key = nftAddress.toLowerCase();
    const existing = state.agiTypes.get(key);
    const payload = {
      nftAddress: toChecksum(web3, nftAddress),
      payoutPercentage: String(payoutPercentage),
      enabled: enabledOverride !== undefined ? enabledOverride : String(payoutPercentage) !== '0',
      source: txHash,
    };
    if (!existing) {
      state.agiTypeOrder.push(key);
      state.agiTypes.set(key, payload);
      return;
    }
    state.agiTypes.set(key, { ...existing, ...payload });
  }

  for (const tx of sortedTxs) {
    if (!tx.input || tx.input.length < 10) continue;
    const selector = tx.input.slice(0, 10).toLowerCase();
    const item = fnIndex.bySelector.get(selector);
    if (!item) continue;
    const data = `0x${tx.input.slice(10)}`;
    let decoded;
    try {
      decoded = web3.eth.abi.decodeParameters(item.inputs, data);
    } catch (_) {
      continue;
    }

    const method = item.name;
    const txHash = tx.hash;

    if (method === 'addModerator') state.moderators.set(toChecksum(web3, decoded[0]), { enabled: true, source: txHash });
    if (method === 'removeModerator') state.moderators.set(toChecksum(web3, decoded[0]), { enabled: false, source: txHash });

    if (method === 'addAdditionalAgent') state.additionalAgents.set(toChecksum(web3, decoded[0]), { enabled: true, source: txHash });
    if (method === 'removeAdditionalAgent') state.additionalAgents.set(toChecksum(web3, decoded[0]), { enabled: false, source: txHash });

    if (method === 'addAdditionalValidator') state.additionalValidators.set(toChecksum(web3, decoded[0]), { enabled: true, source: txHash });
    if (method === 'removeAdditionalValidator') state.additionalValidators.set(toChecksum(web3, decoded[0]), { enabled: false, source: txHash });

    if (method === 'blacklistAgent') {
      const status = decoded.__length__ > 1 ? Boolean(decoded[1]) : true;
      state.blacklistedAgents.set(toChecksum(web3, decoded[0]), { enabled: status, source: txHash });
    }
    if (method === 'blacklistValidator') {
      const status = decoded.__length__ > 1 ? Boolean(decoded[1]) : true;
      state.blacklistedValidators.set(toChecksum(web3, decoded[0]), { enabled: status, source: txHash });
    }

    if (method === 'addAGIType' || method === 'setAGIType' || method === 'updateAGIType') {
      upsertAgiType(decoded[0], decoded[1], txHash);
    }
    if (method === 'disableAGIType' || method === 'removeAGIType') {
      upsertAgiType(decoded[0], '0', txHash, false);
    }
  }

  const agiTypesOrdered = state.agiTypeOrder.map((key) => state.agiTypes.get(key));

  const safeCallAddr = async (name) => {
    const v = await callIf(contract, name, resolvedBlock);
    return v !== undefined ? parseAddr(web3, v) : undefined;
  };
  const safeCallBytes = async (name) => {
    const v = await callIf(contract, name, resolvedBlock);
    return v !== undefined ? normalizeBytes32(v) : undefined;
  };
  const safeCallBool = async (name) => {
    const v = await callIf(contract, name, resolvedBlock);
    return v !== undefined ? Boolean(v) : undefined;
  };
  const safeCallUint = async (name) => {
    const v = await callIf(contract, name, resolvedBlock);
    return v !== undefined ? toStringNum(v) : undefined;
  };

  const getterCandidates = {
    owner: ['owner'],
    agiToken: ['agiToken', 'agiTokenAddress'],
    ensRegistry: ['ens', 'ensRegistry'],
    nameWrapper: ['nameWrapper'],
    ensJobPages: ['ensJobPages'],
    baseIpfsUrl: ['baseIpfsUrl', 'getBaseIpfsUrl'],
    clubRootNode: ['clubRootNode'],
    agentRootNode: ['agentRootNode'],
    alphaClubRootNode: ['alphaClubRootNode'],
    alphaAgentRootNode: ['alphaAgentRootNode'],
    validatorMerkleRoot: ['validatorMerkleRoot'],
    agentMerkleRoot: ['agentMerkleRoot'],
    paused: ['paused'],
    settlementPaused: ['settlementPaused'],
    lockIdentityConfig: ['lockIdentityConfig'],
    useEnsJobTokenURI: ['useEnsJobTokenURI', 'isUseEnsJobTokenURI', 'getUseEnsJobTokenURI'],
    requiredValidatorApprovals: ['requiredValidatorApprovals'],
    requiredValidatorDisapprovals: ['requiredValidatorDisapprovals'],
    voteQuorum: ['voteQuorum'],
    premiumReputationThreshold: ['premiumReputationThreshold'],
    validationRewardPercentage: ['validationRewardPercentage'],
    maxJobPayout: ['maxJobPayout'],
    jobDurationLimit: ['jobDurationLimit'],
    completionReviewPeriod: ['completionReviewPeriod'],
    disputeReviewPeriod: ['disputeReviewPeriod'],
    validatorBondBps: ['validatorBondBps'],
    validatorBondMin: ['validatorBondMin'],
    validatorBondMax: ['validatorBondMax'],
    agentBond: ['agentBond'],
    agentBondBps: ['agentBondBps'],
    agentBondMax: ['agentBondMax'],
    validatorSlashBps: ['validatorSlashBps'],
    challengePeriodAfterApproval: ['challengePeriodAfterApproval'],
  };

  async function firstAddr(candidates) {
    for (const c of candidates) {
      if (contract.methods[c]) return safeCallAddr(c);
    }
    return undefined;
  }
  async function firstBytes(candidates) {
    for (const c of candidates) {
      if (contract.methods[c]) return safeCallBytes(c);
    }
    return undefined;
  }
  async function firstBool(candidates) {
    for (const c of candidates) {
      if (contract.methods[c]) return safeCallBool(c);
    }
    return undefined;
  }
  async function firstUint(candidates) {
    for (const c of candidates) {
      if (contract.methods[c]) return safeCallUint(c);
    }
    return undefined;
  }
  async function firstString(candidates) {
    for (const c of candidates) {
      if (contract.methods[c]) return callIf(contract, c, resolvedBlock);
    }
    return undefined;
  }

  const roots = {
    clubRootNode: await firstBytes(getterCandidates.clubRootNode),
    agentRootNode: await firstBytes(getterCandidates.agentRootNode),
    alphaClubRootNode: await firstBytes(getterCandidates.alphaClubRootNode),
    alphaAgentRootNode: await firstBytes(getterCandidates.alphaAgentRootNode),
  };

  const snapshot = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    snapshotId: crypto.createHash('sha256').update(`${LEGACY_ADDRESS}:${resolvedBlock}`).digest('hex'),
    source: {
      chainId,
      blockNumber: header.number,
      blockTimestamp: header.timestamp,
      legacyAddress: LEGACY_ADDRESS,
      proxy: {
        isProxy,
        implementationAddress: implementationAddress || null,
        eip1967Slot: EIP1967_IMPLEMENTATION_SLOT,
      },
      abiAddressUsed: isProxy && implementationAddress ? implementationAddress : LEGACY_ADDRESS,
    },
    addresses: {
      owner: await firstAddr(getterCandidates.owner),
      agiToken: await firstAddr(getterCandidates.agiToken),
      ensRegistry: await firstAddr(getterCandidates.ensRegistry),
      nameWrapper: await firstAddr(getterCandidates.nameWrapper),
      ensJobPages: await firstAddr(getterCandidates.ensJobPages),
    },
    strings: {
      baseIpfsUrl: await firstString(getterCandidates.baseIpfsUrl),
    },
    roots: {
      ...roots,
      derived: [
        { name: 'alpha.club.agi.eth', node: namehash(web3, 'alpha.club.agi.eth'), derived: true },
        { name: 'alpha.agent.agi.eth', node: namehash(web3, 'alpha.agent.agi.eth'), derived: true },
      ],
    },
    merkleRoots: {
      validatorMerkleRoot: await firstBytes(getterCandidates.validatorMerkleRoot),
      agentMerkleRoot: await firstBytes(getterCandidates.agentMerkleRoot),
    },
    flags: {
      paused: await firstBool(getterCandidates.paused),
      settlementPaused: await firstBool(getterCandidates.settlementPaused),
      lockIdentityConfig: await firstBool(getterCandidates.lockIdentityConfig),
      useEnsJobTokenURI: await firstBool(getterCandidates.useEnsJobTokenURI),
    },
    params: {
      requiredValidatorApprovals: await firstUint(getterCandidates.requiredValidatorApprovals),
      requiredValidatorDisapprovals: await firstUint(getterCandidates.requiredValidatorDisapprovals),
      voteQuorum: await firstUint(getterCandidates.voteQuorum),
      premiumReputationThreshold: await firstUint(getterCandidates.premiumReputationThreshold),
      validationRewardPercentage: await firstUint(getterCandidates.validationRewardPercentage),
      maxJobPayout: await firstUint(getterCandidates.maxJobPayout),
      jobDurationLimit: await firstUint(getterCandidates.jobDurationLimit),
      completionReviewPeriod: await firstUint(getterCandidates.completionReviewPeriod),
      disputeReviewPeriod: await firstUint(getterCandidates.disputeReviewPeriod),
      validatorBondBps: await firstUint(getterCandidates.validatorBondBps),
      validatorBondMin: await firstUint(getterCandidates.validatorBondMin),
      validatorBondMax: await firstUint(getterCandidates.validatorBondMax),
      agentBond: await firstUint(getterCandidates.agentBond),
      agentBondBps: await firstUint(getterCandidates.agentBondBps),
      agentBondMax: await firstUint(getterCandidates.agentBondMax),
      validatorSlashBps: await firstUint(getterCandidates.validatorSlashBps),
      challengePeriodAfterApproval: await firstUint(getterCandidates.challengePeriodAfterApproval),
    },
    dynamic: {
      moderators: [...state.moderators.entries()].filter(([, v]) => v.enabled).map(([address, v]) => ({ address, source: v.source })),
      additionalAgents: [...state.additionalAgents.entries()].filter(([, v]) => v.enabled).map(([address, v]) => ({ address, source: v.source })),
      additionalValidators: [...state.additionalValidators.entries()].filter(([, v]) => v.enabled).map(([address, v]) => ({ address, source: v.source })),
      blacklistedAgents: [...state.blacklistedAgents.entries()].filter(([, v]) => v.enabled).map(([address, v]) => ({ address, source: v.source })),
      blacklistedValidators: [...state.blacklistedValidators.entries()].filter(([, v]) => v.enabled).map(([address, v]) => ({ address, source: v.source })),
      agiTypes: agiTypesOrdered,
    },
    provenance: {
      txCountScanned: sortedTxs.length,
      mutatorSelectors: [...fnIndex.bySelector.keys()],
    },
  };

  ensure(snapshot.addresses.owner, 'Missing owner from on-chain state.');
  ensure(snapshot.addresses.agiToken, 'Missing agiToken from on-chain state.');
  ensure(snapshot.roots.clubRootNode, 'Missing clubRootNode from on-chain state.');
  ensure(snapshot.merkleRoots.validatorMerkleRoot, 'Missing validatorMerkleRoot from on-chain state.');

  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);

  const checks = [
    ['agiToken', snapshot.addresses.agiToken, HINTS.agiToken],
    ['baseIpfsUrl', snapshot.strings.baseIpfsUrl, HINTS.baseIpfsUrl],
    ['ensRegistry', snapshot.addresses.ensRegistry, HINTS.ensRegistry],
    ['nameWrapper', snapshot.addresses.nameWrapper, HINTS.nameWrapper],
    ['clubRootNode', snapshot.roots.clubRootNode, HINTS.clubRootNode],
    ['agentRootNode', snapshot.roots.agentRootNode, HINTS.agentRootNode],
    ['alphaClubRootNode', snapshot.roots.alphaClubRootNode, HINTS.alphaClubRootNode],
    ['alphaAgentRootNode', snapshot.roots.alphaAgentRootNode, HINTS.alphaAgentRootNode],
    ['validatorMerkleRoot', snapshot.merkleRoots.validatorMerkleRoot, HINTS.validatorMerkleRoot],
    ['agentMerkleRoot', snapshot.merkleRoots.agentMerkleRoot, HINTS.agentMerkleRoot],
  ];

  const aimythical = snapshot.dynamic.agiTypes.find((i) => i.nftAddress.toLowerCase() === HINTS.aimythicalNft.toLowerCase());

  console.log('=== Legacy snapshot summary ===');
  console.log(`Address: ${LEGACY_ADDRESS}`);
  console.log(`Block: ${snapshot.source.blockNumber} @ ${snapshot.source.blockTimestamp}`);
  console.log(`Proxy: ${snapshot.source.proxy.isProxy} (implementation: ${snapshot.source.proxy.implementationAddress || 'n/a'})`);
  console.log(`Owner: ${snapshot.addresses.owner}`);
  console.log(`AGI token: ${snapshot.addresses.agiToken}`);
  console.log(`ENS registry: ${snapshot.addresses.ensRegistry}`);
  console.log(`NameWrapper: ${snapshot.addresses.nameWrapper}`);
  console.log(`ENS job pages: ${snapshot.addresses.ensJobPages}`);
  console.log(`Merkle roots: validator=${snapshot.merkleRoots.validatorMerkleRoot}, agent=${snapshot.merkleRoots.agentMerkleRoot}`);
  console.log(`Counts -> moderators=${snapshot.dynamic.moderators.length}, additionalAgents=${snapshot.dynamic.additionalAgents.length}, additionalValidators=${snapshot.dynamic.additionalValidators.length}, blacklistedAgents=${snapshot.dynamic.blacklistedAgents.length}, blacklistedValidators=${snapshot.dynamic.blacklistedValidators.length}, agiTypes=${snapshot.dynamic.agiTypes.length}`);
  for (const [key, actual, expected] of checks) {
    const ok = (actual || '').toLowerCase() === expected.toLowerCase();
    console.log(`Hint check ${key}: ${ok ? 'MATCH' : 'DIFF'} (actual=${actual}, expected=${expected})`);
  }
  if (aimythical) {
    const ok = aimythical.payoutPercentage === HINTS.aimythicalPct;
    console.log(`Hint check AIMYTHICAL payout: ${ok ? 'MATCH' : 'DIFF'} (actual=${aimythical.payoutPercentage}, expected=${HINTS.aimythicalPct})`);
  } else {
    console.log('Hint check AIMYTHICAL payout: DIFF (NFT not found in extracted AGI types).');
  }
  console.log(`Wrote snapshot: ${SNAPSHOT_PATH}`);
}

main().catch((err) => {
  console.error(`snapshotLegacyMainnetConfig failed: ${err.message}`);
  process.exit(1);
});
