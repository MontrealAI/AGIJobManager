#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Abi = require('web3-eth-abi');
const { keccak256, toChecksumAddress, isAddress } = require('web3-utils');

const LEGACY_ADDRESS = '0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477';
const OUTPUT_PATH = path.join(__dirname, '..', 'migrations', 'snapshots', `legacy.mainnet.${LEGACY_ADDRESS}.json`);
const ZERO32 = '0x' + '00'.repeat(32);
const EIP1967_IMPLEMENTATION_SLOT = '0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC';

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function runCurl(args) {
  return execFileSync('curl', ['-4', '-sSL', ...args], { encoding: 'utf8' });
}

function rpcCall(rpcUrl, method, params, attempt = 0) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const raw = runCurl(['-H', 'content-type: application/json', '--data', body, rpcUrl]);
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    if (attempt < 3) return rpcCall(rpcUrl, method, params, attempt + 1);
    throw new Error(`RPC ${method} returned non-JSON payload: ${raw.slice(0, 120)}`);
  }
  if (json.error) {
    if (attempt < 3) return rpcCall(rpcUrl, method, params, attempt + 1);
    throw new Error(`RPC ${method} failed: ${JSON.stringify(json.error)}`);
  }
  return json.result;
}

function etherscanGet(params, apiKey) {
  const url = new URL('https://api.etherscan.io/v2/api');
  url.searchParams.set('chainid', '1');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('apikey', apiKey);
  const json = JSON.parse(runCurl([url.toString()]));
  if (json.status !== '1') throw new Error(`Etherscan error: ${json.result || json.message}`);
  return json.result;
}

function fetchAbiFromEtherscan(address, apiKey) {
  if (!apiKey) {
    throw new Error('ETHERSCAN_API_KEY is required for API-based ABI fetch.');
  }
  const result = etherscanGet({ module: 'contract', action: 'getsourcecode', address }, apiKey);
  if (!Array.isArray(result) || !result[0] || !result[0].ABI) throw new Error('Malformed Etherscan source response.');
  const item = result[0];
  return {
    abi: JSON.parse(item.ABI),
    sourceMeta: {
      contractName: item.ContractName,
      compilerVersion: item.CompilerVersion,
      optimizationUsed: item.OptimizationUsed,
      runs: item.Runs,
      proxy: item.Proxy,
      implementation: item.Implementation,
    },
  };
}

function fallbackFetchAbiFromHtml(address) {
  const html = runCurl([`https://etherscan.io/address/${address}#code`]);
  const m = html.match(/id='js-copytextarea2'[^>]*>(\[.*\])<\/pre>/s);
  if (!m) throw new Error('Failed to scrape ABI from Etherscan HTML fallback.');
  return JSON.parse(m[1]);
}


function decodeStringResult(hex) {
  return Abi.decodeParameter('string', hex);
}

function tryDeriveBaseFromTokenURI(rpcUrl, address, blockTag) {
  try {
    const data = Abi.encodeFunctionCall({ name: 'tokenURI', type: 'function', inputs: [{ type: 'uint256', name: 'tokenId' }] }, ['0']);
    const out = rpcCall(rpcUrl, 'eth_call', [{ to: address, data }, blockTag]);
    const uri = decodeStringResult(out);
    const q = uri.indexOf('/Qm');
    if (q > 0) return uri.slice(0, q);
    const idx = uri.lastIndexOf('/');
    if (idx > 10) return uri.slice(0, idx);
    return null;
  } catch (_) {
    return null;
  }
}

function decodeSingle(outputType, hex) {
  const decoded = Abi.decodeParameter(outputType, hex);
  if (outputType.startsWith('uint') || outputType.startsWith('int')) return decoded.toString();
  if (outputType === 'address') return toChecksumAddress(decoded);
  return decoded;
}

function callViewAtBlock(rpcUrl, address, fnAbi, blockTag) {
  const data = Abi.encodeFunctionCall(fnAbi, []);
  const result = rpcCall(rpcUrl, 'eth_call', [{ to: address, data }, blockTag]);
  return decodeSingle(fnAbi.outputs[0].type, result);
}

