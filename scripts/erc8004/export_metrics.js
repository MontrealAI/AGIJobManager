/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const AGIJobManager = artifacts.require("AGIJobManager");

function argValue(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return String(value).toLowerCase() === "true";
}

function parseBlockNumber(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "latest") return "latest";
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label} block: ${value}`);
  }
  return parsed;
}

function ensureAgent(map, address, web3) {
  if (!map.has(address)) {
    map.set(address, {
      address,
      totals: {
        jobsApplied: 0,
        jobsAssigned: 0,
        jobsCompleted: 0,
        jobsDisputed: 0,
        employerWins: 0,
        agentWins: 0,
        unknownResolutions: 0,
        revenues: web3.utils.toBN(0),
      },
    });
  }
  return map.get(address);
}

function ensureValidator(map, address) {
  if (!map.has(address)) {
    map.set(address, {
      address,
      validatorApprovals: 0,
      validatorDisapprovals: 0,
    });
  }
  return map.get(address);
}

function computeRate(numerator, denominator) {
  if (!denominator) return { value: 0, valueDecimals: 2 };
  return { value: Math.round((numerator / denominator) * 10000), valueDecimals: 2 };
}

module.exports = async function exportMetrics(callback) {
  try {
    const contractAddress = argValue("contract") || process.env.AGIJOBMANAGER_ADDRESS;
    if (!contractAddress) {
      throw new Error("Missing AGIJOBMANAGER_ADDRESS (or --contract)");
    }

    const fromBlockInput = argValue("from") || process.env.FROM_BLOCK || "0";
    const toBlockInput = argValue("to") || process.env.TO_BLOCK || "latest";
    const outDir = argValue("out-dir") || process.env.OUT_DIR || path.join("integrations", "erc8004", "output");
    const includeValidators = parseBoolean(argValue("include-validators") || process.env.INCLUDE_VALIDATORS, false);

    const fromBlockParsed = parseBlockNumber(fromBlockInput, "FROM_BLOCK");
    const toBlockParsed = parseBlockNumber(toBlockInput, "TO_BLOCK");

    if (fromBlockParsed === "latest") {
      throw new Error("FROM_BLOCK cannot be 'latest'. Provide a numeric start block.");
    }

    const latestBlock = await web3.eth.getBlockNumber();
    const toBlock = toBlockParsed === "latest" ? latestBlock : toBlockParsed;
    const fromBlock = fromBlockParsed === undefined ? 0 : fromBlockParsed;

    if (fromBlock > toBlock) {
      throw new Error(`FROM_BLOCK (${fromBlock}) is greater than TO_BLOCK (${toBlock}).`);
    }

    const networkId = await web3.eth.net.getId();
    const chainId = await web3.eth.getChainId();
    const networkName = process.env.TRUFFLE_NETWORK || process.env.NETWORK || "unknown";

    const agi = await AGIJobManager.at(contractAddress);
    const events = await agi.getPastEvents("allEvents", { fromBlock, toBlock });

    events.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.logIndex - b.logIndex;
    });

    const jobState = new Map();
    const agents = new Map();
    const validators = new Map();
    const warnings = [];

    for (const event of events) {
      const values = event.returnValues || {};
      switch (event.event) {
        case "JobCreated": {
          const jobId = String(values.jobId);
          const payout = web3.utils.toBN(values.payout || 0);
          const existing = jobState.get(jobId) || {};
          jobState.set(jobId, { ...existing, payout });
          break;
        }
        case "JobApplied": {
          const jobId = String(values.jobId);
          const agent = values.agent;
          if (!agent) break;
          const agentMetrics = ensureAgent(agents, agent, web3);
          agentMetrics.totals.jobsApplied += 1;
          agentMetrics.totals.jobsAssigned += 1;
          const existing = jobState.get(jobId) || { payout: web3.utils.toBN(0) };
          jobState.set(jobId, { ...existing, assignedAgent: agent });
          break;
        }
        case "JobCompleted": {
          const jobId = String(values.jobId);
          const agent = values.agent;
          if (!agent) break;
          const agentMetrics = ensureAgent(agents, agent, web3);
          agentMetrics.totals.jobsCompleted += 1;
          const job = jobState.get(jobId);
          if (job && job.payout) {
            agentMetrics.totals.revenues = agentMetrics.totals.revenues.add(job.payout);
          } else {
            warnings.push(`Missing payout for completed job ${jobId}.`);
          }
          break;
        }
        case "JobDisputed": {
          const jobId = String(values.jobId);
          const job = jobState.get(jobId);
          if (job && job.assignedAgent) {
            const agentMetrics = ensureAgent(agents, job.assignedAgent, web3);
            agentMetrics.totals.jobsDisputed += 1;
          } else {
            warnings.push(`Missing assigned agent for disputed job ${jobId}.`);
          }
          break;
        }
        case "DisputeResolved": {
          const jobId = String(values.jobId);
          const resolution = String(values.resolution || "").trim().toLowerCase();
          const job = jobState.get(jobId);
          if (job && job.assignedAgent) {
            const agentMetrics = ensureAgent(agents, job.assignedAgent, web3);
            if (resolution === "agent win") {
              agentMetrics.totals.agentWins += 1;
            } else if (resolution === "employer win") {
              agentMetrics.totals.employerWins += 1;
            } else {
              agentMetrics.totals.unknownResolutions += 1;
            }
          } else {
            warnings.push(`Missing assigned agent for resolved dispute on job ${jobId}.`);
          }
          break;
        }
        case "JobValidated": {
          if (!includeValidators) break;
          const validator = values.validator;
          if (!validator) break;
          const validatorMetrics = ensureValidator(validators, validator);
          validatorMetrics.validatorApprovals += 1;
          break;
        }
        case "JobDisapproved": {
          if (!includeValidators) break;
          const validator = values.validator;
          if (!validator) break;
          const validatorMetrics = ensureValidator(validators, validator);
          validatorMetrics.validatorDisapprovals += 1;
          break;
        }
        default:
          break;
      }
    }

    const agentList = Array.from(agents.values()).map((agent) => {
      const totals = agent.totals;
      const rates = {
        successRate: computeRate(totals.jobsCompleted, totals.jobsAssigned),
        disputeRate: computeRate(totals.jobsDisputed, totals.jobsAssigned),
      };
      return {
        address: agent.address,
        totals: {
          ...totals,
          revenues: { value: totals.revenues.toString(), valueDecimals: 0 },
        },
        rates,
      };
    });

    const validatorList = Array.from(validators.values());

    const output = {
      metadata: {
        chainId,
        networkId,
        network: networkName,
        fromBlock,
        toBlock,
        generatedAt: new Date().toISOString(),
        sourceContract: contractAddress,
        adapterVersion: "1.0",
      },
      warnings,
      agents: agentList,
      validators: validatorList,
    };

    fs.mkdirSync(outDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = path.join(outDir, `erc8004-metrics-${networkName}-${fromBlock}-${toBlock}-${timestamp}.json`);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

    console.log(`Exported metrics to ${outPath}`);
    callback();
  } catch (error) {
    console.error(error);
    callback(error);
  }
};
