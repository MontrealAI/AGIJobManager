require("dotenv").config();
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function parseArgs(argv) {
  const args = { dryRun: false, fromBlock: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--address" || arg === "-a") {
      args.address = argv[i + 1];
      i += 1;
    } else if (arg === "--config") {
      args.configPath = argv[i + 1];
      i += 1;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
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

function coerceNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function coerceBigInt(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.floor(value));
  if (typeof value === "string") return BigInt(value);
  return undefined;
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
    newOwner: env.NEW_OWNER || config.newOwner,
    expectedAgiToken: env.AGI_TOKEN_ADDRESS || config.agiTokenAddress,
    expectedEns: env.ENS_ADDRESS || config.ensAddress,
    expectedNameWrapper: env.NAME_WRAPPER_ADDRESS || config.nameWrapperAddress,
    expectedClubRootNode: env.CLUB_ROOT_NODE || config.clubRootNode,
    expectedAgentRootNode: env.AGENT_ROOT_NODE || config.agentRootNode,
    expectedValidatorMerkleRoot: env.VALIDATOR_MERKLE_ROOT || config.validatorMerkleRoot,
    expectedAgentMerkleRoot: env.AGENT_MERKLE_ROOT || config.agentMerkleRoot,
    requiredValidatorApprovals: coerceNumber(env.REQUIRED_VALIDATOR_APPROVALS ?? config.requiredValidatorApprovals),
    requiredValidatorDisapprovals: coerceNumber(
      env.REQUIRED_VALIDATOR_DISAPPROVALS ?? config.requiredValidatorDisapprovals
    ),
    premiumReputationThreshold: coerceBigInt(env.PREMIUM_REPUTATION_THRESHOLD ?? config.premiumReputationThreshold),
    validationRewardPercentage: coerceNumber(env.VALIDATION_REWARD_PERCENTAGE ?? config.validationRewardPercentage),
    maxJobPayout: coerceBigInt(env.MAX_JOB_PAYOUT ?? config.maxJobPayout),
    jobDurationLimit: coerceBigInt(env.JOB_DURATION_LIMIT ?? config.jobDurationLimit),
    completionReviewPeriod: coerceBigInt(env.COMPLETION_REVIEW_PERIOD ?? config.completionReviewPeriod),
    disputeReviewPeriod: coerceBigInt(env.DISPUTE_REVIEW_PERIOD ?? config.disputeReviewPeriod),
    additionalAgentPayoutPercentage: coerceNumber(
      env.ADDITIONAL_AGENT_PAYOUT_PERCENTAGE ?? config.additionalAgentPayoutPercentage
    ),
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

async function collectCurrentConfig(instance) {
  const [
    owner,
    paused,
    agiToken,
    ens,
    nameWrapper,
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
    instance.paused(),
    instance.agiToken(),
    instance.ens(),
    instance.nameWrapper(),
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
    paused,
    agiToken,
    ens,
    nameWrapper,
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

function assertExpected(value, expected, label) {
  if (!expected) return;
  if (value.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${value}`);
  }
}

function assertExpectedBytes32(value, expected, label) {
  if (!expected) return;
  if (value.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${value}`);
  }
}

function planAction(actions, label, shouldRun, task, verify) {
  if (!shouldRun) return;
  actions.push({ label, task, verify });
}

async function sendAndVerify(action, dryRun, index, total) {
  console.log(`\n[${index + 1}/${total}] ${action.label}`);
  if (dryRun) {
    console.log("DRY RUN: skipping transaction.");
    return;
  }
  const receipt = await action.task();
  console.log(`tx hash: ${receipt.tx}`);
  if (action.verify) {
    await action.verify();
    console.log("verified.");
  }
}

function parseExpectedRoots(config) {
  return {
    clubRootNode: config.expectedClubRootNode,
    agentRootNode: config.expectedAgentRootNode,
    validatorMerkleRoot: config.expectedValidatorMerkleRoot,
    agentMerkleRoot: config.expectedAgentMerkleRoot,
  };
}

async function loadAgiTypesFromChain(instance, fromBlock) {
  const events = await instance.getPastEvents("AGITypeUpdated", { fromBlock, toBlock: "latest" });
  return loadAgiTypesFromEvents(events);
}

module.exports = async function postdeployConfig(callback) {
  try {
    const truffleArtifacts = global.artifacts || (typeof artifacts !== "undefined" ? artifacts : null);
    assert(truffleArtifacts, "This script must be run via truffle exec");

    const args = parseArgs(process.argv);
    const configFile = loadJsonConfig(args.configPath || process.env.CONFIG_PATH);
    const config = parseConfig(configFile);
    const address = normalizeAddress(args.address || config.address || process.env.AGIJOBMANAGER_ADDRESS);
    if (!address) {
      throw new Error("Missing AGIJobManager address (--address or AGIJOBMANAGER_ADDRESS)");
    }

    const AGIJobManager = truffleArtifacts.require("AGIJobManager");
    const instance = await AGIJobManager.at(address);
    const current = await collectCurrentConfig(instance);

    const expectedAgiToken = config.expectedAgiToken ? normalizeAddress(config.expectedAgiToken) : undefined;
    const expectedEns = config.expectedEns ? normalizeAddress(config.expectedEns) : undefined;
    const expectedNameWrapper = config.expectedNameWrapper ? normalizeAddress(config.expectedNameWrapper) : undefined;
    const expectedOwner = config.expectedOwner ? normalizeAddress(config.expectedOwner) : undefined;

    const [clubRootNode, agentRootNode, validatorMerkleRoot, agentMerkleRoot] = await Promise.all([
      instance.clubRootNode(),
      instance.agentRootNode(),
      instance.validatorMerkleRoot(),
      instance.agentMerkleRoot(),
    ]);

    const roots = parseExpectedRoots(config);
    assertExpected(instance.address, address, "contract address");
    assertExpected(current.owner, expectedOwner, "owner");
    assertExpected(current.agiToken, expectedAgiToken, "AGI token");
    assertExpected(current.ens, expectedEns, "ENS registry");
    assertExpected(current.nameWrapper, expectedNameWrapper, "NameWrapper");
    assertExpectedBytes32(clubRootNode, roots.clubRootNode, "clubRootNode");
    assertExpectedBytes32(agentRootNode, roots.agentRootNode, "agentRootNode");
    assertExpectedBytes32(validatorMerkleRoot, roots.validatorMerkleRoot, "validatorMerkleRoot");
    assertExpectedBytes32(agentMerkleRoot, roots.agentMerkleRoot, "agentMerkleRoot");

    const currentAgiTypes = await loadAgiTypesFromChain(instance, args.fromBlock);
    const configAgiTypes = config.agiTypes || [];
    const desiredMaxAgiTypePayout = Math.max(
      ...[0, ...Array.from(currentAgiTypes.values()), ...configAgiTypes.map((entry) => entry.payoutPercentage || 0)]
    );

    const desiredApprovals =
      config.requiredValidatorApprovals !== undefined
        ? BigInt(config.requiredValidatorApprovals)
        : current.requiredValidatorApprovals;
    const desiredDisapprovals =
      config.requiredValidatorDisapprovals !== undefined
        ? BigInt(config.requiredValidatorDisapprovals)
        : current.requiredValidatorDisapprovals;

    const maxValidators = current.maxValidators;
    if (
      desiredApprovals > maxValidators ||
      desiredDisapprovals > maxValidators ||
      desiredApprovals + desiredDisapprovals > maxValidators
    ) {
      throw new Error(
        `Validator thresholds invalid: approvals=${desiredApprovals} disapprovals=${desiredDisapprovals} MAX=${maxValidators}`
      );
    }

    const desiredValidationReward =
      config.validationRewardPercentage !== undefined
        ? config.validationRewardPercentage
        : current.validationRewardPercentage;

    if (desiredValidationReward + desiredMaxAgiTypePayout > 100) {
      throw new Error(
        `validationRewardPercentage (${desiredValidationReward}) + max AGI type payout (${desiredMaxAgiTypePayout}) must be <= 100`
      );
    }

    const desiredAdditionalAgentPayout =
      config.additionalAgentPayoutPercentage !== undefined
        ? config.additionalAgentPayoutPercentage
        : current.additionalAgentPayoutPercentage;

    if (desiredAdditionalAgentPayout > 100 - desiredValidationReward) {
      throw new Error(
        `additionalAgentPayoutPercentage (${desiredAdditionalAgentPayout}) must be <= ${100 - desiredValidationReward}`
      );
    }

    const actions = [];

    if (config.requiredValidatorApprovals !== undefined || config.requiredValidatorDisapprovals !== undefined) {
      const approvalsChanged = desiredApprovals !== current.requiredValidatorApprovals;
      const disapprovalsChanged = desiredDisapprovals !== current.requiredValidatorDisapprovals;
      if (approvalsChanged && disapprovalsChanged) {
        if (desiredApprovals + current.requiredValidatorDisapprovals <= maxValidators) {
          planAction(
            actions,
            "setRequiredValidatorApprovals",
            true,
            async () => instance.setRequiredValidatorApprovals(desiredApprovals.toString()),
            async () => {
              const value = await instance.requiredValidatorApprovals();
              if (BigInt(value.toString()) !== desiredApprovals) {
                throw new Error("requiredValidatorApprovals mismatch");
              }
            }
          );
          planAction(
            actions,
            "setRequiredValidatorDisapprovals",
            true,
            async () => instance.setRequiredValidatorDisapprovals(desiredDisapprovals.toString()),
            async () => {
              const value = await instance.requiredValidatorDisapprovals();
              if (BigInt(value.toString()) !== desiredDisapprovals) {
                throw new Error("requiredValidatorDisapprovals mismatch");
              }
            }
          );
        } else if (current.requiredValidatorApprovals + desiredDisapprovals <= maxValidators) {
          planAction(
            actions,
            "setRequiredValidatorDisapprovals",
            true,
            async () => instance.setRequiredValidatorDisapprovals(desiredDisapprovals.toString()),
            async () => {
              const value = await instance.requiredValidatorDisapprovals();
              if (BigInt(value.toString()) !== desiredDisapprovals) {
                throw new Error("requiredValidatorDisapprovals mismatch");
              }
            }
          );
          planAction(
            actions,
            "setRequiredValidatorApprovals",
            true,
            async () => instance.setRequiredValidatorApprovals(desiredApprovals.toString()),
            async () => {
              const value = await instance.requiredValidatorApprovals();
              if (BigInt(value.toString()) !== desiredApprovals) {
                throw new Error("requiredValidatorApprovals mismatch");
              }
            }
          );
        } else {
          throw new Error("Cannot update validator thresholds without intermediate invalid state.");
        }
      } else {
        planAction(
          actions,
          "setRequiredValidatorApprovals",
          approvalsChanged,
          async () => instance.setRequiredValidatorApprovals(desiredApprovals.toString()),
          async () => {
            const value = await instance.requiredValidatorApprovals();
            if (BigInt(value.toString()) !== desiredApprovals) {
              throw new Error("requiredValidatorApprovals mismatch");
            }
          }
        );
        planAction(
          actions,
          "setRequiredValidatorDisapprovals",
          disapprovalsChanged,
          async () => instance.setRequiredValidatorDisapprovals(desiredDisapprovals.toString()),
          async () => {
            const value = await instance.requiredValidatorDisapprovals();
            if (BigInt(value.toString()) !== desiredDisapprovals) {
              throw new Error("requiredValidatorDisapprovals mismatch");
            }
          }
        );
      }
    }

    planAction(
      actions,
      "updateAGITokenAddress",
      expectedAgiToken && current.agiToken.toLowerCase() !== expectedAgiToken.toLowerCase(),
      async () => instance.updateAGITokenAddress(expectedAgiToken),
      async () => {
        const value = await instance.agiToken();
        assertExpected(value, expectedAgiToken, "AGI token");
      }
    );

    planAction(
      actions,
      "setPremiumReputationThreshold",
      config.premiumReputationThreshold !== undefined && config.premiumReputationThreshold !== current.premiumReputationThreshold,
      async () => instance.setPremiumReputationThreshold(config.premiumReputationThreshold.toString()),
      async () => {
        const value = await instance.premiumReputationThreshold();
        if (BigInt(value.toString()) !== config.premiumReputationThreshold) {
          throw new Error("premiumReputationThreshold mismatch");
        }
      }
    );

    planAction(
      actions,
      "setMaxJobPayout",
      config.maxJobPayout !== undefined && config.maxJobPayout !== current.maxJobPayout,
      async () => instance.setMaxJobPayout(config.maxJobPayout.toString()),
      async () => {
        const value = await instance.maxJobPayout();
        if (BigInt(value.toString()) !== config.maxJobPayout) {
          throw new Error("maxJobPayout mismatch");
        }
      }
    );

    planAction(
      actions,
      "setJobDurationLimit",
      config.jobDurationLimit !== undefined && config.jobDurationLimit !== current.jobDurationLimit,
      async () => instance.setJobDurationLimit(config.jobDurationLimit.toString()),
      async () => {
        const value = await instance.jobDurationLimit();
        if (BigInt(value.toString()) !== config.jobDurationLimit) {
          throw new Error("jobDurationLimit mismatch");
        }
      }
    );

    planAction(
      actions,
      "setCompletionReviewPeriod",
      config.completionReviewPeriod !== undefined && config.completionReviewPeriod !== current.completionReviewPeriod,
      async () => instance.setCompletionReviewPeriod(config.completionReviewPeriod.toString()),
      async () => {
        const value = await instance.completionReviewPeriod();
        if (BigInt(value.toString()) !== config.completionReviewPeriod) {
          throw new Error("completionReviewPeriod mismatch");
        }
      }
    );

    planAction(
      actions,
      "setDisputeReviewPeriod",
      config.disputeReviewPeriod !== undefined && config.disputeReviewPeriod !== current.disputeReviewPeriod,
      async () => instance.setDisputeReviewPeriod(config.disputeReviewPeriod.toString()),
      async () => {
        const value = await instance.disputeReviewPeriod();
        if (BigInt(value.toString()) !== config.disputeReviewPeriod) {
          throw new Error("disputeReviewPeriod mismatch");
        }
      }
    );

    const agiTypeActions = [];
    for (const entry of configAgiTypes) {
      const existing = currentAgiTypes.get(entry.nftAddress.toLowerCase());
      if (existing === entry.payoutPercentage) continue;
      agiTypeActions.push({
        label: `addAGIType ${entry.nftAddress} -> ${entry.payoutPercentage}`,
        task: async () => instance.addAGIType(entry.nftAddress, entry.payoutPercentage),
        verify: async () => {
          const updatedEvents = await instance.getPastEvents("AGITypeUpdated", { fromBlock: args.fromBlock, toBlock: "latest" });
          const updated = loadAgiTypesFromEvents(updatedEvents);
          const updatedValue = updated.get(entry.nftAddress.toLowerCase());
          if (updatedValue !== entry.payoutPercentage) {
            throw new Error(`AGI type payout mismatch for ${entry.nftAddress}`);
          }
        },
      });
    }

    actions.push(...agiTypeActions);

    planAction(
      actions,
      "setValidationRewardPercentage",
      config.validationRewardPercentage !== undefined && config.validationRewardPercentage !== current.validationRewardPercentage,
      async () => instance.setValidationRewardPercentage(config.validationRewardPercentage),
      async () => {
        const value = await instance.validationRewardPercentage();
        if (Number(value) !== config.validationRewardPercentage) {
          throw new Error("validationRewardPercentage mismatch");
        }
      }
    );

    planAction(
      actions,
      "setAdditionalAgentPayoutPercentage",
      config.additionalAgentPayoutPercentage !== undefined &&
        config.additionalAgentPayoutPercentage !== current.additionalAgentPayoutPercentage,
      async () => instance.setAdditionalAgentPayoutPercentage(config.additionalAgentPayoutPercentage),
      async () => {
        const value = await instance.additionalAgentPayoutPercentage();
        if (Number(value) !== config.additionalAgentPayoutPercentage) {
          throw new Error("additionalAgentPayoutPercentage mismatch");
        }
      }
    );

    planAction(
      actions,
      "updateTermsAndConditionsIpfsHash",
      config.termsAndConditionsIpfsHash !== undefined &&
        config.termsAndConditionsIpfsHash !== current.termsAndConditionsIpfsHash,
      async () => instance.updateTermsAndConditionsIpfsHash(config.termsAndConditionsIpfsHash),
      async () => {
        const value = await instance.termsAndConditionsIpfsHash();
        if (value !== config.termsAndConditionsIpfsHash) {
          throw new Error("termsAndConditionsIpfsHash mismatch");
        }
      }
    );

    planAction(
      actions,
      "updateContactEmail",
      config.contactEmail !== undefined && config.contactEmail !== current.contactEmail,
      async () => instance.updateContactEmail(config.contactEmail),
      async () => {
        const value = await instance.contactEmail();
        if (value !== config.contactEmail) {
          throw new Error("contactEmail mismatch");
        }
      }
    );

    planAction(
      actions,
      "updateAdditionalText1",
      config.additionalText1 !== undefined && config.additionalText1 !== current.additionalText1,
      async () => instance.updateAdditionalText1(config.additionalText1),
      async () => {
        const value = await instance.additionalText1();
        if (value !== config.additionalText1) {
          throw new Error("additionalText1 mismatch");
        }
      }
    );

    planAction(
      actions,
      "updateAdditionalText2",
      config.additionalText2 !== undefined && config.additionalText2 !== current.additionalText2,
      async () => instance.updateAdditionalText2(config.additionalText2),
      async () => {
        const value = await instance.additionalText2();
        if (value !== config.additionalText2) {
          throw new Error("additionalText2 mismatch");
        }
      }
    );

    planAction(
      actions,
      "updateAdditionalText3",
      config.additionalText3 !== undefined && config.additionalText3 !== current.additionalText3,
      async () => instance.updateAdditionalText3(config.additionalText3),
      async () => {
        const value = await instance.additionalText3();
        if (value !== config.additionalText3) {
          throw new Error("additionalText3 mismatch");
        }
      }
    );

    for (const moderator of config.moderators) {
      planAction(
        actions,
        `addModerator ${moderator}`,
        !(await instance.moderators(moderator)),
        async () => instance.addModerator(moderator),
        async () => {
          const value = await instance.moderators(moderator);
          if (!value) throw new Error(`moderator not set: ${moderator}`);
        }
      );
    }

    for (const validator of config.additionalValidators) {
      planAction(
        actions,
        `addAdditionalValidator ${validator}`,
        !(await instance.additionalValidators(validator)),
        async () => instance.addAdditionalValidator(validator),
        async () => {
          const value = await instance.additionalValidators(validator);
          if (!value) throw new Error(`additional validator not set: ${validator}`);
        }
      );
    }

    for (const agent of config.additionalAgents) {
      planAction(
        actions,
        `addAdditionalAgent ${agent}`,
        !(await instance.additionalAgents(agent)),
        async () => instance.addAdditionalAgent(agent),
        async () => {
          const value = await instance.additionalAgents(agent);
          if (!value) throw new Error(`additional agent not set: ${agent}`);
        }
      );
    }

    for (const agent of config.blacklistedAgents) {
      planAction(
        actions,
        `blacklistAgent ${agent}`,
        !(await instance.blacklistedAgents(agent)),
        async () => instance.blacklistAgent(agent, true),
        async () => {
          const value = await instance.blacklistedAgents(agent);
          if (!value) throw new Error(`blacklisted agent not set: ${agent}`);
        }
      );
    }

    for (const validator of config.blacklistedValidators) {
      planAction(
        actions,
        `blacklistValidator ${validator}`,
        !(await instance.blacklistedValidators(validator)),
        async () => instance.blacklistValidator(validator, true),
        async () => {
          const value = await instance.blacklistedValidators(validator);
          if (!value) throw new Error(`blacklisted validator not set: ${validator}`);
        }
      );
    }

    if (config.newOwner && config.newOwner !== ZERO_ADDRESS) {
      const newOwner = normalizeAddress(config.newOwner);
      planAction(
        actions,
        `transferOwnership ${newOwner}`,
        current.owner.toLowerCase() !== newOwner.toLowerCase(),
        async () => instance.transferOwnership(newOwner),
        async () => {
          const value = await instance.owner();
          if (value.toLowerCase() !== newOwner.toLowerCase()) {
            throw new Error("ownership transfer failed");
          }
        }
      );
    }

    console.log("Post-deploy configuration plan:");
    console.log(`- contract: ${address}`);
    console.log(`- owner: ${current.owner}`);
    console.log(`- paused: ${current.paused}`);
    console.log(`- actions: ${actions.length}`);
    for (const action of actions) {
      console.log(`  - ${action.label}`);
    }

    for (let i = 0; i < actions.length; i += 1) {
      await sendAndVerify(actions[i], args.dryRun, i, actions.length);
    }

    console.log("Done.");
    callback();
  } catch (error) {
    callback(error);
  }
};