function eventTopic(eventAbi) {
  const signature = `${eventAbi.name}(${eventAbi.inputs.map((i) => i.type).join(',')})`;
  return keccak256(signature);
}

function hexToNumber(hex) {
  return Number(BigInt(hex));
}

function hexToAddress(hex) {
  return toChecksumAddress(`0x${hex.slice(-40)}`);
}


function parseTraceId(traceId) {
  if (traceId === undefined || traceId === null || traceId === '') return [0n];
  return String(traceId).split('_').flatMap((part) => part.split('.')).filter(Boolean).map((n) => BigInt(n));
}

function compareReplayOrder(a, b) {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  if (a.transactionIndex !== b.transactionIndex) return a.transactionIndex < b.transactionIndex ? -1 : 1;
  const ta = a.traceOrder || [0n];
  const tb = b.traceOrder || [0n];
  const maxLen = Math.max(ta.length, tb.length);
  for (let i = 0; i < maxLen; i += 1) {
    const va = ta[i] ?? -1n;
    const vb = tb[i] ?? -1n;
    if (va !== vb) return va < vb ? -1 : 1;
  }
  return 0;
}

function namehash(name) {
  let node = Buffer.alloc(32, 0);
  if (!name) return `0x${node.toString('hex')}`;
  const labels = name.toLowerCase().split('.').filter(Boolean);
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    const labelHash = Buffer.from(keccak256(labels[i]).slice(2), 'hex');
    node = Buffer.from(keccak256(Buffer.concat([node, labelHash])).slice(2), 'hex');
  }
  return `0x${node.toString('hex')}`;
}

function parseMutatorTxs({ txs, mutators, blockLimit }) {
  const state = {
    moderators: new Map(),
    additionalAgents: new Map(),
    additionalValidators: new Map(),
    blacklistedAgents: new Map(),
    blacklistedValidators: new Map(),
    baseIpfsUrl: null,
    useEnsJobTokenURI: null,
    provenance: { moderators: {}, additionalAgents: {}, additionalValidators: {}, blacklistedAgents: {}, blacklistedValidators: {}, baseIpfsUrl: [], useEnsJobTokenURI: [] },
  };
  const bySelector = new Map();
  mutators.forEach((f) => bySelector.set(Abi.encodeFunctionSignature(f), f));

  for (const tx of txs) {
    if (!tx.input || tx.input === '0x') continue;
    if (BigInt(tx.blockNumber) > BigInt(blockLimit)) continue;
    const selector = tx.input.slice(0, 10);
    const fn = bySelector.get(selector);
    if (!fn) continue;
    const decoded = Abi.decodeParameters(fn.inputs, `0x${tx.input.slice(10)}`);
    const src = { txHash: tx.hash, blockNumber: tx.blockNumber.toString(), txIndex: tx.transactionIndex.toString(), traceId: tx.traceId || null, function: fn.name };

    if (fn.name === 'addModerator' || fn.name === 'removeModerator') {
      const a = toChecksumAddress(decoded[0]);
      const enabled = fn.name === 'addModerator';
      state.moderators.set(a, enabled);
      state.provenance.moderators[a] = src;
    } else if (fn.name === 'addAdditionalAgent' || fn.name === 'removeAdditionalAgent') {
      const a = toChecksumAddress(decoded[0]);
      const enabled = fn.name === 'addAdditionalAgent';
      state.additionalAgents.set(a, enabled);
      state.provenance.additionalAgents[a] = src;
    } else if (fn.name === 'addAdditionalValidator' || fn.name === 'removeAdditionalValidator') {
      const a = toChecksumAddress(decoded[0]);
      const enabled = fn.name === 'addAdditionalValidator';
      state.additionalValidators.set(a, enabled);
      state.provenance.additionalValidators[a] = src;
    } else if (fn.name === 'blacklistAgent') {
      const a = toChecksumAddress(decoded[0]);
      const enabled = Boolean(decoded[1]);
      state.blacklistedAgents.set(a, enabled);
      state.provenance.blacklistedAgents[a] = src;
    } else if (fn.name === 'blacklistValidator') {
      const a = toChecksumAddress(decoded[0]);
      const enabled = Boolean(decoded[1]);
      state.blacklistedValidators.set(a, enabled);
      state.provenance.blacklistedValidators[a] = src;
    } else if (fn.name === 'setBaseIpfsUrl') {
      state.baseIpfsUrl = decoded[0];
      state.provenance.baseIpfsUrl.push(src);
    } else if (fn.name === 'setUseEnsJobTokenURI') {
      state.useEnsJobTokenURI = Boolean(decoded[0]);
      state.provenance.useEnsJobTokenURI.push(src);
    }
  }

  return state;
}


