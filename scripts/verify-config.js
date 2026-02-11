const fs = require("fs");
const path = require("path");
const Web3 = require("web3");
const TruffleContract = require("@truffle/contract");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--address" || arg === "-a") {
      args.address = argv[i + 1];
      i += 1;
    } else if (arg === "--config-path" || arg === "--config-file") {
      args.configPath = argv[i + 1];
      i += 1;
    } else if (arg === "--network") {
      args.network = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function toStringValue(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "bigint") return value.toString();
  if (value.toString) return value.toString();
  return String(value);
}

function parseEnvList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}


function hasMethod(instance, methodName) {
  return typeof instance?.[methodName] === "function";
}

function loadJsonConfig(configPath) {
  if (!configPath) return {};
  const resolved = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf8");
  return JSON.parse(raw);
}

function loadConfig(args) {
  const envConfigPath = process.env.AGI_CONFIG_PATH;
  const fileConfig = loadJsonConfig(args.configPath || envConfigPath);

  const envConfig = {
    requiredValidatorApprovals: process.env.AGI_REQUIRED_VALIDATOR_APPROVALS,
    requiredValidatorDisapprovals: process.env.AGI_REQUIRED_VALIDATOR_DISAPPROVALS,
    premiumReputationThreshold: process.env.AGI_PREMIUM_REPUTATION_THRESHOLD,
    validationRewardPercentage: process.env.AGI_VALIDATION_REWARD_PERCENTAGE,
    maxJobPayout: process.env.AGI_MAX_JOB_PAYOUT,
    jobDurationLimit: process.env.AGI_JOB_DURATION_LIMIT,
    completionReviewPeriod: process.env.AGI_COMPLETION_REVIEW_PERIOD,
    disputeReviewPeriod: process.env.AGI_DISPUTE_REVIEW_PERIOD,
    additionalAgentPayoutPercentage: process.env.AGI_ADDITIONAL_AGENT_PAYOUT_PERCENTAGE,
    termsAndConditionsIpfsHash: process.env.AGI_TERMS_AND_CONDITIONS_IPFS_HASH,
    contactEmail: process.env.AGI_CONTACT_EMAIL,
    additionalText1: process.env.AGI_ADDITIONAL_TEXT_1,
    additionalText2: process.env.AGI_ADDITIONAL_TEXT_2,
    additionalText3: process.env.AGI_ADDITIONAL_TEXT_3,
    validatorMerkleRoot: process.env.AGI_VALIDATOR_MERKLE_ROOT,
    agentMerkleRoot: process.env.AGI_AGENT_MERKLE_ROOT,
    moderators: process.env.AGI_MODERATORS ? parseEnvList(process.env.AGI_MODERATORS) : undefined,
    additionalValidators: process.env.AGI_ADDITIONAL_VALIDATORS
      ? parseEnvList(process.env.AGI_ADDITIONAL_VALIDATORS)
      : undefined,
    additionalAgents: process.env.AGI_ADDITIONAL_AGENTS ? parseEnvList(process.env.AGI_ADDITIONAL_AGENTS) : undefined,
    blacklistedAgents: process.env.AGI_BLACKLISTED_AGENTS
      ? parseEnvList(process.env.AGI_BLACKLISTED_AGENTS)
      : undefined,
    blacklistedValidators: process.env.AGI_BLACKLISTED_VALIDATORS
      ? parseEnvList(process.env.AGI_BLACKLISTED_VALIDATORS)
      : undefined,
    agiTypes: process.env.AGI_TYPES_JSON ? JSON.parse(process.env.AGI_TYPES_JSON) : undefined,
    expectedOwner: process.env.AGI_EXPECTED_OWNER,
  };

  return {
    ...fileConfig,
    ...Object.fromEntries(
      Object.entries(envConfig).filter(([, value]) => value !== undefined && value !== null)
    ),
  };
}

function resolveNetworkName(args) {
  if (args.network) return args.network;
  const networkIndex = process.argv.findIndex((value) => value === "--network");
  if (networkIndex !== -1) {
    return process.argv[networkIndex + 1];
  }
  return "development";
}

