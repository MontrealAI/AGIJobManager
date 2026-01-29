/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const AGIJobManager = artifacts.require('AGIJobManager');

const ARG_PREFIX = '--';
const DEFAULT_BATCH_SIZE = 2000;

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

function toNumber(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function toBN(value) {
  return web3.utils.toBN(value);
}

function formatRate(numerator, denominator) {
  if (!denominator || denominator.isZero()) return null;
  const scale = toBN(10000);
  const scaled = numerator.mul(scale);
  const rounded = scaled.add(denominator.div(toBN(2))).div(denominator);
  return {
    value: rounded.toNumber(),
    valueDecimals: 2,
  };
}

function safeValue(value) {
  const asString = value.toString();
  const asNumber = Number(asString);
  if (Number.isSafeInteger(asNumber)) return asNumber;
  return asString;
}

async function fetchEvents(contract, eventName, fromBlock, toBlock, batchSize) {
  const events = [];
  for (let start = fromBlock; start <= toBlock; start += batchSize) {
    const end = Math.min(toBlock, start + batchSize - 1);
    // eslint-disable-next-line no-await-in-loop
    const batch = await contract.getPastEvents(eventName, { fromBlock: start, toBlock: end });
    events.push(...batch);
  }
  return events.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return (a.logIndex || 0) - (b.logIndex || 0);
  });
}

async function getDeploymentBlock(contract) {
  const txHash = contract.transactionHash || contract.receipt?.transactionHash;
  if (!txHash) return 0;
  const receipt = await web3.eth.getTransactionReceipt(txHash);
  return receipt?.blockNumber ?? 0;
}

function addAnchor(anchorMap, addressKey, anchor) {
  const key = normalizeAddress(addressKey);
  if (!key) return;
  if (!anchorMap.has(key)) anchorMap.set(key, new Map());
  const anchors = anchorMap.get(key);
  const anchorKey = `${anchor.txHash}-${anchor.logIndex}`;
  if (!anchors.has(anchorKey)) {
    anchors.set(anchorKey, anchor);
  }
}

function buildAnchor(ev, jobId, chainId, contractAddress) {
  return {
    txHash: ev.transactionHash,
    logIndex: ev.logIndex,
    blockNumber: ev.blockNumber,
    event: ev.event,
    jobId: jobId !== undefined && jobId !== null ? String(jobId) : null,
    chainId,
    contractAddress,
  };
}

function anchorsToList(anchorMap) {
  if (!anchorMap) return [];
  const anchors = Array.from(anchorMap.values());
  anchors.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return (a.logIndex || 0) - (b.logIndex || 0);
  });
  return anchors;
}

function mergeAnchorMaps(anchorMaps) {
  const merged = new Map();
  for (const map of anchorMaps) {
    if (!map) continue;
    for (const [key, anchor] of map.entries()) {
      if (!merged.has(key)) {
        merged.set(key, anchor);
      }
    }
  }
  return merged;
}