function fetchOwnershipTransferLogs(rpcUrl, address, toBlockHex) {
  const topic0 = keccak256('OwnershipTransferred(address,address)');
  const logs = [];
  const end = BigInt(toBlockHex);
  const chunk = 50000n;
  for (let from = 0n; from <= end; from += chunk) {
    const to = from + chunk - 1n > end ? end : from + chunk - 1n;
    const part = rpcCall(rpcUrl, 'eth_getLogs', [{
      fromBlock: `0x${from.toString(16)}`,
      toBlock: `0x${to.toString(16)}`,
      address,
      topics: [topic0],
    }]);
    logs.push(...part);
  }
  logs.sort((a, b) => {
    const bnA = BigInt(a.blockNumber); const bnB = BigInt(b.blockNumber);
    if (bnA !== bnB) return bnA < bnB ? -1 : 1;
    const txA = BigInt(a.transactionIndex); const txB = BigInt(b.transactionIndex);
    if (txA !== txB) return txA < txB ? -1 : 1;
    const lgA = BigInt(a.logIndex); const lgB = BigInt(b.logIndex);
    return lgA < lgB ? -1 : 1;
  });
  return logs;
}

function historicalOwnershipSafety(rpcUrl, address, snapshotBlockHex, currentOwner) {
  const logs = fetchOwnershipTransferLogs(rpcUrl, address, snapshotBlockHex);
  const snapshotBn = BigInt(snapshotBlockHex);
  const epochs = [];

  if (logs.length === 0) {
    epochs.push({ owner: currentOwner, startBlock: snapshotBlockHex, endBlock: snapshotBlockHex, source: 'current-owner-no-transfer-events' });
  } else {
    const firstOldOwner = hexToAddress(logs[0].topics[1]);
    const firstTransferBlock = BigInt(logs[0].blockNumber);
    if (firstOldOwner !== '0x0000000000000000000000000000000000000000' && firstTransferBlock > 0n) {
      epochs.push({
        owner: firstOldOwner,
        startBlock: '0x0',
        endBlock: `0x${(firstTransferBlock - 1n).toString(16)}`,
        source: 'OwnershipTransferred.initialOldOwnerWindow',
      });
    }

    for (let i = 0; i < logs.length; i += 1) {
      const log = logs[i];
      const owner = hexToAddress(log.topics[2]);
      const start = BigInt(log.blockNumber);
      const next = i + 1 < logs.length ? BigInt(logs[i + 1].blockNumber) : snapshotBn + 1n;
      const end = next - 1n;
      if (end < start) continue;
      epochs.push({
        owner,
        startBlock: `0x${start.toString(16)}`,
        endBlock: `0x${end.toString(16)}`,
        source: 'OwnershipTransferred.newOwnerWindow',
      });
    }
  }

  for (const epoch of epochs) {
    const checks = [
      { block: epoch.startBlock, label: 'start' },
      { block: epoch.endBlock, label: 'end' },
    ];
    for (const c of checks) {
      const code = rpcCall(rpcUrl, 'eth_getCode', [epoch.owner, c.block]);
      if (code && code !== '0x') {
        return {
          safe: false,
          reason:
            `Historical owner ${epoch.owner} had contract code at ${c.label} of ownership window ` +
            `[${BigInt(epoch.startBlock).toString()}..${BigInt(epoch.endBlock).toString()}] (${epoch.source}).`,
        };
      }
    }
  }

  return { safe: true, checkedOwners: epochs.length };
}

