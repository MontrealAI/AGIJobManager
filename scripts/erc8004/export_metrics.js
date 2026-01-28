const fs = require('fs');
const path = require('path');

function getArgValue(name) {
  const withEquals = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (withEquals) return withEquals.split('=')[1];
  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return undefined;
}

function normalizeBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return String(value).toLowerCase() === 'true';
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function formatRate(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 1;
}

function getStats(map, address, web3Instance) {
  if (!map.has(address)) {
    map.set(address, {
      jobsApplied: 0,
      jobsAssigned: 0,
      jobsCompleted: 0,
      jobsDisputed: 0,
      employerWins: 0,
      agentWins: 0,
      unknownResolutions: 0,
      revenues: web3Instance.utils.toBN(0),
    });
  }
  return map.get(address);
}

module.exports = async function exportMetrics(callback) {
  try {
    const web3Instance = typeof web3 !== 'undefined' ? web3 : global.web3;
    const truffleArtifacts = typeof artifacts !== 'undefined' ? artifacts : global.artifacts;
    if (!web3Instance || !truffleArtifacts) throw new Error('Truffle globals (web3, artifacts) not found.');

    const AGIJobManager = truffleArtifacts.require('AGIJobManager');
    const address = process.env.AGIJOBMANAGER_ADDRESS || getArgValue('AGIJOBMANAGER_ADDRESS');
    if (!address) throw new Error('Missing AGIJOBMANAGER_ADDRESS');

    const includeValidators = normalizeBool(process.env.INCLUDE_VALIDATORS || getArgValue('INCLUDE_VALIDATORS'));

    const fromBlockRaw = process.env.FROM_BLOCK || getArgValue('FROM_BLOCK') || '0';
    const toBlockRaw = process.env.TO_BLOCK || getArgValue('TO_BLOCK') || 'latest';

    const fromBlock = Number(fromBlockRaw);
    if (!Number.isFinite(fromBlock) || fromBlock < 0) throw new Error(`Invalid FROM_BLOCK: ${fromBlockRaw}`);

    const latestBlock = await web3Instance.eth.getBlockNumber();
    const toBlock = toBlockRaw === 'latest' ? latestBlock : Number(toBlockRaw);
    if (!Number.isFinite(toBlock) || toBlock < fromBlock) throw new Error(`Invalid TO_BLOCK: ${toBlockRaw}`);

    const outDir = process.env.OUT_DIR || getArgValue('OUT_DIR') || path.join('integrations', 'erc8004', 'out');
    ensureDir(outDir);

    const contract = await AGIJobManager.at(address);
    const events = await contract.getPastEvents('allEvents', { fromBlock, toBlock });
    events.sort((a, b) => (a.blockNumber - b.blockNumber) || (a.logIndex - b.logIndex));

    const jobData = new Map();
    const jobDisputed = new Set();
    const jobResolved = new Set();
    const txCache = new Map();

    const agents = new Map();
    const validators = new Map();
    const trustedEmployers = new Set();

    for (const event of events) {
      const jobId = event.returnValues.jobId !== undefined ? String(event.returnValues.jobId) : undefined;

      if (event.event === 'JobCreated') {
        const payout = web3Instance.utils.toBN(event.returnValues.payout);
        let employer = '0x0000000000000000000000000000000000000000';
        if (event.transactionHash) {
          if (!txCache.has(event.transactionHash)) {
            txCache.set(event.transactionHash, await web3Instance.eth.getTransaction(event.transactionHash));
          }
          const tx = txCache.get(event.transactionHash);
          if (tx && tx.from) employer = tx.from;
        }
        jobData.set(jobId, { payout, employer, agent: null });
        trustedEmployers.add(employer.toLowerCase());
        continue;
      }

      if (event.event === 'JobApplied') {
        const agent = event.returnValues.agent;
        const stats = getStats(agents, agent.toLowerCase(), web3Instance);
        stats.jobsApplied += 1;
        stats.jobsAssigned += 1;
        const data = jobData.get(jobId) || { payout: web3Instance.utils.toBN(0), employer: null, agent: null };
        data.agent = agent;
        jobData.set(jobId, data);
        continue;
      }

      if (event.event === 'JobDisputed') {
        if (jobId && !jobDisputed.has(jobId)) {
          jobDisputed.add(jobId);
          const data = jobData.get(jobId);
          if (data && data.agent) {
            const stats = getStats(agents, data.agent.toLowerCase(), web3Instance);
            stats.jobsDisputed += 1;
          }
        }
        continue;
      }

      if (event.event === 'DisputeResolved') {
        if (jobId && !jobResolved.has(jobId)) {
          jobResolved.add(jobId);
          const data = jobData.get(jobId);
          if (data && data.agent) {
            const stats = getStats(agents, data.agent.toLowerCase(), web3Instance);
            const resolution = String(event.returnValues.resolution || '').trim().toLowerCase();
            if (resolution === 'agent win') stats.agentWins += 1;
            else if (resolution === 'employer win') stats.employerWins += 1;
            else stats.unknownResolutions += 1;
          }
        }
        continue;
      }

      if (event.event === 'JobCompleted') {
        const agent = event.returnValues.agent;
        const stats = getStats(agents, agent.toLowerCase(), web3Instance);
        stats.jobsCompleted += 1;
        const data = jobData.get(jobId);
        if (data && data.payout) {
          stats.revenues = stats.revenues.add(data.payout);
        }
        continue;
      }

      if (includeValidators && event.event === 'JobValidated') {
        const validator = event.returnValues.validator;
        if (!validators.has(validator.toLowerCase())) {
          validators.set(validator.toLowerCase(), { jobsValidated: 0, jobsDisapproved: 0 });
        }
        validators.get(validator.toLowerCase()).jobsValidated += 1;
        continue;
      }

      if (includeValidators && event.event === 'JobDisapproved') {
        const validator = event.returnValues.validator;
        if (!validators.has(validator.toLowerCase())) {
          validators.set(validator.toLowerCase(), { jobsValidated: 0, jobsDisapproved: 0 });
        }
        validators.get(validator.toLowerCase()).jobsDisapproved += 1;
      }
    }

    const agentsOut = {};
    for (const [addressKey, stats] of agents.entries()) {
      const successRate = formatRate(stats.jobsCompleted, stats.jobsAssigned);
      const disputeRate = formatRate(stats.jobsDisputed, stats.jobsAssigned);
      agentsOut[addressKey] = {
        jobsApplied: stats.jobsApplied,
        jobsAssigned: stats.jobsAssigned,
        jobsCompleted: stats.jobsCompleted,
        jobsDisputed: stats.jobsDisputed,
        employerWins: stats.employerWins,
        agentWins: stats.agentWins,
        unknownResolutions: stats.unknownResolutions,
        successRate: { value: successRate, valueDecimals: 2 },
        disputeRate: { value: disputeRate, valueDecimals: 2 },
        revenues: { value: stats.revenues.toString(), valueDecimals: 0 },
      };
    }

    const validatorsOut = {};
    if (includeValidators) {
      for (const [addressKey, stats] of validators.entries()) {
        validatorsOut[addressKey] = stats;
      }
    }

    const chainId = await web3Instance.eth.getChainId();
    const networkId = await web3Instance.eth.net.getId();
    const networkName = getArgValue('network') || process.env.TRUFFLE_NETWORK || 'unknown';

    const output = {
      metadata: {
        version: '1.0.0',
        chainId,
        networkId,
        network: networkName,
        fromBlock,
        toBlock,
        generatedAt: new Date().toISOString(),
        contract: address,
      },
      agents: agentsOut,
      validators: includeValidators ? validatorsOut : undefined,
      trustedEmployers: Array.from(trustedEmployers),
    };

    const fileName = `erc8004_metrics_${chainId}_${fromBlock}_${toBlock}.json`;
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));

    console.log(`ERC-8004 metrics exported to ${filePath}`);
    callback();
  } catch (error) {
    callback(error);
  }
};