function sortObjectByKeys(entries) {
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function parseAgentIdMap(mapPath) {
  if (!mapPath) return null;
  const raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  if (!raw || typeof raw !== 'object') return null;
  const normalized = {};
  for (const [address, agentId] of Object.entries(raw)) {
    normalized[normalizeAddress(address)] = agentId;
  }
  return normalized;
}

async function runExportFeedback(overrides = {}) {
  const address = overrides.address || process.env.AGIJOBMANAGER_ADDRESS || getArgValue('address');
  const fromBlockRaw = overrides.fromBlock ?? process.env.FROM_BLOCK ?? getArgValue('from-block');
  const toBlockRaw = overrides.toBlock ?? process.env.TO_BLOCK ?? getArgValue('to-block');
  const outDir = overrides.outDir
    || process.env.OUT_DIR
    || getArgValue('out-dir')
    || path.join(__dirname, '../../integrations/erc8004/out');
  const includeValidators = overrides.includeValidators
    ?? parseBoolean(process.env.INCLUDE_VALIDATORS || getArgValue('include-validators'), false);
  const batchSizeRaw = overrides.batchSize
    ?? process.env.EVENT_BATCH_SIZE
    ?? getArgValue('event-batch-size');
  const namespace = overrides.namespace || process.env.NAMESPACE || getArgValue('namespace') || 'eip155';
  const chainIdOverride = overrides.chainId || process.env.CHAIN_ID || getArgValue('chain-id');
  const identityRegistry = overrides.identityRegistry
    || process.env.ERC8004_IDENTITY_REGISTRY
    || getArgValue('identity-registry');
  const agentIdOverride = overrides.agentId || process.env.ERC8004_AGENT_ID || getArgValue('agent-id');
  const agentAddressOverride = overrides.agentAddress || process.env.AGENT_ADDRESS || getArgValue('agent-address');
  const agentIdMapPath = overrides.agentIdMapPath
    || process.env.ERC8004_AGENT_ID_MAP
    || getArgValue('agent-id-map');

  if (!identityRegistry) {
    throw new Error('Missing ERC8004_IDENTITY_REGISTRY (set the identity registry address from 8004.org/build).');
  }

  const parsedBatchSize = Number(batchSizeRaw);
  const batchSize = Number.isFinite(parsedBatchSize) && parsedBatchSize > 0
    ? parsedBatchSize
    : DEFAULT_BATCH_SIZE;

  const contract = address ? await AGIJobManager.at(address) : await AGIJobManager.deployed();

  const latestBlock = await web3.eth.getBlockNumber();
  const deploymentBlock = await getDeploymentBlock(contract);

  const resolvedFromBlock = fromBlockRaw === undefined || fromBlockRaw === null
    ? deploymentBlock
    : (String(fromBlockRaw) === 'latest' ? latestBlock : toNumber(fromBlockRaw));
  const resolvedToBlock = toBlockRaw === undefined || toBlockRaw === null
    ? latestBlock
    : (String(toBlockRaw) === 'latest' ? latestBlock : toNumber(toBlockRaw));

  if (!Number.isFinite(resolvedFromBlock) || !Number.isFinite(resolvedToBlock)) {
    throw new Error('Invalid block range. FROM_BLOCK/TO_BLOCK must be numbers or "latest".');
  }
  const fromBlock = Math.max(0, resolvedFromBlock);
  const toBlock = Math.max(fromBlock, resolvedToBlock);

  const [
    jobCreated,
    jobApplied,
    jobCompletionRequested,
    jobCompleted,
    jobDisputed,
    disputeResolved,
  ] = await Promise.all([
    fetchEvents(contract, 'JobCreated', fromBlock, toBlock, batchSize),
    fetchEvents(contract, 'JobApplied', fromBlock, toBlock, batchSize),
    fetchEvents(contract, 'JobCompletionRequested', fromBlock, toBlock, batchSize),
    fetchEvents(contract, 'JobCompleted', fromBlock, toBlock, batchSize),
    fetchEvents(contract, 'JobDisputed', fromBlock, toBlock, batchSize),
    fetchEvents(contract, 'DisputeResolved', fromBlock, toBlock, batchSize),
  ]);

  let jobValidated = [];
  let jobDisapproved = [];
  let reputationUpdated = [];
  if (includeValidators) {
    [jobValidated, jobDisapproved, reputationUpdated] = await Promise.all([
      fetchEvents(contract, 'JobValidated', fromBlock, toBlock, batchSize),
      fetchEvents(contract, 'JobDisapproved', fromBlock, toBlock, batchSize),
      fetchEvents(contract, 'ReputationUpdated', fromBlock, toBlock, batchSize),
    ]);
  }

  const chainId = chainIdOverride ? Number(chainIdOverride) : await web3.eth.getChainId();
  const contractAddress = contract.address;
  const jobCache = new Map();
  const jobTiming = new Map();
  const agents = new Map();
  const validators = new Map();
  const employerSet = new Set();
  const agentAnchors = new Map();
  const validatorAnchors = new Map();
  const employerAnchors = new Map();
  const validatorAddressSet = new Set();
  const blockCache = new Map();

  const getAgent = (addressKey) => {
    const key = normalizeAddress(addressKey);
    if (!agents.has(key)) {
      agents.set(key, {
        assignedCount: 0,
        completedCount: 0,
        completionRequestedCount: 0,
        disputedCount: 0,
        agentWinCount: 0,
        employerWinCount: 0,
        unknownResolutionCount: 0,
        revenuesProxy: toBN(0),
        responseTimeSum: toBN(0),
        responseTimeCount: 0,
        lastActivityBlock: null,
        lastActivityTimestamp: null,
        rates: {},
        revenueAnchor: null,
      });
    }
    return agents.get(key);
  };

  const getValidator = (addressKey) => {
    const key = normalizeAddress(addressKey);
    if (!validators.has(key)) {
      validators.set(key, {
        validationsCount: 0,
        disapprovalsCount: 0,
        disputesTriggered: 0,
        reputationUpdates: 0,
        reputationGain: toBN(0),
        latestReputation: null,
        lastActivityBlock: null,
        lastActivityTimestamp: null,
        rates: {},
      });
    }
    return validators.get(key);
  };

  const getJob = async (jobId) => {
    const idKey = String(jobId);
    if (jobCache.has(idKey)) return jobCache.get(idKey);
    const job = await contract.jobs(jobId);
    const normalized = {
      employer: normalizeAddress(job.employer),
      assignedAgent: normalizeAddress(job.assignedAgent),
      payout: toBN(job.payout),
    };
    jobCache.set(idKey, normalized);
    return normalized;
  };

  const getBlockTimestamp = async (blockNumber) => {
    if (blockCache.has(blockNumber)) return blockCache.get(blockNumber);
    const block = await web3.eth.getBlock(blockNumber);
    const timestamp = block ? Number(block.timestamp) : null;
    blockCache.set(blockNumber, timestamp);
    return timestamp;
  };

  if (includeValidators) {
    for (const ev of jobValidated) {
      const validator = ev.returnValues.validator || ev.returnValues[1];
      if (validator) validatorAddressSet.add(normalizeAddress(validator));
    }
    for (const ev of jobDisapproved) {
      const validator = ev.returnValues.validator || ev.returnValues[1];
      if (validator) validatorAddressSet.add(normalizeAddress(validator));
    }
  }

  for (const ev of jobCreated) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const job = await getJob(jobId);
    if (job.employer && job.payout && job.payout.gt(toBN(0))) {
      employerSet.add(job.employer);
      addAnchor(employerAnchors, job.employer, buildAnchor(ev, jobId, chainId, contractAddress));
    }
  }

  for (const ev of jobApplied) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const agent = ev.returnValues.agent || ev.returnValues[1];
    const metrics = getAgent(agent);
    metrics.assignedCount += 1;
    const job = await getJob(jobId);
    if (job.assignedAgent && job.assignedAgent !== normalizeAddress(agent)) {
      job.assignedAgent = normalizeAddress(agent);
      jobCache.set(String(jobId), job);
    }
    const blockTimestamp = await getBlockTimestamp(ev.blockNumber);
    jobTiming.set(String(jobId), {
      assignedAt: blockTimestamp,
    });
    metrics.lastActivityBlock = ev.blockNumber;
    metrics.lastActivityTimestamp = blockTimestamp;
    addAnchor(agentAnchors, agent, buildAnchor(ev, jobId, chainId, contractAddress));
  }

  for (const ev of jobCompletionRequested) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const agent = ev.returnValues.agent || ev.returnValues[1];
    const metrics = getAgent(agent);
    metrics.completionRequestedCount += 1;
    const blockTimestamp = await getBlockTimestamp(ev.blockNumber);
    const timing = jobTiming.get(String(jobId)) || {};
    timing.completionRequestedAt = blockTimestamp;
    jobTiming.set(String(jobId), timing);
    if (timing.assignedAt !== undefined && timing.assignedAt !== null && blockTimestamp !== null) {
      const delta = Math.max(0, blockTimestamp - timing.assignedAt);
      metrics.responseTimeSum = metrics.responseTimeSum.add(toBN(delta));
      metrics.responseTimeCount += 1;
    }
    metrics.lastActivityBlock = ev.blockNumber;
    metrics.lastActivityTimestamp = blockTimestamp;
    addAnchor(agentAnchors, agent, buildAnchor(ev, jobId, chainId, contractAddress));
  }

  for (const ev of jobCompleted) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const agent = ev.returnValues.agent || ev.returnValues[1];
    const metrics = getAgent(agent);
    metrics.completedCount += 1;
    const job = await getJob(jobId);
    metrics.revenuesProxy = metrics.revenuesProxy.add(job.payout);
    const blockTimestamp = await getBlockTimestamp(ev.blockNumber);
    const timing = jobTiming.get(String(jobId)) || {};
    timing.completedAt = blockTimestamp;
    jobTiming.set(String(jobId), timing);
    if (timing.assignedAt !== undefined && timing.assignedAt !== null && blockTimestamp !== null && timing.completionRequestedAt === undefined) {
      const delta = Math.max(0, blockTimestamp - timing.assignedAt);
      metrics.responseTimeSum = metrics.responseTimeSum.add(toBN(delta));
      metrics.responseTimeCount += 1;
    }
    metrics.lastActivityBlock = ev.blockNumber;
    metrics.lastActivityTimestamp = blockTimestamp;
    metrics.revenueAnchor = buildAnchor(ev, jobId, chainId, contractAddress);
    addAnchor(agentAnchors, agent, buildAnchor(ev, jobId, chainId, contractAddress));
  }

  for (const ev of jobDisputed) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const job = await getJob(jobId);
    if (!job.assignedAgent) continue;
    const metrics = getAgent(job.assignedAgent);
    metrics.disputedCount += 1;
    const blockTimestamp = await getBlockTimestamp(ev.blockNumber);
    metrics.lastActivityBlock = ev.blockNumber;
    metrics.lastActivityTimestamp = blockTimestamp;
    addAnchor(agentAnchors, job.assignedAgent, buildAnchor(ev, jobId, chainId, contractAddress));
    if (includeValidators) {
      const disputant = ev.returnValues.disputant || ev.returnValues[1];
      const disputantKey = normalizeAddress(disputant);
      if (validatorAddressSet.has(disputantKey)) {
        const validatorMetrics = getValidator(disputant);
        validatorMetrics.disputesTriggered += 1;
        validatorMetrics.lastActivityBlock = ev.blockNumber;
        validatorMetrics.lastActivityTimestamp = blockTimestamp;
        addAnchor(validatorAnchors, disputant, buildAnchor(ev, jobId, chainId, contractAddress));
      }
    }
  }

  for (const ev of disputeResolved) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const resolutionRaw = ev.returnValues.resolution || ev.returnValues[2] || '';
    const resolution = String(resolutionRaw).toLowerCase();
    const job = await getJob(jobId);
    if (!job.assignedAgent) continue;
    const metrics = getAgent(job.assignedAgent);
    if (resolution === 'agent win') {
      metrics.agentWinCount += 1;
    } else if (resolution === 'employer win') {
      metrics.employerWinCount += 1;
    } else {
      metrics.unknownResolutionCount += 1;
    }
    const blockTimestamp = await getBlockTimestamp(ev.blockNumber);
    metrics.lastActivityBlock = ev.blockNumber;
    metrics.lastActivityTimestamp = blockTimestamp;
    addAnchor(agentAnchors, job.assignedAgent, buildAnchor(ev, jobId, chainId, contractAddress));
  }

  if (includeValidators) {
    for (const ev of jobValidated) {
      const jobId = ev.returnValues.jobId || ev.returnValues[0];
      const validator = ev.returnValues.validator || ev.returnValues[1];
      const metrics = getValidator(validator);
      metrics.validationsCount += 1;
      const blockTimestamp = await getBlockTimestamp(ev.blockNumber);
      metrics.lastActivityBlock = ev.blockNumber;
      metrics.lastActivityTimestamp = blockTimestamp;
      addAnchor(validatorAnchors, validator, buildAnchor(ev, jobId, chainId, contractAddress));
    }
    for (const ev of jobDisapproved) {
      const jobId = ev.returnValues.jobId || ev.returnValues[0];
      const validator = ev.returnValues.validator || ev.returnValues[1];
      const metrics = getValidator(validator);
      metrics.disapprovalsCount += 1;
      const blockTimestamp = await getBlockTimestamp(ev.blockNumber);
      metrics.lastActivityBlock = ev.blockNumber;
      metrics.lastActivityTimestamp = blockTimestamp;
      addAnchor(validatorAnchors, validator, buildAnchor(ev, jobId, chainId, contractAddress));
    }

    for (const ev of reputationUpdated) {
      const user = ev.returnValues.user || ev.returnValues[0];
      const key = normalizeAddress(user);
      if (!validators.has(key)) continue;
      const metrics = getValidator(user);
      const newRep = toBN(ev.returnValues.newReputation || ev.returnValues[1]);
      if (metrics.latestReputation !== null) {
        const delta = newRep.sub(toBN(metrics.latestReputation));
        if (delta.gt(toBN(0))) {
          metrics.reputationGain = metrics.reputationGain.add(delta);
        }
      }
      metrics.latestReputation = newRep.toString();
      metrics.reputationUpdates += 1;
      const blockTimestamp = await getBlockTimestamp(ev.blockNumber);
      metrics.lastActivityBlock = ev.blockNumber;
      metrics.lastActivityTimestamp = blockTimestamp;
      addAnchor(validatorAnchors, user, buildAnchor(ev, null, chainId, contractAddress));
    }
  }

  for (const [addressKey, metrics] of agents.entries()) {
    const jobsAssigned = toBN(metrics.assignedCount);
    const successRate = formatRate(toBN(metrics.completedCount), jobsAssigned);
    const disputeRate = formatRate(toBN(metrics.disputedCount), jobsAssigned);
    if (successRate) metrics.rates.successRate = successRate;
    if (disputeRate) metrics.rates.disputeRate = disputeRate;
    metrics.revenuesProxy = metrics.revenuesProxy.toString();
    metrics.responseTimeSum = metrics.responseTimeSum.toString();
    metrics.evidence = {
      anchors: anchorsToList(agentAnchors.get(addressKey) || new Map()),
    };
    agents.set(addressKey, metrics);
  }

  if (includeValidators) {
    for (const [addressKey, metrics] of validators.entries()) {
      const total = metrics.validationsCount + metrics.disapprovalsCount;
      const approvalRate = total > 0
        ? formatRate(toBN(metrics.validationsCount), toBN(total))
        : null;
      const disapprovalRate = total > 0
        ? formatRate(toBN(metrics.disapprovalsCount), toBN(total))
        : null;
      if (approvalRate) metrics.rates.approvalRate = approvalRate;
      if (disapprovalRate) metrics.rates.disapprovalRate = disapprovalRate;
      metrics.reputationGain = metrics.reputationGain.toString();
      metrics.evidence = {
        anchors: anchorsToList(validatorAnchors.get(addressKey) || new Map()),
      };
      validators.set(addressKey, metrics);
    }
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
  const toolVersion = overrides.toolVersion || `agijobmanager-erc8004-adapter@${packageJson.version}`;
  const chainIdValue = chainIdOverride ? Number(chainIdOverride) : chainId;
  const agentRegistry = `${namespace}:${chainIdValue}:${normalizeAddress(identityRegistry)}`;
  const agentIdMap = overrides.agentIdMap || parseAgentIdMap(agentIdMapPath) || {};
  const subjectFilter = agentAddressOverride ? normalizeAddress(agentAddressOverride) : null;

  const summary = {
    version: '0.3',
    metadata: {
      chainId: chainIdValue,
      network: overrides.network || ((typeof config !== 'undefined' && config.network) ? config.network : 'unknown'),
      contractAddress: contract.address,
      fromBlock,
      toBlock,
      generatedAt: overrides.generatedAt || new Date().toISOString(),
      toolVersion,
    },
    agentRegistry,
    trustedClientSet: {
      criteria: 'addresses that created paid jobs in range',
      addresses: Array.from(employerSet).sort(),
      evidence: {
        anchors: anchorsToList(mergeAnchorMaps(Array.from(employerAnchors.values()))),
      },
    },
    subjects: {
      agents: {},
    },
  };

  if (includeValidators) {
    summary.subjects.validators = {};
  }

  const toBlockTimestamp = await getBlockTimestamp(toBlock);
  const feedbackTimestamp = toBlockTimestamp ?? Math.floor(Date.now() / 1000);

  const buildFeedbackEntries = (metrics) => {
    const entries = [];
    if (metrics.rates?.successRate) {
      entries.push({
        clientAddress: contractAddress,
        tag1: 'successRate',
        tag2: 'observer',
        value: metrics.rates.successRate.value,
        valueDecimals: metrics.rates.successRate.valueDecimals,
        reason: `Computed from AGIJobManager events ${fromBlock}-${toBlock}.`,
        timestamp: metrics.lastActivityTimestamp || feedbackTimestamp,
      });
    }
    if (metrics.rates?.disputeRate) {
      entries.push({
        clientAddress: contractAddress,
        tag1: 'disputeRate',
        tag2: 'observer',
        value: metrics.rates.disputeRate.value,
        valueDecimals: metrics.rates.disputeRate.valueDecimals,
        reason: `Computed from AGIJobManager events ${fromBlock}-${toBlock}.`,
        timestamp: metrics.lastActivityTimestamp || feedbackTimestamp,
      });
    }
    if (metrics.responseTimeCount > 0) {
      const avg = toBN(metrics.responseTimeSum).div(toBN(metrics.responseTimeCount));
      entries.push({
        clientAddress: contractAddress,
        tag1: 'responseTime',
        tag2: 'observer',
        value: safeValue(avg),
        valueDecimals: 0,
        reason: 'Average seconds from assignment to completion request/confirmation.',
        timestamp: metrics.lastActivityTimestamp || feedbackTimestamp,
      });
    }
    if (metrics.lastActivityBlock !== null && metrics.lastActivityBlock !== undefined) {
      const freshness = Math.max(0, toBlock - metrics.lastActivityBlock);
      entries.push({
        clientAddress: contractAddress,
        tag1: 'blocktimeFreshness',
        tag2: 'observer',
        value: freshness,
        valueDecimals: 0,
        reason: 'Blocks since last observed activity in the range.',
        timestamp: metrics.lastActivityTimestamp || feedbackTimestamp,
      });
    }
    if (metrics.revenuesProxy && toBN(metrics.revenuesProxy).gt(toBN(0))) {
      const entry = {
        clientAddress: contractAddress,
        tag1: 'revenues',
        tag2: 'observer',
        value: safeValue(toBN(metrics.revenuesProxy)),
        valueDecimals: 0,
        reason: 'Proxy: sum of job payout values for completed jobs (raw token units).',
        timestamp: metrics.lastActivityTimestamp || feedbackTimestamp,
      };
      if (metrics.revenueAnchor) {
        entry.proofOfPayment = {
          txHash: metrics.revenueAnchor.txHash,
          logIndex: metrics.revenueAnchor.logIndex,
          blockNumber: metrics.revenueAnchor.blockNumber,
          event: metrics.revenueAnchor.event,
          jobId: metrics.revenueAnchor.jobId,
        };
      }
      entries.push(entry);
    }
    entries.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.tag1.localeCompare(b.tag1);
    });
    return entries;
  };

  const buildValidatorEntries = (metrics) => {
    const entries = [];
    if (metrics.rates?.approvalRate) {
      entries.push({
        clientAddress: contractAddress,
        tag1: 'approvalRate',
        tag2: 'observer',
        value: metrics.rates.approvalRate.value,
        valueDecimals: metrics.rates.approvalRate.valueDecimals,
        reason: `Computed from validator approvals/disapprovals ${fromBlock}-${toBlock}.`,
        timestamp: metrics.lastActivityTimestamp || feedbackTimestamp,
      });
    }
    if (metrics.rates?.disapprovalRate) {
      entries.push({
        clientAddress: contractAddress,
        tag1: 'disapprovalRate',
        tag2: 'observer',
        value: metrics.rates.disapprovalRate.value,
        valueDecimals: metrics.rates.disapprovalRate.valueDecimals,
        reason: `Computed from validator approvals/disapprovals ${fromBlock}-${toBlock}.`,
        timestamp: metrics.lastActivityTimestamp || feedbackTimestamp,
      });
    }
    entries.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.tag1.localeCompare(b.tag1);
    });
    return entries;
  };

  fs.mkdirSync(outDir, { recursive: true });

  const emitSubjectFile = (subjectAddress, agentId, feedbackEntries, subjectType) => {
    const normalized = normalizeAddress(subjectAddress);
    const filename = `${subjectType}_${normalized}.json`;
    const outPath = path.join(outDir, filename);
    const payload = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#reputation-v1',
      agentRegistry,
      agentId,
      feedback: feedbackEntries,
    };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    return { filename, outPath };
  };

  const emitWalletFile = (subjectAddress, feedbackEntries, subjectType) => {
    const normalized = normalizeAddress(subjectAddress);
    const filename = `${subjectType}_${normalized}.wallet.json`;
    const outPath = path.join(outDir, filename);
    const payload = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#reputation-wallet-v1',
      agentRegistry,
      subjectAddress: normalized,
      feedback: feedbackEntries,
      notes: 'Map subjectAddress to agentId in the ERC-8004 identity registry, then replace this file with a reputation-v1 file.',
    };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    return { filename, outPath };
  };

  const resolvedAgentIdOverride = agentIdOverride ? Number(agentIdOverride) : null;

  for (const [addressKey, metrics] of agents.entries()) {
    if (subjectFilter && addressKey !== subjectFilter) continue;
    const feedbackEntries = buildFeedbackEntries(metrics);
    const mappedId = agentIdMap[addressKey];
    const agentId = mappedId !== undefined ? mappedId : resolvedAgentIdOverride;
    let outputRecord;
    if (agentId === undefined || agentId === null || Number.isNaN(Number(agentId))) {
      outputRecord = emitWalletFile(addressKey, feedbackEntries, 'agent');
    } else {
      outputRecord = emitSubjectFile(addressKey, Number(agentId), feedbackEntries, 'agent');
    }

    summary.subjects.agents[addressKey] = {
      agentId: agentId ?? null,
      assignedCount: metrics.assignedCount,
      completedCount: metrics.completedCount,
      completionRequestedCount: metrics.completionRequestedCount,
      disputedCount: metrics.disputedCount,
      agentWinCount: metrics.agentWinCount,
      employerWinCount: metrics.employerWinCount,
      unknownResolutionCount: metrics.unknownResolutionCount,
      revenuesProxy: metrics.revenuesProxy,
      responseTimeAvgSeconds: metrics.responseTimeCount > 0
        ? Math.floor(toBN(metrics.responseTimeSum).div(toBN(metrics.responseTimeCount)).toNumber())
        : null,
      successRate: metrics.rates.successRate || null,
      disputeRate: metrics.rates.disputeRate || null,
      lastActivityBlock: metrics.lastActivityBlock,
      file: outputRecord.filename,
    };
  }

  if (includeValidators) {
    for (const [addressKey, metrics] of validators.entries()) {
      if (subjectFilter && addressKey !== subjectFilter) continue;
      const feedbackEntries = buildValidatorEntries(metrics);
      const mappedId = agentIdMap[addressKey];
      const agentId = mappedId !== undefined ? mappedId : resolvedAgentIdOverride;
      let outputRecord;
      if (agentId === undefined || agentId === null || Number.isNaN(Number(agentId))) {
        outputRecord = emitWalletFile(addressKey, feedbackEntries, 'validator');
      } else {
        outputRecord = emitSubjectFile(addressKey, Number(agentId), feedbackEntries, 'validator');
      }

      summary.subjects.validators[addressKey] = {
        agentId: agentId ?? null,
        validationsCount: metrics.validationsCount,
        disapprovalsCount: metrics.disapprovalsCount,
        disputesTriggered: metrics.disputesTriggered,
        approvalRate: metrics.rates.approvalRate || null,
        disapprovalRate: metrics.rates.disapprovalRate || null,
        lastActivityBlock: metrics.lastActivityBlock,
        file: outputRecord.filename,
      };
    }
  }

  summary.subjects.agents = sortObjectByKeys(Object.entries(summary.subjects.agents));
  if (includeValidators) {
    summary.subjects.validators = sortObjectByKeys(Object.entries(summary.subjects.validators));
  }

  const summaryPath = path.join(outDir, 'export_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`ERC-8004 feedback artifacts written to ${outDir}`);
  return { summaryPath, summary };
}

module.exports = function (callback) {
  runExportFeedback()
    .then(() => callback())
    .catch((err) => callback(err));
};

module.exports.runExportFeedback = runExportFeedback;