function getTxsViaHtmlScrape(rpcUrl, address, blockLimitHex) {
  const cutoff = BigInt(blockLimitHex);
  const txHashes = new Set();
  const maxPages = Number(process.env.HTML_TX_SCAN_MAX_PAGES || '200');
  if (!Number.isFinite(maxPages) || maxPages < 1) {
    throw new Error(`Invalid HTML_TX_SCAN_MAX_PAGES: ${process.env.HTML_TX_SCAN_MAX_PAGES}`);
  }

  let exhausted = false;
  for (let p = 1; p <= maxPages; p += 1) {
    const html = runCurl([`https://etherscan.io/txs?a=${address}&p=${p}`]);
    console.log(`Scanning Etherscan tx page ${p}...`);
    const matches = [...html.matchAll(/\/tx\/(0x[a-fA-F0-9]{64})/g)].map((m) => m[1]);
    if (matches.length === 0) {
      exhausted = true;
      break;
    }
    const before = txHashes.size;
    matches.forEach((h) => txHashes.add(h));
    if (txHashes.size === before) {
      exhausted = true;
      break;
    }
  }

  if (!exhausted) {
    throw new Error(
      `HTML tx scan hit cap (${maxPages} pages) before exhaustion; refusing partial reconstruction. ` +
      'Set ETHERSCAN_API_KEY or increase HTML_TX_SCAN_MAX_PAGES and retry.'
    );
  }

  const txs = [];
  let seen=0;
  for (const hash of txHashes) {
    seen += 1;
    if (seen % 25 === 0) console.log(`Hydrating tx ${seen}/${txHashes.size}...`);
    const tx = rpcCall(rpcUrl, 'eth_getTransactionByHash', [hash]);
    if (!tx || !tx.to) continue;
    if (tx.to.toLowerCase() !== address.toLowerCase()) continue;
    if (BigInt(tx.blockNumber) > cutoff) continue;
    const receipt = rpcCall(rpcUrl, 'eth_getTransactionReceipt', [hash]);
    if (!receipt || receipt.status !== '0x1') continue;
    txs.push({
      hash,
      input: tx.input,
      blockNumber: BigInt(tx.blockNumber),
      transactionIndex: BigInt(tx.transactionIndex),
    });
  }
  txs.sort(compareReplayOrder);
  return txs;
}

function getAgiTypeStateFromLogs(rpcUrl, address, abi, fromBlockHex, toBlockHex) {
  const eventAbi = abi.find((x) => x.type === 'event' && x.name === 'AGITypeUpdated');
  if (!eventAbi) throw new Error('AGITypeUpdated event missing in ABI; cannot deterministically reconstruct AGI types.');
  const topic0 = eventTopic(eventAbi);
  const logs = [];
  const start = BigInt(fromBlockHex);
  const end = BigInt(toBlockHex);
  const chunk = 50000n;
  for (let cur = start; cur <= end; cur += chunk) {
    const chunkTo = cur + chunk - 1n > end ? end : cur + chunk - 1n;
    const part = rpcCall(rpcUrl, 'eth_getLogs', [{ fromBlock: `0x${cur.toString(16)}`, toBlock: `0x${chunkTo.toString(16)}`, address, topics: [topic0] }]);
    logs.push(...part);
  }
  logs.sort((a, b) => {
    const bnA = BigInt(a.blockNumber); const bnB = BigInt(b.blockNumber);
    if (bnA !== bnB) return bnA < bnB ? -1 : 1;
    const txA = BigInt(a.transactionIndex); const txB = BigInt(b.transactionIndex);
    if (txA !== txB) return txA < txB ? -1 : 1;
    const lgA = BigInt(a.logIndex); const lgB = BigInt(b.logIndex);
    return lgA < lgB ? -1 : 1;
  });
  const map = new Map();
  const order = [];
  for (const l of logs) {
    const nft = hexToAddress(l.topics[1]);
    const payout = Abi.decodeParameter('uint256', l.data).toString();
    if (!map.has(nft)) order.push(nft);
    map.set(nft, {
      nftAddress: nft,
      payoutPercentage: payout,
      enabled: payout !== '0',
      source: { txHash: l.transactionHash, blockNumber: BigInt(l.blockNumber).toString(), logIndex: BigInt(l.logIndex).toString() },
    });
  }
  return order.map((nft) => map.get(nft));
}

