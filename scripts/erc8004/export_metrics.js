/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const AGIJobManager = artifacts.require('AGIJobManager');

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

function toNumber(value) {
  return Number(value);
}

function formatRate(numerator, denominator) {
  if (!denominator || denominator === 0) return null;
  const ratio = (numerator / denominator) * 100;
  return {
    value: Math.round(ratio * 100),
    valueDecimals: 2,
  };
}

async function main() {
  const address = process.env.AGIJOBMANAGER_ADDRESS || getArgValue('address');
  const fromBlockRaw = process.env.FROM_BLOCK || getArgValue('from-block') || '0';
  const toBlockRaw = process.env.TO_BLOCK || getArgValue('to-block') || 'latest';
  const outDir = process.env.OUT_DIR || getArgValue('out-dir') || path.join(__dirname, '../../integrations/erc8004/out');
  const includeValidators = parseBoolean(process.env.INCLUDE_VALIDATORS || getArgValue('include-validators'), false);

  const contract = address ? await AGIJobManager.at(address) : await AGIJobManager.deployed();

  const latestBlock = await web3.eth.getBlockNumber();
  const fromBlock = fromBlockRaw === 'latest' ? latestBlock : toNumber(fromBlockRaw);
  const toBlock = toBlockRaw === 'latest' ? latestBlock : toNumber(toBlockRaw);

  if (!Number.isFinite(fromBlock) || !Number.isFinite(toBlock)) {
    throw new Error('Invalid block range. FROM_BLOCK/TO_BLOCK must be numbers or "latest".');
  }

  const [jobCreated, jobApplied, jobCompleted, jobDisputed, disputeResolved] = await Promise.all([
    contract.getPastEvents('JobCreated', { fromBlock, toBlock }),
    contract.getPastEvents('JobApplied', { fromBlock, toBlock }),
    contract.getPastEvents('JobCompleted', { fromBlock, toBlock }),
    contract.getPastEvents('JobDisputed', { fromBlock, toBlock }),
    contract.getPastEvents('DisputeResolved', { fromBlock, toBlock }),
  ]);

  let jobValidated = [];
  let jobDisapproved = [];
  if (includeValidators) {
    [jobValidated, jobDisapproved] = await Promise.all([
      contract.getPastEvents('JobValidated', { fromBlock, toBlock }),
      contract.getPastEvents('JobDisapproved', { fromBlock, toBlock }),
    ]);
  }

  const jobCache = new Map();
  const agents = new Map();
  const validators = new Map();
  const employerSet = new Set();

  const getAgent = (addressKey) => {
    const key = normalizeAddress(addressKey);
    if (!agents.has(key)) {
      agents.set(key, {
        jobsApplied: 0,
        jobsAssigned: 0,
        jobsCompleted: 0,
        jobsDisputed: 0,
        employerWins: 0,
        agentWins: 0,
        unknownResolutions: 0,
        revenuesProxy: web3.utils.toBN(0),
        rates: {},
      });
    }
    return agents.get(key);
  };

  const getValidator = (addressKey) => {
    const key = normalizeAddress(addressKey);
    if (!validators.has(key)) {
      validators.set(key, {
        jobsValidated: 0,
        jobsDisapproved: 0,
      });
    }
    return validators.get(key);
  };

  const getJob = async (jobId) => {
    if (jobCache.has(jobId)) return jobCache.get(jobId);
    const job = await contract.jobs(jobId);
    const normalized = {
      employer: normalizeAddress(job.employer),
      assignedAgent: normalizeAddress(job.assignedAgent),
      payout: web3.utils.toBN(job.payout),
    };
    jobCache.set(jobId, normalized);
    return normalized;
  };

  for (const ev of jobCreated) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const job = await getJob(jobId);
    if (job.employer) employerSet.add(job.employer);
  }

  for (const ev of jobApplied) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const agent = ev.returnValues.agent || ev.returnValues[1];
    const metrics = getAgent(agent);
    metrics.jobsApplied += 1;
    metrics.jobsAssigned += 1;
    const job = await getJob(jobId);
    if (job.assignedAgent && job.assignedAgent !== normalizeAddress(agent)) {
      job.assignedAgent = normalizeAddress(agent);
      jobCache.set(jobId, job);
    }
  }

  for (const ev of jobCompleted) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const agent = ev.returnValues.agent || ev.returnValues[1];
    const metrics = getAgent(agent);
    metrics.jobsCompleted += 1;
    const job = await getJob(jobId);
    metrics.revenuesProxy = metrics.revenuesProxy.add(job.payout);
  }

  for (const ev of jobDisputed) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const job = await getJob(jobId);
    if (!job.assignedAgent) continue;
    const metrics = getAgent(job.assignedAgent);
    metrics.jobsDisputed += 1;
  }

  for (const ev of disputeResolved) {
    const jobId = ev.returnValues.jobId || ev.returnValues[0];
    const resolutionRaw = ev.returnValues.resolution || ev.returnValues[2] || '';
    const resolution = String(resolutionRaw).toLowerCase();
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
  }

  if (includeValidators) {
    for (const ev of jobValidated) {
      const validator = ev.returnValues.validator || ev.returnValues[1];
      getValidator(validator).jobsValidated += 1;
    }
    for (const ev of jobDisapproved) {
      const validator = ev.returnValues.validator || ev.returnValues[1];
      getValidator(validator).jobsDisapproved += 1;
    }
  }

  for (const [addressKey, metrics] of agents.entries()) {
    const successRate = formatRate(metrics.jobsCompleted, metrics.jobsAssigned);
    const disputeRate = formatRate(metrics.jobsDisputed, metrics.jobsAssigned);
    if (successRate) metrics.rates.successRate = successRate;
    if (disputeRate) metrics.rates.disputeRate = disputeRate;
    metrics.revenuesProxy = metrics.revenuesProxy.toString();
    agents.set(addressKey, metrics);
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
  const chainId = await web3.eth.getChainId();

  const output = {
    version: '0.1',
    metadata: {
      chainId,
      network: (typeof config !== 'undefined' && config.network) ? config.network : 'unknown',
      fromBlock,
      toBlock,
      generatedAt: new Date().toISOString(),
      sourceContract: contract.address,
      adapterVersion: packageJson.version,
    },
    trustedClientSet: {
      criteria: 'addresses that created paid jobs in range',
      addresses: Array.from(employerSet).sort(),
    },
    agents: Object.fromEntries(agents),
  };

  if (includeValidators) {
    output.validators = Object.fromEntries(validators);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'erc8004_metrics.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`ERC-8004 metrics written to ${outPath}`);
}

module.exports = function (callback) {
  main()
    .then(() => callback())
    .catch((err) => callback(err));
};
