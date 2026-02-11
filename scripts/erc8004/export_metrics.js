/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ARG_PREFIX = '--';
const DEFAULT_BATCH_SIZE = 2000;

function ensureWeb3() {
  if (typeof web3 !== 'undefined') return web3;
  const Web3 = require('web3');
  const providerUrl = process.env.WEB3_PROVIDER || 'http://127.0.0.1:8545';
  const web3Instance = new Web3(providerUrl);
  global.web3 = web3Instance;
  return web3Instance;
}

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


function hasEvent(contract, eventName) {
  const json = contract.constructor?._json?.abi || contract.abi || [];
  return json.some((item) => item && item.type === 'event' && item.name === eventName);
}

async function fetchEventsIfPresent(contract, eventName, fromBlock, toBlock, batchSize) {
  if (!hasEvent(contract, eventName)) return [];
  return fetchEvents(contract, eventName, fromBlock, toBlock, batchSize);
}


function decodeDisputeResolution(ev) {
  const hasTypedCode = ev.returnValues && ev.returnValues.resolutionCode !== undefined;
  if (hasTypedCode) {
    const code = Number(ev.returnValues.resolutionCode);
    if (code === 1) return 'agent win';
    if (code === 2) return 'employer win';
    return 'no_action';
  }
  const resolutionRaw = ev.returnValues.resolution || ev.returnValues.reason || ev.returnValues[2] || '';
  return String(resolutionRaw).toLowerCase();
}

function isTypedDisputeResolutionEvent(ev) {
  if ((ev.event || '') === 'DisputeResolvedWithCode') return true;
  return ev.returnValues && ev.returnValues.resolutionCode !== undefined;
}

function mergeDisputeResolutionEvents(legacyEvents, typedEvents) {
  const byKey = new Map();
  for (const ev of legacyEvents.concat(typedEvents)) {
    const jobId = String(ev.returnValues.jobId || ev.returnValues[0] || '');
    const resolution = decodeDisputeResolution(ev);
    const key = `${ev.transactionHash || ''}:${jobId}:${resolution}`;
    const existing = byKey.get(key);
    if (!existing || (isTypedDisputeResolutionEvent(ev) && !isTypedDisputeResolutionEvent(existing))) {
      byKey.set(key, ev);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return (a.logIndex || 0) - (b.logIndex || 0);
  });
}

