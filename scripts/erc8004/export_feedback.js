/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ARG_PREFIX = '--';

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
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.tag1.localeCompare(b.tag1);
  });
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
  const identityRegistry = overrides.identityRegistry
    || process.env.ERC8004_IDENTITY_REGISTRY
    || getArgValue('identity-registry');
  const singleAgentId = overrides.agentId
    || process.env.ERC8004_AGENT_ID
    || getArgValue('agent-id');
  const agentIdMapPath = overrides.agentIdMapPath
    || process.env.ERC8004_AGENT_ID_MAP
    || getArgValue('agent-id-map');
  const clientAddress = overrides.clientAddress
    || process.env.ERC8004_CLIENT_ADDRESS
    || getArgValue('client-address');

  if (!identityRegistry) {
    throw new Error('Missing ERC8004_IDENTITY_REGISTRY (see 8004.org/build for latest addresses).');
  }

  const { runExportMetrics } = require('./export_metrics');
  const metricsResult = await runExportMetrics(overrides);
  const metrics = metricsResult.output;
  const resolvedChainId = chainIdOverrideRaw ? Number(chainIdOverrideRaw) : metrics.metadata.chainId;
  if (!Number.isFinite(resolvedChainId)) {
    throw new Error('Missing chainId. Provide CHAIN_ID or ensure web3 is connected.');
  }

  const agentRegistry = `${namespace}:${resolvedChainId}:${identityRegistry}`;
  const now = new Date().toISOString();

  const latestBlock = metrics.metadata.toBlock;
  const blockTimestampCache = new Map();
  const getBlockTimestamp = async (blockNumber) => {
    if (blockTimestampCache.has(blockNumber)) return blockTimestampCache.get(blockNumber);
    const block = await web3.eth.getBlock(blockNumber);
    const timestamp = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
    blockTimestampCache.set(blockNumber, timestamp);
    return timestamp;
  };

  const agentAddresses = Object.keys(metrics.agents || {});
  const { mapping: agentIdMap, unresolved: unresolvedAgents } = mapAgentIds({
    addresses: agentAddresses,
    mapPath: agentIdMapPath,
    singleAgentId,
  });

  const validatorAddresses = includeValidators ? Object.keys(metrics.validators || {}) : [];
  const { mapping: validatorIdMap, unresolved: unresolvedValidators } = mapAgentIds({
    addresses: validatorAddresses,
    mapPath: agentIdMapPath,
    singleAgentId,
  });

  const outputDir = path.join(outDir, 'reputation');
  ensureDir(outputDir);

  const generated = [];
  const unresolved = [];

  const buildFeedback = async (address, metricsEntry) => {
    const addressKey = normalizeAddress(address);
    const lastActivity = metricsEntry.lastActivityBlock ?? latestBlock;
    const timestamp = await getBlockTimestamp(lastActivity);
    const feedback = [];

    if (metricsEntry.rates?.successRate) {
      feedback.push({
        clientAddress: clientAddress || metrics.metadata.contractAddress,
        tag1: 'successRate',
        tag2: null,
        value: metricsEntry.rates.successRate.value,
        valueDecimals: metricsEntry.rates.successRate.valueDecimals,
        reason: 'Completed jobs / assigned jobs',
        timestamp,
      });
    }

    if (metricsEntry.rates?.disputeRate) {
      feedback.push({
        clientAddress: clientAddress || metrics.metadata.contractAddress,
        tag1: 'disputeRate',
        tag2: null,
        value: metricsEntry.rates.disputeRate.value,
        valueDecimals: metricsEntry.rates.disputeRate.valueDecimals,
        reason: 'Disputed jobs / assigned jobs',
        timestamp,
      });
    }

    if (metricsEntry.responseTimeBlocksAvg !== null && metricsEntry.responseTimeBlocksAvg !== undefined) {
      feedback.push({
        clientAddress: clientAddress || metrics.metadata.contractAddress,
        tag1: 'responseTime',
        tag2: 'blocks',
        value: metricsEntry.responseTimeBlocksAvg,
        valueDecimals: 0,
        reason: 'Average block delta from assignment to completion request (fallback: completion)',
        timestamp,
      });
    }

    if (metricsEntry.lastActivityBlock !== null && metricsEntry.lastActivityBlock !== undefined) {
      feedback.push({
        clientAddress: clientAddress || metrics.metadata.contractAddress,
        tag1: 'blocktimeFreshness',
        tag2: 'blocks',
        value: Math.max(0, latestBlock - metricsEntry.lastActivityBlock),
        valueDecimals: 0,
        reason: 'Current block minus last activity block',
        timestamp,
      });
    }

    if (metricsEntry.revenuesProxy) {
      feedback.push({
        clientAddress: clientAddress || metrics.metadata.contractAddress,
        tag1: 'revenues',
        tag2: null,
        value: metricsEntry.revenuesProxy,
        valueDecimals: 0,
        reason: 'Proxy: sum of job payout values for completed jobs (raw token units).',
        timestamp,
      });
    }

    return sortFeedback(feedback);
  };

  for (const address of agentAddresses.sort()) {
    const agentId = agentIdMap.get(normalizeAddress(address));
    const metricsEntry = metrics.agents[address];
    if (!agentId) {
      unresolved.push({ address, subject: 'agent', metrics: metricsEntry });
      continue;
    }
    const feedback = await buildFeedback(address, metricsEntry);
    const file = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#reputation-v1',
      agentRegistry,
      agentId,
      feedback,
    };
    const fileName = `agent_${agentId}.json`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2));
    generated.push({ subject: 'agent', address, agentId, file: fileName });
  }

  if (includeValidators) {
    for (const address of validatorAddresses.sort()) {
      const agentId = validatorIdMap.get(normalizeAddress(address));
      const metricsEntry = metrics.validators[address];
      if (!agentId) {
        unresolved.push({ address, subject: 'validator', metrics: metricsEntry });
        continue;
      }
      const feedback = await buildFeedback(address, metricsEntry);
      const file = {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#reputation-v1',
        agentRegistry,
        agentId,
        feedback,
      };
      const fileName = `validator_${agentId}.json`;
      const filePath = path.join(outputDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(file, null, 2));
      generated.push({ subject: 'validator', address, agentId, file: fileName });
    }
  }

  if (unresolved.length > 0) {
    const unresolvedPath = path.join(outDir, 'erc8004_unresolved_wallets.json');
    fs.writeFileSync(unresolvedPath, JSON.stringify({
      generatedAt: now,
      agentRegistry,
      unresolved,
      note: 'Provide ERC8004_AGENT_ID_MAP with wallet->agentId mappings to emit reputation-v1 files.',
    }, null, 2));
  }

  const summary = {
    generatedAt: now,
    agentRegistry,
    source: metrics.metadata,
    includeValidators,
    generated,
    unresolvedCount: unresolved.length,
  };
  const summaryPath = path.join(outDir, 'export_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`ERC-8004 feedback exported to ${outputDir}`);
  if (unresolved.length > 0) {
    console.log(`Unresolved wallet mappings written to ${path.join(outDir, 'erc8004_unresolved_wallets.json')}`);
  }
  return { outputDir, summaryPath };
}

module.exports = function (callback) {
  runExportFeedback()
    .then(() => callback())
    .catch((err) => callback(err));
};

module.exports.runExportFeedback = runExportFeedback;
