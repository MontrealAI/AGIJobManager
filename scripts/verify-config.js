require("dotenv").config();
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const CHECK = {
  PASS: "PASS",
  FAIL: "FAIL",
};

function parseArgs(argv) {
  const args = { fromBlock: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--address" || arg === "-a") {
      args.address = argv[i + 1];
      i += 1;
    } else if (arg === "--config") {
      args.configPath = argv[i + 1];
      i += 1;
    } else if (arg === "--from-block") {
      args.fromBlock = Number(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

function loadJsonConfig(configPath) {
  if (!configPath) return {};
  const resolved = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function toAddressList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeAddress(address) {
  if (!address) return undefined;
  if (!web3.utils.isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return web3.utils.toChecksumAddress(address);
}

function normalizeAddressList(list) {
  const normalized = list.map(normalizeAddress);
  return [...new Set(normalized)];
}

function loadAgiTypesFromEvents(events) {
  const map = new Map();
  for (const event of events) {
    map.set(event.returnValues.nftAddress.toLowerCase(), Number(event.returnValues.payoutPercentage));
  }
  return map;
}

function resultLine(key, status, detail) {
  const prefix = status === CHECK.PASS ? "PASS" : "FAIL";
  return `${prefix} ${key}${detail ? `: ${detail}` : ""}`;
}

function parseConfig(config) {
  const env = process.env;
  const agiTypesRaw = env.AGI_TYPES || config.agiTypes;
  let agiTypes = [];
  if (agiTypesRaw) {
    agiTypes = typeof agiTypesRaw === "string" ? JSON.parse(agiTypesRaw) : agiTypesRaw;
  }
  return {
    address: env.AGIJOBMANAGER_ADDRESS || config.address,
    expectedOwner: env.EXPECTED_OWNER || config.expectedOwner,
    agiTokenAddress: env.AGI_TOKEN_ADDRESS || config.agiTokenAddress,
    ensAddress: env.ENS_ADDRESS || config.ensAddress,
    nameWrapperAddress: env.NAME_WRAPPER_ADDRESS || config.nameWrapperAddress,
    clubRootNode: env.CLUB_ROOT_NODE || config.clubRootNode,
    agentRootNode: env.AGENT_ROOT_NODE || config.agentRootNode,
    validatorMerkleRoot: env.VALIDATOR_MERKLE_ROOT || config.validatorMerkleRoot,
    agentMerkleRoot: env.AGENT_MERKLE_ROOT || config.agentMerkleRoot,
    requiredValidatorApprovals: env.REQUIRED_VALIDATOR_APPROVALS ?? config.requiredValidatorApprovals,
    requiredValidatorDisapprovals: env.REQUIRED_VALIDATOR_DISAPPROVALS ?? config.requiredValidatorDisapprovals,
    premiumReputationThreshold: env.PREMIUM_REPUTATION_THRESHOLD ?? config.premiumReputationThreshold,
    validationRewardPercentage: env.VALIDATION_REWARD_PERCENTAGE ?? config.validationRewardPercentage,
    maxJobPayout: env.MAX_JOB_PAYOUT ?? config.maxJobPayout,
    jobDurationLimit: env.JOB_DURATION_LIMIT ?? config.jobDurationLimit,
    completionReviewPeriod: env.COMPLETION_REVIEW_PERIOD ?? config.completionReviewPeriod,
    disputeReviewPeriod: env.DISPUTE_REVIEW_PERIOD ?? config.disputeReviewPeriod,
    additionalAgentPayoutPercentage: env.ADDITIONAL_AGENT_PAYOUT_PERCENTAGE ?? config.additionalAgentPayoutPercentage,
    termsAndConditionsIpfsHash: env.TERMS_IPFS_HASH ?? config.termsAndConditionsIpfsHash,
    contactEmail: env.CONTACT_EMAIL ?? config.contactEmail,
    additionalText1: env.ADDITIONAL_TEXT1 ?? config.additionalText1,
    additionalText2: env.ADDITIONAL_TEXT2 ?? config.additionalText2,
    additionalText3: env.ADDITIONAL_TEXT3 ?? config.additionalText3,
    moderators: normalizeAddressList(toAddressList(env.MODERATORS ?? config.moderators)),
    additionalValidators: normalizeAddressList(toAddressList(env.ADDITIONAL_VALIDATORS ?? config.additionalValidators)),
    additionalAgents: normalizeAddressList(toAddressList(env.ADDITIONAL_AGENTS ?? config.additionalAgents)),
    blacklistedAgents: normalizeAddressList(toAddressList(env.BLACKLISTED_AGENTS ?? config.blacklistedAgents)),
    blacklistedValidators: normalizeAddressList(toAddressList(env.BLACKLISTED_VALIDATORS ?? config.blacklistedValidators)),
    agiTypes: (agiTypes || []).map((entry) => ({
      nftAddress: normalizeAddress(entry.nftAddress),
      payoutPercentage: Number(entry.payoutPercentage),
    })),
  };
}

function compareAddress(actual, expected) {
  if (!expected) return { status: CHECK.PASS, detail: "(skipped)" };
  return actual.toLowerCase() === expected.toLowerCase()
    ? { status: CHECK.PASS }
    : { status: CHECK.FAIL, detail: `expected ${expected} got ${actual}` };
}

function compareBytes32(actual, expected) {
  if (!expected) return { status: CHECK.PASS, detail: "(skipped)" };
  return actual.toLowerCase() === expected.toLowerCase()
    ? { status: CHECK.PASS }
    : { status: CHECK.FAIL, detail: `expected ${expected} got ${actual}` };
}

function compareBigInt(actual, expected) {
  if (expected === undefined || expected === null || expected === "") {
    return { status: CHECK.PASS, detail: "(skipped)" };
  }
  const expectedBig = BigInt(expected.toString());
  return actual === expectedBig
    ? { status: CHECK.PASS }
    : { status: CHECK.FAIL, detail: `expected ${expectedBig.toString()} got ${actual.toString()}` };
}

function compareNumber(actual, expected) {
  if (expected === undefined || expected === null || expected === "") {
    return { status: CHECK.PASS, detail: "(skipped)" };
  }
  const expectedNum = Number(expected);
  return actual === expectedNum
    ? { status: CHECK.PASS }
    : { status: CHECK.FAIL, detail: `expected ${expectedNum} got ${actual}` };
}

async function fetchCurrent(instance) {
  const [
    owner,
    agiToken,
    ens,
    nameWrapper,
    clubRootNode,
    agentRootNode,
    validatorMerkleRoot,
    agentMerkleRoot,
    requiredValidatorApprovals,
    requiredValidatorDisapprovals,
    premiumReputationThreshold,
    validationRewardPercentage,
    maxJobPayout,
    jobDurationLimit,
    completionReviewPeriod,
    disputeReviewPeriod,
    additionalAgentPayoutPercentage,
    termsAndConditionsIpfsHash,
    contactEmail,
    additionalText1,
    additionalText2,
    additionalText3,
    maxValidators,
  ] = await Promise.all([
    instance.owner(),
    instance.agiToken(),
    instance.ens(),
    instance.nameWrapper(),
    instance.clubRootNode(),
    instance.agentRootNode(),
    instance.validatorMerkleRoot(),
    instance.agentMerkleRoot(),
    instance.requiredValidatorApprovals(),
    instance.requiredValidatorDisapprovals(),
    instance.premiumReputationThreshold(),
    instance.validationRewardPercentage(),
    instance.maxJobPayout(),
    instance.jobDurationLimit(),
    instance.completionReviewPeriod(),
    instance.disputeReviewPeriod(),
    instance.additionalAgentPayoutPercentage(),
    instance.termsAndConditionsIpfsHash(),
    instance.contactEmail(),
    instance.additionalText1(),
    instance.additionalText2(),
    instance.additionalText3(),
    instance.MAX_VALIDATORS_PER_JOB(),
  ]);

  return {
    owner,
    agiToken,
    ens,
    nameWrapper,
    clubRootNode,
    agentRootNode,
    validatorMerkleRoot,
    agentMerkleRoot,
    requiredValidatorApprovals: BigInt(requiredValidatorApprovals.toString()),
    requiredValidatorDisapprovals: BigInt(requiredValidatorDisapprovals.toString()),
    premiumReputationThreshold: BigInt(premiumReputationThreshold.toString()),
    validationRewardPercentage: Number(validationRewardPercentage),
    maxJobPayout: BigInt(maxJobPayout.toString()),
    jobDurationLimit: BigInt(jobDurationLimit.toString()),
    completionReviewPeriod: BigInt(completionReviewPeriod.toString()),
    disputeReviewPeriod: BigInt(disputeReviewPeriod.toString()),
    additionalAgentPayoutPercentage: Number(additionalAgentPayoutPercentage),
    termsAndConditionsIpfsHash,
    contactEmail,
    additionalText1,
    additionalText2,
    additionalText3,
    maxValidators: BigInt(maxValidators.toString()),
  };
}

module.exports = async function verifyConfig(callback) {
  try {
    const truffleArtifacts = global.artifacts || (typeof artifacts !== "undefined" ? artifacts : null);
    assert(truffleArtifacts, "This script must be run via truffle exec");

    const args = parseArgs(process.argv);
    const configFile = loadJsonConfig(args.configPath || process.env.CONFIG_PATH);
    const config = parseConfig(configFile);
    const address = normalizeAddress(args.address || config.address);
    if (!address) {
      throw new Error("Missing AGIJobManager address (--address or AGIJOBMANAGER_ADDRESS)");
    }

    const AGIJobManager = truffleArtifacts.require("AGIJobManager");
    const instance = await AGIJobManager.at(address);
    const current = await fetchCurrent(instance);

    const results = [];
    results.push({ key: "owner", ...compareAddress(current.owner, config.expectedOwner) });
    results.push({ key: "agiToken", ...compareAddress(current.agiToken, config.agiTokenAddress) });
    results.push({ key: "ens", ...compareAddress(current.ens, config.ensAddress) });
    results.push({ key: "nameWrapper", ...compareAddress(current.nameWrapper, config.nameWrapperAddress) });
    results.push({ key: "clubRootNode", ...compareBytes32(current.clubRootNode, config.clubRootNode) });
    results.push({ key: "agentRootNode", ...compareBytes32(current.agentRootNode, config.agentRootNode) });
    results.push({ key: "validatorMerkleRoot", ...compareBytes32(current.validatorMerkleRoot, config.validatorMerkleRoot) });
    results.push({ key: "agentMerkleRoot", ...compareBytes32(current.agentMerkleRoot, config.agentMerkleRoot) });
    results.push({
      key: "requiredValidatorApprovals",
      ...compareBigInt(current.requiredValidatorApprovals, config.requiredValidatorApprovals),
    });
    results.push({
      key: "requiredValidatorDisapprovals",
      ...compareBigInt(current.requiredValidatorDisapprovals, config.requiredValidatorDisapprovals),
    });
    results.push({
      key: "premiumReputationThreshold",
      ...compareBigInt(current.premiumReputationThreshold, config.premiumReputationThreshold),
    });
    results.push({
      key: "validationRewardPercentage",
      ...compareNumber(current.validationRewardPercentage, config.validationRewardPercentage),
    });
    results.push({ key: "maxJobPayout", ...compareBigInt(current.maxJobPayout, config.maxJobPayout) });
    results.push({ key: "jobDurationLimit", ...compareBigInt(current.jobDurationLimit, config.jobDurationLimit) });
    results.push({
      key: "completionReviewPeriod",
      ...compareBigInt(current.completionReviewPeriod, config.completionReviewPeriod),
    });
    results.push({
      key: "disputeReviewPeriod",
      ...compareBigInt(current.disputeReviewPeriod, config.disputeReviewPeriod),
    });
    results.push({
      key: "additionalAgentPayoutPercentage",
      ...compareNumber(current.additionalAgentPayoutPercentage, config.additionalAgentPayoutPercentage),
    });
    results.push({
      key: "termsAndConditionsIpfsHash",
      status:
        config.termsAndConditionsIpfsHash === undefined ||
        config.termsAndConditionsIpfsHash === null ||
        config.termsAndConditionsIpfsHash === ""
          ? CHECK.PASS
          : current.termsAndConditionsIpfsHash === config.termsAndConditionsIpfsHash
            ? CHECK.PASS
            : CHECK.FAIL,
      detail:
        config.termsAndConditionsIpfsHash && current.termsAndConditionsIpfsHash !== config.termsAndConditionsIpfsHash
          ? `expected ${config.termsAndConditionsIpfsHash} got ${current.termsAndConditionsIpfsHash}`
          : undefined,
    });
    results.push({
      key: "contactEmail",
      status:
        config.contactEmail === undefined || config.contactEmail === null || config.contactEmail === ""
          ? CHECK.PASS
          : current.contactEmail === config.contactEmail
            ? CHECK.PASS
            : CHECK.FAIL,
      detail:
        config.contactEmail && current.contactEmail !== config.contactEmail
          ? `expected ${config.contactEmail} got ${current.contactEmail}`
          : undefined,
    });
    results.push({
      key: "additionalText1",
      status:
        config.additionalText1 === undefined || config.additionalText1 === null || config.additionalText1 === ""
          ? CHECK.PASS
          : current.additionalText1 === config.additionalText1
            ? CHECK.PASS
            : CHECK.FAIL,
      detail:
        config.additionalText1 && current.additionalText1 !== config.additionalText1
          ? `expected ${config.additionalText1} got ${current.additionalText1}`
          : undefined,
    });
    results.push({
      key: "additionalText2",
      status:
        config.additionalText2 === undefined || config.additionalText2 === null || config.additionalText2 === ""
          ? CHECK.PASS
          : current.additionalText2 === config.additionalText2
            ? CHECK.PASS
            : CHECK.FAIL,
      detail:
        config.additionalText2 && current.additionalText2 !== config.additionalText2
          ? `expected ${config.additionalText2} got ${current.additionalText2}`
          : undefined,
    });
    results.push({
      key: "additionalText3",
      status:
        config.additionalText3 === undefined || config.additionalText3 === null || config.additionalText3 === ""
          ? CHECK.PASS
          : current.additionalText3 === config.additionalText3
            ? CHECK.PASS
            : CHECK.FAIL,
      detail:
        config.additionalText3 && current.additionalText3 !== config.additionalText3
          ? `expected ${config.additionalText3} got ${current.additionalText3}`
          : undefined,
    });

    const moderatorChecks = [];
    for (const moderator of config.moderators) {
      moderatorChecks.push({ key: `moderator:${moderator}`, value: await instance.moderators(moderator) });
    }
    for (const check of moderatorChecks) {
      results.push({
        key: check.key,
        status: check.value ? CHECK.PASS : CHECK.FAIL,
        detail: check.value ? undefined : "expected true",
      });
    }

    const additionalValidatorChecks = [];
    for (const validator of config.additionalValidators) {
      additionalValidatorChecks.push({
        key: `additionalValidator:${validator}`,
        value: await instance.additionalValidators(validator),
      });
    }
    for (const check of additionalValidatorChecks) {
      results.push({
        key: check.key,
        status: check.value ? CHECK.PASS : CHECK.FAIL,
        detail: check.value ? undefined : "expected true",
      });
    }

    const additionalAgentChecks = [];
    for (const agent of config.additionalAgents) {
      additionalAgentChecks.push({
        key: `additionalAgent:${agent}`,
        value: await instance.additionalAgents(agent),
      });
    }
    for (const check of additionalAgentChecks) {
      results.push({
        key: check.key,
        status: check.value ? CHECK.PASS : CHECK.FAIL,
        detail: check.value ? undefined : "expected true",
      });
    }

    const blacklistedAgentChecks = [];
    for (const agent of config.blacklistedAgents) {
      blacklistedAgentChecks.push({
        key: `blacklistedAgent:${agent}`,
        value: await instance.blacklistedAgents(agent),
      });
    }
    for (const check of blacklistedAgentChecks) {
      results.push({
        key: check.key,
        status: check.value ? CHECK.PASS : CHECK.FAIL,
        detail: check.value ? undefined : "expected true",
      });
    }

    const blacklistedValidatorChecks = [];
    for (const validator of config.blacklistedValidators) {
      blacklistedValidatorChecks.push({
        key: `blacklistedValidator:${validator}`,
        value: await instance.blacklistedValidators(validator),
      });
    }
    for (const check of blacklistedValidatorChecks) {
      results.push({
        key: check.key,
        status: check.value ? CHECK.PASS : CHECK.FAIL,
        detail: check.value ? undefined : "expected true",
      });
    }

    if (config.agiTypes.length > 0) {
      const events = await instance.getPastEvents("AGITypeUpdated", { fromBlock: args.fromBlock, toBlock: "latest" });
      const agiTypes = loadAgiTypesFromEvents(events);
      for (const entry of config.agiTypes) {
        const value = agiTypes.get(entry.nftAddress.toLowerCase());
        results.push({
          key: `agiType:${entry.nftAddress}`,
          status: value === entry.payoutPercentage ? CHECK.PASS : CHECK.FAIL,
          detail: value === entry.payoutPercentage ? undefined : `expected ${entry.payoutPercentage} got ${value}`,
        });
      }
    }

    const invalidThresholds =
      current.requiredValidatorApprovals > current.maxValidators ||
      current.requiredValidatorDisapprovals > current.maxValidators ||
      current.requiredValidatorApprovals + current.requiredValidatorDisapprovals > current.maxValidators;

    results.push({
      key: "validatorThresholds",
      status: invalidThresholds ? CHECK.FAIL : CHECK.PASS,
      detail: invalidThresholds ? "thresholds exceed MAX_VALIDATORS_PER_JOB" : undefined,
    });

    for (const result of results) {
      console.log(resultLine(result.key, result.status, result.detail));
    }

    const failed = results.filter((result) => result.status === CHECK.FAIL);
    if (failed.length > 0) {
      process.exitCode = 1;
    }

    callback();
  } catch (error) {
    callback(error);
  }
};