function compareHint(label, actual, expected) {
  const same = String(actual).toLowerCase() === String(expected).toLowerCase();
  console.log(`- ${label}: ${actual} (${same ? 'matches hint' : `DIFFERS from hint ${expected}`})`);
}

async function main() {
  const rpcUrl = (process.env.MAINNET_RPC_URL || 'https://cloudflare-eth.com').trim();
  const etherscanKey = (process.env.ETHERSCAN_API_KEY || '').trim();
  const blockArg = arg('block', 'latest');

  const chainIdHex = rpcCall(rpcUrl, 'eth_chainId', []);
  if (hexToNumber(chainIdHex) !== 1) throw new Error(`Expected mainnet chainId=1, got ${chainIdHex}`);

  const latestHex = rpcCall(rpcUrl, 'eth_blockNumber', []);
  const snapshotBlockHex = blockArg === 'latest' ? latestHex : `0x${BigInt(blockArg).toString(16)}`;
  const block = rpcCall(rpcUrl, 'eth_getBlockByNumber', [snapshotBlockHex, false]);
  if (!block) throw new Error(`Block not found: ${snapshotBlockHex}`);

  let abi;
  let sourceMeta = { abiSource: 'etherscan-html-fallback' };
  try {
    const fetched = fetchAbiFromEtherscan(LEGACY_ADDRESS, etherscanKey);
    abi = fetched.abi;
    sourceMeta = { abiSource: 'etherscan-v2-api', ...fetched.sourceMeta };
  } catch (e) {
    console.warn(`Warning: ${e.message} Falling back to Etherscan HTML scrape for ABI.`);
    abi = fallbackFetchAbiFromHtml(LEGACY_ADDRESS);
  }

  const implSlot = rpcCall(rpcUrl, 'eth_getStorageAt', [LEGACY_ADDRESS, EIP1967_IMPLEMENTATION_SLOT, snapshotBlockHex]);
  const proxyImplementation = implSlot && implSlot !== ZERO32 ? toChecksumAddress(`0x${implSlot.slice(-40)}`) : null;

  const viewFns = abi.filter((x) => x.type === 'function' && x.inputs.length === 0 && x.stateMutability === 'view' && x.outputs && x.outputs.length === 1);
  const viewValues = {};
  for (const fn of viewFns) {
    try {
      viewValues[fn.name] = callViewAtBlock(rpcUrl, LEGACY_ADDRESS, fn, snapshotBlockHex);
    } catch (_) {
      // ignore non-callable view functions under this ABI
    }
  }


  const hasUseEnsGetter = abi.some((x) => x.type === 'function' && x.name === 'useEnsJobTokenURI' && x.inputs && x.inputs.length === 0);
  const hasUseEnsSetter = abi.some((x) => x.type === 'function' && x.name === 'setUseEnsJobTokenURI');
  const hasChallengePeriodGetter = abi.some((x) => x.type === 'function' && x.name === 'challengePeriodAfterApproval' && x.inputs && x.inputs.length === 0);

  const mutatorNames = ['addModerator', 'removeModerator', 'addAdditionalAgent', 'removeAdditionalAgent', 'addAdditionalValidator', 'removeAdditionalValidator', 'blacklistAgent', 'blacklistValidator', 'setBaseIpfsUrl', 'setUseEnsJobTokenURI'];
  const mutators = mutatorNames
    .map((name) => abi.find((x) => x.type === 'function' && x.name === name))
    .filter(Boolean);

  let txs;
  let txSource;
  if (etherscanKey) {
    const txResults = etherscanGet({ module: 'account', action: 'txlist', address: LEGACY_ADDRESS, startblock: '0', endblock: BigInt(snapshotBlockHex).toString(), sort: 'asc' }, etherscanKey);
    const internalResults = etherscanGet({ module: 'account', action: 'txlistinternal', address: LEGACY_ADDRESS, startblock: '0', endblock: BigInt(snapshotBlockHex).toString(), sort: 'asc' }, etherscanKey);

    const topLevelTxs = txResults
      .filter((tx) => tx.isError === '0')
      .map((tx) => ({
        hash: tx.hash,
        input: tx.input,
        blockNumber: BigInt(tx.blockNumber),
        transactionIndex: BigInt(tx.transactionIndex),
        traceOrder: [0n],
        traceId: null,
      }));

    const internalsToLegacy = internalResults
      .filter((tx) => String(tx.isError) === '0')
      .filter((tx) => (tx.to || '').toLowerCase() === LEGACY_ADDRESS.toLowerCase())
      .map((tx) => ({
        hash: tx.hash,
        input: tx.input || '0x',
        blockNumber: BigInt(tx.blockNumber),
        transactionIndex: BigInt(tx.transactionIndex || '0'),
        traceOrder: parseTraceId(tx.traceId),
        traceId: tx.traceId || null,
      }));

    const internalMissingInput = internalsToLegacy.filter((tx) => !tx.input || tx.input === '0x').length;
    if (internalMissingInput > 0) {
      throw new Error(
        `Found ${internalMissingInput} internal calls to legacy contract without calldata in txlistinternal; ` +
        'cannot deterministically reconstruct internal admin mutators from Etherscan API output.'
      );
    }

    const dedup = new Map();
    for (const tx of [...topLevelTxs, ...internalsToLegacy]) {
      const key = `${tx.hash}:${tx.traceId || 'top'}`;
      dedup.set(key, tx);
    }
    txs = [...dedup.values()].sort(compareReplayOrder);
    txSource = 'etherscan-v2-api+txlistinternal';
  } else {
    const ownerAddr = viewValues.owner ? toChecksumAddress(viewValues.owner) : null;
    if (!ownerAddr) {
      throw new Error('Cannot validate historical ownership safety without owner() view result. Set ETHERSCAN_API_KEY.');
    }
    const safety = historicalOwnershipSafety(rpcUrl, LEGACY_ADDRESS, snapshotBlockHex, ownerAddr);
    if (!safety.safe) {
      throw new Error(
        `ETHERSCAN_API_KEY is required when fallback cannot prove full internal-admin history. ${safety.reason}`
      );
    }
    txs = getTxsViaHtmlScrape(rpcUrl, LEGACY_ADDRESS, snapshotBlockHex);
    txSource = 'etherscan-html-scrape+rpc+ownership-validated';
  }

  const dynamic = parseMutatorTxs({ txs, mutators, blockLimit: BigInt(snapshotBlockHex) });
  const agiTypes = getAgiTypeStateFromLogs(rpcUrl, LEGACY_ADDRESS, abi, '0x0', snapshotBlockHex);

  const baseIpfsUrl = (dynamic.baseIpfsUrl ?? tryDeriveBaseFromTokenURI(rpcUrl, LEGACY_ADDRESS, snapshotBlockHex));
  if (!baseIpfsUrl) {
    throw new Error('Unable to derive baseIpfsUrl from setter replay or tokenURI introspection. Manual intervention required.');
  }

  const roots = {
    clubRootNode: viewValues.clubRootNode || ZERO32,
    agentRootNode: viewValues.agentRootNode || ZERO32,
    alphaClubRootNode: viewValues.alphaClubRootNode || namehash('alpha.club.agi.eth'),
    alphaAgentRootNode: viewValues.alphaAgentRootNode || namehash('alpha.agent.agi.eth'),
  };

  const snapshot = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    legacy: {
      address: LEGACY_ADDRESS,
      abiSource: sourceMeta.abiSource,
      txSource,
      proxyImplementation,
      sourceMeta,
    },
    snapshot: {
      chainId: '1',
      blockNumber: BigInt(block.number).toString(),
      blockTimestamp: BigInt(block.timestamp).toString(),
    },
    constructorConfig: {
      agiTokenAddress: viewValues.agiToken ? toChecksumAddress(viewValues.agiToken) : null,
      baseIpfsUrl,
      ensConfig: {
        ensRegistry: viewValues.ens ? toChecksumAddress(viewValues.ens) : null,
        nameWrapper: viewValues.nameWrapper ? toChecksumAddress(viewValues.nameWrapper) : null,
      },
      rootNodes: roots,
      merkleRoots: {
        validatorMerkleRoot: viewValues.validatorMerkleRoot || ZERO32,
        agentMerkleRoot: viewValues.agentMerkleRoot || ZERO32,
      },
      derived: {
        alphaClubRootNode: !viewValues.alphaClubRootNode ? { name: 'alpha.club.agi.eth', value: roots.alphaClubRootNode, derived: true } : null,
        alphaAgentRootNode: !viewValues.alphaAgentRootNode ? { name: 'alpha.agent.agi.eth', value: roots.alphaAgentRootNode, derived: true } : null,
      },
    },
    runtimeConfig: {
      owner: viewValues.owner ? toChecksumAddress(viewValues.owner) : null,
      paused: Boolean(viewValues.paused),
      settlementPaused: Boolean(viewValues.settlementPaused || false),
      lockIdentityConfig: Boolean(viewValues.lockIdentityConfig || false),
      ensJobPages: viewValues.ensJobPages ? toChecksumAddress(viewValues.ensJobPages) : '0x0000000000000000000000000000000000000000',
      useEnsJobTokenURI: (() => {
        if (hasUseEnsGetter && typeof viewValues.useEnsJobTokenURI !== 'undefined') return Boolean(viewValues.useEnsJobTokenURI);
        if (dynamic.useEnsJobTokenURI !== null) return Boolean(dynamic.useEnsJobTokenURI);
        if (!hasUseEnsGetter && !hasUseEnsSetter) return false;
        throw new Error('Unable to determine useEnsJobTokenURI: getter unavailable and no setUseEnsJobTokenURI replay evidence.');
      })(),
      useEnsJobTokenURISource: (() => {
        if (hasUseEnsGetter && typeof viewValues.useEnsJobTokenURI !== 'undefined') return 'getter';
        if (dynamic.useEnsJobTokenURI !== null) return 'tx-replay';
        if (!hasUseEnsGetter && !hasUseEnsSetter) return 'legacy-feature-unavailable';
        return 'unknown';
      })(),
      requiredValidatorApprovals: viewValues.requiredValidatorApprovals || '0',
      requiredValidatorDisapprovals: viewValues.requiredValidatorDisapprovals || '0',
      voteQuorum: viewValues.voteQuorum || viewValues.requiredValidatorApprovals || '0',
      premiumReputationThreshold: viewValues.premiumReputationThreshold || '0',
      validationRewardPercentage: viewValues.validationRewardPercentage || '0',
      maxJobPayout: viewValues.maxJobPayout || '0',
      jobDurationLimit: viewValues.jobDurationLimit || '0',
      completionReviewPeriod: viewValues.completionReviewPeriod || '604800',
      disputeReviewPeriod: viewValues.disputeReviewPeriod || '1209600',
      validatorBondBps: viewValues.validatorBondBps || '0',
      validatorBondMin: viewValues.validatorBondMin || '0',
      validatorBondMax: viewValues.validatorBondMax || '0',
      agentBondBps: viewValues.agentBondBps || '0',
      agentBondMin: viewValues.agentBondMin || viewValues.agentBond || '0',
      agentBondMax: viewValues.agentBondMax || '0',
      validatorSlashBps: viewValues.validatorSlashBps || '0',
      challengePeriodAfterApproval: hasChallengePeriodGetter && typeof viewValues.challengePeriodAfterApproval !== 'undefined'
        ? String(viewValues.challengePeriodAfterApproval)
        : '0',
      challengePeriodAfterApprovalSource: hasChallengePeriodGetter ? 'getter' : 'legacy-feature-unavailable',
    },
    dynamicSets: {
      moderators: [...dynamic.moderators.entries()].filter(([, v]) => v).map(([address]) => address),
      additionalAgents: [...dynamic.additionalAgents.entries()].filter(([, v]) => v).map(([address]) => address),
      additionalValidators: [...dynamic.additionalValidators.entries()].filter(([, v]) => v).map(([address]) => address),
      blacklistedAgents: [...dynamic.blacklistedAgents.entries()].filter(([, v]) => v).map(([address]) => address),
      blacklistedValidators: [...dynamic.blacklistedValidators.entries()].filter(([, v]) => v).map(([address]) => address),
      provenance: dynamic.provenance,
    },
    agiTypes,
  };

  const requiredAddresses = [snapshot.constructorConfig.agiTokenAddress, snapshot.constructorConfig.ensConfig.ensRegistry, snapshot.constructorConfig.ensConfig.nameWrapper, snapshot.runtimeConfig.owner];
  if (requiredAddresses.some((a) => !a || !isAddress(a))) {
    throw new Error('Missing required address fields (agiToken/ens/nameWrapper/owner). Unable to safely generate snapshot.');
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);

  console.log(`Snapshot written: ${OUTPUT_PATH}`);
  console.log(`- chainId: ${snapshot.snapshot.chainId}`);
  console.log(`- blockNumber: ${snapshot.snapshot.blockNumber}`);
  console.log(`- blockTimestamp: ${snapshot.snapshot.blockTimestamp}`);
  console.log(`- owner: ${snapshot.runtimeConfig.owner}`);
  console.log(`- agiToken: ${snapshot.constructorConfig.agiTokenAddress}`);
  console.log(`- ens: ${snapshot.constructorConfig.ensConfig.ensRegistry}`);
  console.log(`- nameWrapper: ${snapshot.constructorConfig.ensConfig.nameWrapper}`);
  console.log(`- clubRootNode: ${snapshot.constructorConfig.rootNodes.clubRootNode}`);
  console.log(`- agentRootNode: ${snapshot.constructorConfig.rootNodes.agentRootNode}`);
  console.log(`- alphaClubRootNode: ${snapshot.constructorConfig.rootNodes.alphaClubRootNode}`);
  console.log(`- alphaAgentRootNode: ${snapshot.constructorConfig.rootNodes.alphaAgentRootNode}`);
  console.log(`- validatorMerkleRoot: ${snapshot.constructorConfig.merkleRoots.validatorMerkleRoot}`);
  console.log(`- agentMerkleRoot: ${snapshot.constructorConfig.merkleRoots.agentMerkleRoot}`);
  console.log(`- moderators: ${snapshot.dynamicSets.moderators.length}`);
  console.log(`- additionalAgents: ${snapshot.dynamicSets.additionalAgents.length}`);
  console.log(`- additionalValidators: ${snapshot.dynamicSets.additionalValidators.length}`);
  console.log(`- blacklistedAgents: ${snapshot.dynamicSets.blacklistedAgents.length}`);
  console.log(`- blacklistedValidators: ${snapshot.dynamicSets.blacklistedValidators.length}`);
  console.log(`- agiTypes: ${snapshot.agiTypes.length}`);

  console.log('Hint comparison:');
  compareHint('AGI token', snapshot.constructorConfig.agiTokenAddress, '0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa');
  compareHint('baseIpfsUrl', snapshot.constructorConfig.baseIpfsUrl, 'https://ipfs.io/ipfs/');
  compareHint('ENS registry', snapshot.constructorConfig.ensConfig.ensRegistry, '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e');
  compareHint('NameWrapper', snapshot.constructorConfig.ensConfig.nameWrapper, '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401');
  compareHint('club.agi.eth root', snapshot.constructorConfig.rootNodes.clubRootNode, '0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16');
  compareHint('agent.agi.eth root', snapshot.constructorConfig.rootNodes.agentRootNode, '0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d');
  compareHint('alpha.club.agi.eth root', snapshot.constructorConfig.rootNodes.alphaClubRootNode, '0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e');
  compareHint('alpha.agent.agi.eth root', snapshot.constructorConfig.rootNodes.alphaAgentRootNode, '0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e');
  compareHint('validator merkle root', snapshot.constructorConfig.merkleRoots.validatorMerkleRoot, '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b');
  compareHint('agent merkle root', snapshot.constructorConfig.merkleRoots.agentMerkleRoot, '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b');
}

main().catch((e) => {
  console.error(`Snapshot failed: ${e.message}`);
  process.exit(1);
});