function getAGIJobManagerContract() {
  const web3Instance = ensureWeb3();
  if (typeof artifacts !== 'undefined') {
    return artifacts.require('AGIJobManager');
  }
  const contract = require('@truffle/contract');
  const artifactPath = path.join(__dirname, '../../build/contracts/AGIJobManager.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const AGIJobManager = contract(artifact);
  AGIJobManager.setProvider(web3Instance.currentProvider);
  return AGIJobManager;
}

async function runExportMetrics(overrides = {}) {
  ensureWeb3();
  const AGIJobManager = getAGIJobManagerContract();
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
    disputeResolvedLegacy,
    disputeResolvedWithCode,
  ] = await Promise.all([
    fetchEvents(contract, 'JobCreated', fromBlock, toBlock, batchSize),
    fetchEvents(contract, 'JobApplied', fromBlock, toBlock, batchSize),
    fetchEvents(contract, 'JobCompletionRequested', fromBlock, toBlock, batchSize),
    fetchEvents(contract, 'JobCompleted', fromBlock, toBlock, batchSize),
    fetchEvents(contract, 'JobDisputed', fromBlock, toBlock, batchSize),
    fetchEventsIfPresent(contract, 'DisputeResolved', fromBlock, toBlock, batchSize),
    fetchEventsIfPresent(contract, 'DisputeResolvedWithCode', fromBlock, toBlock, batchSize),
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

  const disputeResolved = mergeDisputeResolutionEvents(disputeResolvedLegacy, disputeResolvedWithCode);

  const chainId = await web3.eth.getChainId();
  const contractAddress = contract.address;
  const jobCache = new Map();
  const agents = new Map();
  const validators = new Map();
  const employerSet = new Set();
  const agentAnchors = new Map();
  const validatorAnchors = new Map();
  const employerAnchors = new Map();
  const validatorAddressSet = new Set();
  const jobAssignedBlock = new Map();
  const jobCompletionRequestedBlock = new Map();

  const getAgent = (addressKey) => {
    const key = normalizeAddress(addressKey);
    if (!agents.has(key)) {
      agents.set(key, {
        jobsApplied: 0,
        jobsAssigned: 0,
        jobsCompletionRequested: 0,
        jobsCompleted: 0,
        jobsDisputed: 0,
        employerWins: 0,
        agentWins: 0,
        unknownResolutions: 0,
        revenuesProxy: toBN(0),
        grossEscrow: toBN(0),
        netAgentPaidProxy: null,
        responseTimeBlocksTotal: toBN(0),
        responseTimeSamples: 0,
        responseTimeBlocksAvg: null,
        lastActivityBlock: null,
        rates: {},
      });
    }
    return agents.get(key);
  };

  const getValidator = (addressKey) => {
    const key = normalizeAddress(addressKey);
    if (!validators.has(key)) {
      validators.set(key, {
        approvals: 0,
        disapprovals: 0,
        disputesTriggered: 0,
        reputationUpdates: 0,
        reputationGain: toBN(0),
        latestReputation: null,
        lastActivityBlock: null,
        rates: {},
      });
    }
    return validators.get(key);
  };

  const getJob = async (jobId) => {
    const idKey = String(jobId);
    if (jobCache.has(idKey)) return jobCache.get(idKey);
    const job = await contract.getJobCore(jobId);
    const normalized = {
      employer: normalizeAddress(job.employer),
      assignedAgent: normalizeAddress(job.assignedAgent),
      payout: toBN(job.payout),
    };
    jobCache.set(idKey, normalized);
    return normalized;
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
    metrics.jobsApplied += 1;
    metrics.jobsAssigned += 1;
    metrics.lastActivityBlock = Math.max(metrics.lastActivityBlock ?? 0, ev.blockNumber);
    jobAssignedBlock.set(String(jobId), ev.blockNumber);
    const job = await getJob(jobId);
    if (job.assignedAgent && job.assignedAgent !== normalizeAddress(agent)) {
      job.assignedAgent = normalizeAddress(agent);
      jobCache.set(String(jobId), job);
    }
    addAnchor(agentAnchors, agent, buildAnchor(ev, jobId, chainId, contractAddress));
  }

  for (const ev of jobCompletionRequested) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const agent = ev.returnValues.agent || ev.returnValues[1];
    const metrics = getAgent(agent);
    metrics.jobsCompletionRequested += 1;
    metrics.lastActivityBlock = Math.max(metrics.lastActivityBlock ?? 0, ev.blockNumber);
    jobCompletionRequestedBlock.set(String(jobId), ev.blockNumber);
    const assignedBlock = jobAssignedBlock.get(String(jobId));
    if (assignedBlock !== undefined) {
      metrics.responseTimeBlocksTotal = metrics.responseTimeBlocksTotal.add(
        toBN(ev.blockNumber - assignedBlock),
      );
      metrics.responseTimeSamples += 1;
    }
    addAnchor(agentAnchors, agent, buildAnchor(ev, jobId, chainId, contractAddress));
  }

  for (const ev of jobCompleted) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const agent = ev.returnValues.agent || ev.returnValues[1];
    const metrics = getAgent(agent);
    metrics.jobsCompleted += 1;
    metrics.lastActivityBlock = Math.max(metrics.lastActivityBlock ?? 0, ev.blockNumber);
    const job = await getJob(jobId);
    metrics.revenuesProxy = metrics.revenuesProxy.add(job.payout);
    metrics.grossEscrow = metrics.grossEscrow.add(job.payout);
    if (!jobCompletionRequestedBlock.has(String(jobId))) {
      const assignedBlock = jobAssignedBlock.get(String(jobId));
      if (assignedBlock !== undefined) {
        metrics.responseTimeBlocksTotal = metrics.responseTimeBlocksTotal.add(
          toBN(ev.blockNumber - assignedBlock),
        );
        metrics.responseTimeSamples += 1;
      }
    }
    addAnchor(agentAnchors, agent, buildAnchor(ev, jobId, chainId, contractAddress));
  }

  for (const ev of jobDisputed) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const job = await getJob(jobId);
    if (!job.assignedAgent) continue;
    const metrics = getAgent(job.assignedAgent);
    metrics.jobsDisputed += 1;
    metrics.lastActivityBlock = Math.max(metrics.lastActivityBlock ?? 0, ev.blockNumber);
    addAnchor(agentAnchors, job.assignedAgent, buildAnchor(ev, jobId, chainId, contractAddress));
    if (includeValidators) {
      const disputant = ev.returnValues.disputant || ev.returnValues[1];
      const disputantKey = normalizeAddress(disputant);
      if (validatorAddressSet.has(disputantKey)) {
        getValidator(disputant).disputesTriggered += 1;
        getValidator(disputant).lastActivityBlock = Math.max(
          getValidator(disputant).lastActivityBlock ?? 0,
          ev.blockNumber,
        );
        addAnchor(validatorAnchors, disputant, buildAnchor(ev, jobId, chainId, contractAddress));
      }
    }
  }

  for (const ev of disputeResolved) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const resolution = decodeDisputeResolution(ev);
    const job = await getJob(jobId);
    if (!job.assignedAgent) continue;
    const metrics = getAgent(job.assignedAgent);
    if (resolution === 'agent win') {
      metrics.agentWins += 1;
    } else if (resolution === 'employer win') {
      metrics.employerWins += 1;
    } else {
      metrics.unknownResolutions += 1;
    }
    metrics.lastActivityBlock = Math.max(metrics.lastActivityBlock ?? 0, ev.blockNumber);
    addAnchor(agentAnchors, job.assignedAgent, buildAnchor(ev, jobId, chainId, contractAddress));
  }

  if (includeValidators) {
    for (const ev of jobValidated) {
      const jobId = ev.returnValues.jobId || ev.returnValues[0];
      const validator = ev.returnValues.validator || ev.returnValues[1];
      getValidator(validator).approvals += 1;
      getValidator(validator).lastActivityBlock = Math.max(
        getValidator(validator).lastActivityBlock ?? 0,
        ev.blockNumber,
      );
      addAnchor(validatorAnchors, validator, buildAnchor(ev, jobId, chainId, contractAddress));
    }
    for (const ev of jobDisapproved) {
      const jobId = ev.returnValues.jobId || ev.returnValues[0];
      const validator = ev.returnValues.validator || ev.returnValues[1];
      getValidator(validator).disapprovals += 1;
      getValidator(validator).lastActivityBlock = Math.max(
        getValidator(validator).lastActivityBlock ?? 0,
        ev.blockNumber,
      );
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
      metrics.lastActivityBlock = Math.max(metrics.lastActivityBlock ?? 0, ev.blockNumber);
      addAnchor(validatorAnchors, user, buildAnchor(ev, null, chainId, contractAddress));
    }
  }

  for (const [addressKey, metrics] of agents.entries()) {
    let payoutPercentage = null;
    try {
      payoutPercentage = await contract.getHighestPayoutPercentage(addressKey);
    } catch (error) {
      payoutPercentage = null;
    }
    if (payoutPercentage !== null && payoutPercentage !== undefined) {
      const percentage = toBN(payoutPercentage);
      metrics.netAgentPaidProxy = metrics.grossEscrow.mul(percentage).div(toBN(100)).toString();
      metrics.agentPayoutPercentage = percentage.toString();
    }
    const jobsAssigned = toBN(metrics.jobsAssigned);
    const successRate = formatRate(toBN(metrics.jobsCompleted), jobsAssigned);
    const disputeRate = formatRate(toBN(metrics.jobsDisputed), jobsAssigned);
    if (successRate) metrics.rates.successRate = successRate;
    if (disputeRate) metrics.rates.disputeRate = disputeRate;
    metrics.revenuesProxy = metrics.revenuesProxy.toString();
    metrics.grossEscrow = metrics.grossEscrow.toString();
    metrics.assignedCount = metrics.jobsAssigned;
    metrics.completedCount = metrics.jobsCompleted;
    metrics.disputedCount = metrics.jobsDisputed;
    metrics.agentWinCount = metrics.agentWins;
    metrics.employerWinCount = metrics.employerWins;
    metrics.unknownResolutionCount = metrics.unknownResolutions;
    if (metrics.responseTimeSamples > 0) {
      metrics.responseTimeBlocksAvg = metrics.responseTimeBlocksTotal
        .div(toBN(metrics.responseTimeSamples))
        .toNumber();
    }
    metrics.responseTimeBlocksTotal = metrics.responseTimeBlocksTotal.toString();
    metrics.evidence = {
      anchors: anchorsToList(agentAnchors.get(addressKey) || new Map()),
    };
    agents.set(addressKey, metrics);
  }

  if (includeValidators) {
    for (const [addressKey, metrics] of validators.entries()) {
      const totalDecisions = toBN(metrics.approvals).add(toBN(metrics.disapprovals));
      const approvalRate = formatRate(toBN(metrics.approvals), totalDecisions);
      if (approvalRate) metrics.rates.approvalRate = approvalRate;
      metrics.approvalsCount = metrics.approvals;
      metrics.disapprovalsCount = metrics.disapprovals;
      metrics.reputationGain = metrics.reputationGain.toString();
      metrics.evidence = {
        anchors: anchorsToList(validatorAnchors.get(addressKey) || new Map()),
      };
      validators.set(addressKey, metrics);
    }
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
  const toolVersion = overrides.toolVersion || `agijobmanager-erc8004-adapter@${packageJson.version}`;

  const output = {
    version: '0.2',
    metadata: {
      chainId,
      network: overrides.network || ((typeof config !== 'undefined' && config.network) ? config.network : 'unknown'),
      contractAddress: contract.address,
      fromBlock,
      toBlock,
      generatedAt: overrides.generatedAt || new Date().toISOString(),
      toolVersion,
    },
    trustedClientSet: {
      criteria: 'addresses that created paid jobs in range',
      addresses: Array.from(employerSet).sort(),
      evidence: {
        anchors: anchorsToList(mergeAnchorMaps(Array.from(employerAnchors.values()))),
      },
    },
    agents: sortObjectByKeys(Array.from(agents.entries())),
  };

  if (includeValidators) {
    output.validators = sortObjectByKeys(Array.from(validators.entries()));
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'erc8004_metrics.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`ERC-8004 metrics written to ${outPath}`);
  return { outPath, output };
}

module.exports = function (callback) {
  runExportMetrics()
    .then(() => callback())
    .catch((err) => callback(err));
};

module.exports.runExportMetrics = runExportMetrics;

module.exports.mergeDisputeResolutionEvents = mergeDisputeResolutionEvents;

module.exports.decodeDisputeResolution = decodeDisputeResolution;
