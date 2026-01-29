/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ARG_PREFIX = '--';

const MAINNET_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const MAINNET_REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';

function getArgValue(name) {
  const idx = process.argv.indexOf(`${ARG_PREFIX}${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function parseBoolean(value, fallback = false) {
  if (value === null || value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
}

function normalizeAddress(address) {
  return address ? address.toLowerCase() : address;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sortFeedback(entries) {
  return entries.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    const tag1Compare = (a.tag1 || '').localeCompare(b.tag1 || '');
    if (tag1Compare !== 0) return tag1Compare;
    return (a.tag2 || '').localeCompare(b.tag2 || '');
  });
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64) || 'entry';
}

function toCaipAddress({ namespace, chainId, address }) {
  return `${namespace}:${chainId}:${address}`;
}

function getIdentityRegistryContract(address) {
  const abiPath = path.join(__dirname, '../../integrations/erc8004/abis/IdentityRegistry.json');
  const abi = readJson(abiPath);
  return new web3.eth.Contract(abi, address);
}

function mapAgentIds({ addresses, mapPath, singleAgentId }) {
  const mapping = new Map();
  if (mapPath) {
    const raw = readJson(mapPath);
    for (const [address, agentId] of Object.entries(raw)) {
      mapping.set(normalizeAddress(address), agentId);
    }
  }

  const unresolved = new Set();
  for (const address of addresses) {
    const normalized = normalizeAddress(address);
    if (mapping.has(normalized)) continue;
    if (singleAgentId && addresses.length === 1) {
      mapping.set(normalized, singleAgentId);
      continue;
    }
    unresolved.add(normalized);
  }

  return { mapping, unresolved };
}

async function resolveWithIdentityRegistry({ identityRegistry, namespace, chainId, mapping, unresolved }) {
  if (!identityRegistry || unresolved.size === 0) return { mapping, unresolved };
  const contract = getIdentityRegistryContract(identityRegistry);
  const lookupMethods = [
    'getAgentIdByWallet',
    'agentIdByWallet',
    'getAgentIdForWallet',
    'agentIdForWallet',
  ];
  const methodName = lookupMethods.find((name) => contract.methods[name]);
  if (!methodName) return { mapping, unresolved };

  const remaining = new Set(unresolved);
  for (const address of unresolved.values()) {
    try {
      const agentId = await contract.methods[methodName](address).call();
      if (agentId && Number(agentId) !== 0) {
        mapping.set(normalizeAddress(address), agentId);
        remaining.delete(address);
      }
    } catch (error) {
      // Ignore lookup failures; keep unresolved entry.
    }
  }
  return { mapping, unresolved: remaining };
}

async function runExportFeedback(overrides = {}) {
  const outDir = overrides.outDir
    || process.env.OUT_DIR
    || getArgValue('out-dir')
    || path.join(__dirname, '../../integrations/erc8004/out');
  const includeValidators = overrides.includeValidators
    ?? parseBoolean(process.env.INCLUDE_VALIDATORS || getArgValue('include-validators'), false);
  const namespace = overrides.namespace
    || process.env.NAMESPACE
    || getArgValue('namespace')
    || 'eip155';
  const chainIdOverrideRaw = overrides.chainId
    ?? process.env.CHAIN_ID
    ?? getArgValue('chain-id');
  const identityRegistryInput = overrides.identityRegistry
    || process.env.ERC8004_IDENTITY_REGISTRY
    || getArgValue('identity-registry');
  const reputationRegistryInput = overrides.reputationRegistry
    || process.env.ERC8004_REPUTATION_REGISTRY
    || getArgValue('reputation-registry');
  const singleAgentId = overrides.agentId
    || process.env.ERC8004_AGENT_ID
    || getArgValue('agent-id');
  const agentIdMapPath = overrides.agentIdMapPath
    || process.env.ERC8004_AGENT_ID_MAP
    || getArgValue('agent-id-map');
  const clientAddressOverride = overrides.clientAddress
    || process.env.ERC8004_CLIENT_ADDRESS
    || getArgValue('client-address');

  const { runExportMetrics } = require('./export_metrics');
  const metricsResult = await runExportMetrics(overrides);
  const metrics = metricsResult.output;
  const resolvedChainId = chainIdOverrideRaw ? Number(chainIdOverrideRaw) : metrics.metadata.chainId;
  if (!Number.isFinite(resolvedChainId)) {
    throw new Error('Missing chainId. Provide CHAIN_ID or ensure web3 is connected.');
  }

  const identityRegistry = identityRegistryInput
    || (resolvedChainId === 1 ? MAINNET_IDENTITY_REGISTRY : null);
  const reputationRegistry = reputationRegistryInput
    || (resolvedChainId === 1 ? MAINNET_REPUTATION_REGISTRY : null);

  if (!identityRegistry) {
    throw new Error('Missing ERC8004_IDENTITY_REGISTRY (required for agentRegistry).');
  }
  if (!reputationRegistry) {
    throw new Error('Missing ERC8004_REPUTATION_REGISTRY.');
  }

  const agentRegistry = `${namespace}:${resolvedChainId}:${identityRegistry}`;
  const now = new Date().toISOString();

  const latestBlock = metrics.metadata.toBlock;
  const blockTimestampCache = new Map();
  const getBlockTimestampIso = async (blockNumber) => {
    if (blockTimestampCache.has(blockNumber)) return blockTimestampCache.get(blockNumber);
    const block = await web3.eth.getBlock(blockNumber);
    const timestamp = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
    const iso = new Date(timestamp * 1000).toISOString();
    blockTimestampCache.set(blockNumber, iso);
    return iso;
  };

  const agentAddresses = Object.keys(metrics.agents || {});
  let { mapping: agentIdMap, unresolved: unresolvedAgents } = mapAgentIds({
    addresses: agentAddresses,
    mapPath: agentIdMapPath,
    singleAgentId,
  });
  ({ mapping: agentIdMap, unresolved: unresolvedAgents } = await resolveWithIdentityRegistry({
    identityRegistry,
    namespace,
    chainId: resolvedChainId,
    mapping: agentIdMap,
    unresolved: unresolvedAgents,
  }));

  const validatorAddresses = includeValidators ? Object.keys(metrics.validators || {}) : [];
  let { mapping: validatorIdMap, unresolved: unresolvedValidators } = mapAgentIds({
    addresses: validatorAddresses,
    mapPath: agentIdMapPath,
    singleAgentId,
  });
  ({ mapping: validatorIdMap, unresolved: unresolvedValidators } = await resolveWithIdentityRegistry({
    identityRegistry,
    namespace,
    chainId: resolvedChainId,
    mapping: validatorIdMap,
    unresolved: unresolvedValidators,
  }));

  const outputDir = path.join(outDir, 'feedback');
  ensureDir(outputDir);

  const generated = [];
  const unresolved = [];
  const unresolvedDetails = [];

  const buildFeedback = async (address, metricsEntry, subject) => {
    const addressKey = normalizeAddress(address);
    const lastActivity = metricsEntry.lastActivityBlock ?? latestBlock;
    const createdAt = await getBlockTimestampIso(lastActivity);
    const clientAddress = clientAddressOverride || metrics.metadata.contractAddress;
    const clientAddressValue = clientAddress.includes(':')
      ? clientAddress
      : toCaipAddress({
        namespace,
        chainId: resolvedChainId,
        address: normalizeAddress(clientAddress),
      });
    const base = {
      agentRegistry,
      agentId: null,
      clientAddress: clientAddressValue,
      createdAt,
    };

    const feedback = [];

    if (metricsEntry.rates?.successRate) {
      feedback.push({
        ...base,
        tag1: 'successRate',
        tag2: null,
        value: metricsEntry.rates.successRate.value,
        valueDecimals: metricsEntry.rates.successRate.valueDecimals,
        comment: 'Completed jobs / assigned jobs (percent).',
      });
    }

    if (metricsEntry.rates?.disputeRate) {
      feedback.push({
        ...base,
        tag1: 'disputeRate',
        tag2: null,
        value: metricsEntry.rates.disputeRate.value,
        valueDecimals: metricsEntry.rates.disputeRate.valueDecimals,
        comment: 'Disputed jobs / assigned jobs (percent).',
      });
    }

    if (metricsEntry.grossEscrow && metricsEntry.grossEscrow !== '0') {
      feedback.push({
        ...base,
        tag1: 'grossEscrow',
        tag2: null,
        value: metricsEntry.grossEscrow,
        valueDecimals: 0,
        comment: 'Sum of job payout escrowed for completed jobs (raw token units).',
      });
    }

    if (metricsEntry.netAgentPaidProxy && metricsEntry.netAgentPaidProxy !== '0') {
      feedback.push({
        ...base,
        tag1: 'netAgentPaidProxy',
        tag2: null,
        value: metricsEntry.netAgentPaidProxy,
        valueDecimals: 0,
        comment: 'Proxy: grossEscrow * current agent payout percentage / 100.',
      });
    }

    if (metricsEntry.lastActivityBlock !== null && metricsEntry.lastActivityBlock !== undefined) {
      feedback.push({
        ...base,
        tag1: 'blocktimeFreshness',
        tag2: 'blocks',
        value: Math.max(0, latestBlock - metricsEntry.lastActivityBlock),
        valueDecimals: 0,
        comment: 'Current block minus last activity block.',
      });
    }

    if (subject === 'validator' && metricsEntry.rates?.approvalRate) {
      feedback.push({
        ...base,
        tag1: 'approvalRate',
        tag2: null,
        value: metricsEntry.rates.approvalRate.value,
        valueDecimals: metricsEntry.rates.approvalRate.valueDecimals,
        comment: 'Approvals / (approvals + disapprovals) (percent).',
      });
    }

    if (subject === 'validator' && metricsEntry.approvalsCount !== undefined) {
      feedback.push({
        ...base,
        tag1: 'approvalsCount',
        tag2: null,
        value: metricsEntry.approvalsCount,
        valueDecimals: 0,
        comment: 'Total approvals observed in range.',
      });
    }

    if (subject === 'validator' && metricsEntry.disapprovalsCount !== undefined) {
      feedback.push({
        ...base,
        tag1: 'disapprovalsCount',
        tag2: null,
        value: metricsEntry.disapprovalsCount,
        valueDecimals: 0,
        comment: 'Total disapprovals observed in range.',
      });
    }

    return sortFeedback(feedback);
  };

  const writeFeedbackFiles = async (subject, addresses, map, metricsEntries) => {
    for (const address of addresses.sort()) {
      const agentId = map.get(normalizeAddress(address));
      const metricsEntry = metricsEntries[address];
      if (!agentId) {
        unresolved.push({ address, subject, metrics: metricsEntry });
        continue;
      }
      const feedback = await buildFeedback(address, metricsEntry, subject);
      if (feedback.length === 0) continue;
      feedback.forEach((entry) => {
        entry.agentId = agentId;
      });

      feedback.forEach((entry, index) => {
        const tagSlug = slugify(entry.tag1 || 'signal');
        const tag2Slug = entry.tag2 ? `_${slugify(entry.tag2)}` : '';
        const fileName = `${subject}_${agentId}_${tagSlug}${tag2Slug}_${index + 1}.json`;
        const filePath = path.join(outputDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(entry, null, 2));
        generated.push({ subject, address, agentId, file: fileName, tag1: entry.tag1, tag2: entry.tag2 });
      });
    }
  };

  await writeFeedbackFiles('agent', agentAddresses, agentIdMap, metrics.agents || {});

  if (includeValidators) {
    await writeFeedbackFiles('validator', validatorAddresses, validatorIdMap, metrics.validators || {});
  }

  if (unresolvedAgents.size > 0 || unresolvedValidators.size > 0) {
    if (unresolvedAgents.size > 0) {
      for (const address of unresolvedAgents.values()) {
        unresolvedDetails.push({ address, subject: 'agent' });
      }
    }
    if (unresolvedValidators.size > 0) {
      for (const address of unresolvedValidators.values()) {
        unresolvedDetails.push({ address, subject: 'validator' });
      }
    }
  }

  if (unresolved.length > 0) {
    const unresolvedPath = path.join(outDir, 'erc8004_unresolved_wallets.json');
    fs.writeFileSync(unresolvedPath, JSON.stringify({
      generatedAt: now,
      agentRegistry,
      unresolved,
      note: 'Provide ERC8004_AGENT_ID_MAP with wallet->agentId mappings to emit feedback files.',
    }, null, 2));
  }

  const summary = {
    chainId: resolvedChainId,
    network: metrics.metadata.network,
    blockRange: {
      from: metrics.metadata.fromBlock,
      to: metrics.metadata.toBlock,
    },
    generatedAt: now,
    sourceContract: metrics.metadata.contractAddress,
    identityRegistry,
    reputationRegistry,
    includeValidators,
    outputDir,
    generatedCount: generated.length,
    unresolvedCount: unresolved.length,
    assumptions: [
      'AgentId resolution requires an explicit wallet->agentId mapping unless the identity registry exposes a wallet lookup function.',
      'netAgentPaidProxy uses the current getHighestPayoutPercentage value at export time, not historical payout percentages.',
      'Gross escrow is derived from job.payout values on JobCompleted events (raw token units).',
    ],
  };
  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`ERC-8004 feedback exported to ${outputDir}`);
  if (unresolved.length > 0) {
    console.log(`Unresolved wallet mappings written to ${path.join(outDir, 'erc8004_unresolved_wallets.json')}`);
  }
  return { outputDir, summaryPath, generated, unresolved: unresolvedDetails };
}

module.exports = function (callback) {
  runExportFeedback()
    .then(() => callback())
    .catch((err) => callback(err));
};

module.exports.runExportFeedback = runExportFeedback;