function resolveProvider(networkName) {
  const truffleConfig = require(path.join(__dirname, "..", "truffle-config"));
  const network = truffleConfig.networks?.[networkName];
  if (!network) {
    throw new Error(`Unknown Truffle network: ${networkName}`);
  }
  if (typeof network.provider === "function") {
    return network.provider();
  }
  if (network.provider) {
    return network.provider;
  }
  if (network.host && network.port) {
    return new Web3.providers.HttpProvider(`http://${network.host}:${network.port}`);
  }
  throw new Error(`Unable to resolve provider for network: ${networkName}`);
}

async function loadContract(address, networkName) {
  const provider = resolveProvider(networkName);
  const web3 = new Web3(provider);

  let Contract;
  if (global.artifacts?.require) {
    Contract = global.artifacts.require("AGIJobManager");
    Contract.setProvider(provider);
  } else {
    const artifactPath = path.join(__dirname, "..", "build", "contracts", "AGIJobManager.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    Contract = TruffleContract(artifact);
    Contract.setProvider(provider);
  }

  const instance = await Contract.at(address);
  return { instance, web3 };
}

async function fetchAgiTypes(instance) {
  const items = [];
  let index = 0;
  while (true) {
    try {
      const entry = await instance.agiTypes(index);
      items.push({
        nftAddress: entry.nftAddress,
        payoutPercentage: entry.payoutPercentage.toString(),
      });
      index += 1;
    } catch (error) {
      break;
    }
  }
  return items;
}

function normalizeAddress(address) {
  if (!address) return address;
  return address.toLowerCase();
}

function report(status, key, message) {
  console.log(`${status} ${key}: ${message}`);
  return status === "FAIL";
}

module.exports = async function verifyConfig(callback) {
  try {
    const args = parseArgs(process.argv);
    const config = loadConfig(args);

    const address = args.address || process.env.AGIJOBMANAGER_ADDRESS || config.address;
    if (!address) {
      throw new Error("Missing AGIJobManager address (--address or AGIJOBMANAGER_ADDRESS)");
    }

    const networkName = resolveNetworkName(args);
    const { instance } = await loadContract(address, networkName);

    let failed = false;

    const checks = [
      {
        key: "requiredValidatorApprovals",
        expected: config.requiredValidatorApprovals,
        actual: await instance.requiredValidatorApprovals(),
      },
      {
        key: "requiredValidatorDisapprovals",
        expected: config.requiredValidatorDisapprovals,
        actual: await instance.requiredValidatorDisapprovals(),
      },
      {
        key: "premiumReputationThreshold",
        expected: config.premiumReputationThreshold,
        actual: await instance.premiumReputationThreshold(),
      },
      {
        key: "validationRewardPercentage",
        expected: config.validationRewardPercentage,
        actual: await instance.validationRewardPercentage(),
      },
      {
        key: "maxJobPayout",
        expected: config.maxJobPayout,
        actual: await instance.maxJobPayout(),
      },
      {
        key: "jobDurationLimit",
        expected: config.jobDurationLimit,
        actual: await instance.jobDurationLimit(),
      },
      {
        key: "completionReviewPeriod",
        expected: config.completionReviewPeriod,
        actual: await instance.completionReviewPeriod(),
      },
      {
        key: "disputeReviewPeriod",
        expected: config.disputeReviewPeriod,
        actual: await instance.disputeReviewPeriod(),
      },
      ...(hasMethod(instance, "additionalAgentPayoutPercentage") ? [{
        key: "additionalAgentPayoutPercentage",
        expected: config.additionalAgentPayoutPercentage,
        actual: await instance.additionalAgentPayoutPercentage(),
      }] : []),
      ...(hasMethod(instance, "termsAndConditionsIpfsHash") ? [{
        key: "termsAndConditionsIpfsHash",
        expected: config.termsAndConditionsIpfsHash,
        actual: await instance.termsAndConditionsIpfsHash(),
      }] : []),
      ...(hasMethod(instance, "contactEmail") ? [{
        key: "contactEmail",
        expected: config.contactEmail,
        actual: await instance.contactEmail(),
      }] : []),
      ...(hasMethod(instance, "additionalText1") ? [{
        key: "additionalText1",
        expected: config.additionalText1,
        actual: await instance.additionalText1(),
      }] : []),
      ...(hasMethod(instance, "additionalText2") ? [{
        key: "additionalText2",
        expected: config.additionalText2,
        actual: await instance.additionalText2(),
      }] : []),
      ...(hasMethod(instance, "additionalText3") ? [{
        key: "additionalText3",
        expected: config.additionalText3,
        actual: await instance.additionalText3(),
      }] : []),
      {
        key: "validatorMerkleRoot",
        expected: config.validatorMerkleRoot,
        actual: await instance.validatorMerkleRoot(),
      },
      {
        key: "agentMerkleRoot",
        expected: config.agentMerkleRoot,
        actual: await instance.agentMerkleRoot(),
      },
    ];

    const skippedLegacyChecks = [];
    if (config.additionalAgentPayoutPercentage !== undefined && !hasMethod(instance, "additionalAgentPayoutPercentage")) {
      skippedLegacyChecks.push("additionalAgentPayoutPercentage");
    }
    if (config.termsAndConditionsIpfsHash !== undefined && !hasMethod(instance, "termsAndConditionsIpfsHash")) {
      skippedLegacyChecks.push("termsAndConditionsIpfsHash");
    }
    if (config.contactEmail !== undefined && !hasMethod(instance, "contactEmail")) {
      skippedLegacyChecks.push("contactEmail");
    }
    if (config.additionalText1 !== undefined && !hasMethod(instance, "additionalText1")) {
      skippedLegacyChecks.push("additionalText1");
    }
    if (config.additionalText2 !== undefined && !hasMethod(instance, "additionalText2")) {
      skippedLegacyChecks.push("additionalText2");
    }
    if (config.additionalText3 !== undefined && !hasMethod(instance, "additionalText3")) {
      skippedLegacyChecks.push("additionalText3");
    }
    if (skippedLegacyChecks.length > 0) {
      report("WARN", "legacy-config", `skipped unsupported keys: ${skippedLegacyChecks.join(", ")}`);
    }

    for (const check of checks) {
      if (check.expected === undefined) {
        continue;
      }
      const expected = toStringValue(check.expected);
      const actual = toStringValue(check.actual);
      if (expected === actual) {
        report("PASS", check.key, `${actual}`);
      } else {
        failed = report("FAIL", check.key, `expected ${expected}, got ${actual}`) || failed;
      }
    }

    if (config.expectedOwner) {
      const owner = await instance.owner();
      const expected = normalizeAddress(config.expectedOwner);
      const actual = normalizeAddress(owner);
      if (expected === actual) {
        report("PASS", "owner", `${owner}`);
      } else {
        failed = report("FAIL", "owner", `expected ${config.expectedOwner}, got ${owner}`) || failed;
      }
    }

    const listChecks = [
      { key: "moderators", list: config.moderators, check: (addr) => instance.moderators(addr) },
      {
        key: "additionalValidators",
        list: config.additionalValidators,
        check: (addr) => instance.additionalValidators(addr),
      },
      { key: "additionalAgents", list: config.additionalAgents, check: (addr) => instance.additionalAgents(addr) },
      { key: "blacklistedAgents", list: config.blacklistedAgents, check: (addr) => instance.blacklistedAgents(addr) },
      {
        key: "blacklistedValidators",
        list: config.blacklistedValidators,
        check: (addr) => instance.blacklistedValidators(addr),
      },
    ];

    for (const group of listChecks) {
      if (!Array.isArray(group.list)) continue;
      for (const addr of group.list) {
        if (!addr || addr === ZERO_ADDRESS) continue;
        const exists = await group.check(addr);
        if (exists) {
          report("PASS", `${group.key}:${addr}`, "present");
        } else {
          failed = report("FAIL", `${group.key}:${addr}`, "missing") || failed;
        }
      }
    }

    if (Array.isArray(config.agiTypes)) {
      const current = await fetchAgiTypes(instance);
      for (const entry of config.agiTypes) {
        if (!entry || !entry.nftAddress) continue;
        const expected = toStringValue(entry.payoutPercentage);
        const found = current.find(
          (item) => item.nftAddress.toLowerCase() === entry.nftAddress.toLowerCase()
        );
        if (found && found.payoutPercentage === expected) {
          report("PASS", `agiType:${entry.nftAddress}`, `payout ${expected}`);
        } else {
          failed = report(
            "FAIL",
            `agiType:${entry.nftAddress}`,
            `expected payout ${expected}, got ${found ? found.payoutPercentage : "missing"}`
          ) || failed;
        }
      }
    }

    if (failed) {
      process.exitCode = 1;
    }

    callback();
  } catch (error) {
    callback(error);
  }
};
