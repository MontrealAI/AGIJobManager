const fs = require("fs");
const path = require("path");
const { loadManager, fetchAgiTypes, cliCallback } = require("./lib/operations");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--address" || arg === "-a") {
      args.address = argv[i + 1];
      i += 1;
    } else if (arg === "--config-path" || arg === "--config-file") {
      args.configPath = argv[i + 1];
      i += 1;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--from-block") {
      args.fromBlock = Number(argv[i + 1]);
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


function hasMethod(instance, name) {
  return typeof instance[name] === "function";
}

function parseEnvList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
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

function parseNftRequirement(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error('agentNftRequired / AGI_AGENT_NFT_REQUIRED must be true or false.');
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
    transferOwnershipTo: process.env.AGI_TRANSFER_OWNERSHIP_TO,
    agentNftRequired: process.env.AGI_AGENT_NFT_REQUIRED === undefined ? undefined : parseNftRequirement(process.env.AGI_AGENT_NFT_REQUIRED),
    agiTypes: process.env.AGI_TYPES_JSON ? JSON.parse(process.env.AGI_TYPES_JSON) : undefined,
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

async function ensureAgiType(instance, configEntry) {
  const current = await fetchAgiTypes(instance);
  const currentEntry = current.find(
    (item) => item.nftAddress.toLowerCase() === configEntry.nftAddress.toLowerCase()
  );
  if (currentEntry && currentEntry.payoutPercentage === toStringValue(configEntry.payoutPercentage)) {
    return { needsUpdate: false, currentEntry };
  }
  return { needsUpdate: true, currentEntry };
}

async function runTx(op, dryRun) {
  console.log(`- ${op.label}`);
  if (dryRun) {
    return;
  }
  const transaction = await op.send();
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Transaction failed: ${transaction.hash}`);
  console.log(`  tx: ${transaction.hash}`);
  await op.verify();
}

function normalizeAddress(address) {
  if (!address) return address;
  return address.toLowerCase();
}

module.exports = async function postdeployConfig(callback) {
  let provider;
  try {
    const args = parseArgs(process.argv);
    const config = loadConfig(args);
    if (config.agentNftRequired !== undefined) config.agentNftRequired = parseNftRequirement(config.agentNftRequired);

    const address = args.address || process.env.AGIJOBMANAGER_ADDRESS || config.address;
    if (!address) {
      throw new Error("Missing AGIJobManager address (--address or AGIJOBMANAGER_ADDRESS)");
    }

    const networkName = resolveNetworkName(args);
    const loaded = await loadManager(address, networkName, { localWrite: true, dryRun: args.dryRun });
    provider = loaded.provider;
    const { instance } = loaded;

    const currentApprovals = await instance.requiredValidatorApprovals();
    const currentDisapprovals = await instance.requiredValidatorDisapprovals();
    const maxValidators = await instance.MAX_VALIDATORS_PER_JOB();
    const identityConfigLocked = await instance.lockIdentityConfig();

    if (identityConfigLocked) {
      console.log("Identity wiring is locked; token/ENS/root updates are disabled.");
    }

    const ops = [];

    const addParamOp = async ({
      key,
      label,
      currentValue,
      desiredValue,
      send,
      verify,
    }) => {
      if (desiredValue === undefined) return;
      const desiredString = toStringValue(desiredValue);
      const currentString = toStringValue(currentValue);
      if (desiredString === currentString) return;
      ops.push({
        key,
        label: `${label}: ${currentString} -> ${desiredString}`,
        send,
        verify,
      });
    };

    const approvalsTarget = toStringValue(config.requiredValidatorApprovals);
    const disapprovalsTarget = toStringValue(config.requiredValidatorDisapprovals);

    const validatorOps = [];
    if (approvalsTarget !== undefined || disapprovalsTarget !== undefined) {
      const targetApprovals =
        approvalsTarget !== undefined ? BigInt(approvalsTarget) : BigInt(currentApprovals);
      const targetDisapprovals =
        disapprovalsTarget !== undefined ? BigInt(disapprovalsTarget) : BigInt(currentDisapprovals);
      const maxValidatorsNum = BigInt(maxValidators.toString());

      if (targetApprovals > maxValidatorsNum || targetDisapprovals > maxValidatorsNum) {
        throw new Error("Validator thresholds exceed MAX_VALIDATORS_PER_JOB");
      }
      if (targetApprovals + targetDisapprovals > maxValidatorsNum) {
        throw new Error("Validator thresholds exceed MAX_VALIDATORS_PER_JOB combined limit");
      }

      const currentApprovalsNum = BigInt(currentApprovals.toString());
      const currentDisapprovalsNum = BigInt(currentDisapprovals.toString());

      const canSetApprovalsFirst =
        targetApprovals + currentDisapprovalsNum <= maxValidatorsNum && targetApprovals <= maxValidatorsNum;
      const canSetDisapprovalsFirst =
        targetDisapprovals + currentApprovalsNum <= maxValidatorsNum && targetDisapprovals <= maxValidatorsNum;

      if (approvalsTarget !== undefined && disapprovalsTarget !== undefined) {
        if (canSetApprovalsFirst) {
          validatorOps.push({ key: "requiredValidatorApprovals", value: approvalsTarget });
          validatorOps.push({ key: "requiredValidatorDisapprovals", value: disapprovalsTarget });
        } else if (canSetDisapprovalsFirst) {
          validatorOps.push({ key: "requiredValidatorDisapprovals", value: disapprovalsTarget });
          validatorOps.push({ key: "requiredValidatorApprovals", value: approvalsTarget });
        } else {
          throw new Error("Cannot safely update validator thresholds without intermediate violation");
        }
      } else if (approvalsTarget !== undefined) {
        validatorOps.push({ key: "requiredValidatorApprovals", value: approvalsTarget });
      } else if (disapprovalsTarget !== undefined) {
        validatorOps.push({ key: "requiredValidatorDisapprovals", value: disapprovalsTarget });
      }
    }

    for (const op of validatorOps) {
      if (op.key === "requiredValidatorApprovals") {
        await addParamOp({
          key: op.key,
          label: "Set requiredValidatorApprovals",
          currentValue: currentApprovals,
          desiredValue: op.value,
          send: () => instance.setRequiredValidatorApprovals(op.value),
          verify: async () => {
            const updated = await instance.requiredValidatorApprovals();
            if (updated.toString() !== op.value.toString()) {
              throw new Error("requiredValidatorApprovals did not update");
            }
          },
        });
      }
      if (op.key === "requiredValidatorDisapprovals") {
        await addParamOp({
          key: op.key,
          label: "Set requiredValidatorDisapprovals",
          currentValue: currentDisapprovals,
          desiredValue: op.value,
          send: () => instance.setRequiredValidatorDisapprovals(op.value),
          verify: async () => {
            const updated = await instance.requiredValidatorDisapprovals();
            if (updated.toString() !== op.value.toString()) {
              throw new Error("requiredValidatorDisapprovals did not update");
            }
          },
        });
      }
    }

    await addParamOp({
      key: "premiumReputationThreshold",
      label: "Set premiumReputationThreshold",
      currentValue: await instance.premiumReputationThreshold(),
      desiredValue: config.premiumReputationThreshold,
      send: () => instance.setPremiumReputationThreshold(config.premiumReputationThreshold),
      verify: async () => {
        const updated = await instance.premiumReputationThreshold();
        if (updated.toString() !== toStringValue(config.premiumReputationThreshold)) {
          throw new Error("premiumReputationThreshold did not update");
        }
      },
    });

    const currentValidationReward = await instance.validationRewardPercentage();
    const desiredValidationReward = config.validationRewardPercentage;
    const validationRewardTarget = toStringValue(desiredValidationReward);
    const validationRewardTargetNumber =
      validationRewardTarget !== undefined ? Number(validationRewardTarget) : Number(currentValidationReward.toString());

    const addValidationRewardOp = async () =>
      addParamOp({
        key: "validationRewardPercentage",
        label: "Set validationRewardPercentage",
        currentValue: currentValidationReward,
        desiredValue: desiredValidationReward,
        send: () =>
          instance.setValidationRewardPercentage(
            desiredValidationReward
          ),
        verify: async () => {
          const updated = await instance.validationRewardPercentage();
          if (updated.toString() !== toStringValue(desiredValidationReward)) {
            throw new Error("validationRewardPercentage did not update");
          }
        },
      });

    await addParamOp({
      key: "maxJobPayout",
      label: "Set maxJobPayout",
      currentValue: await instance.maxJobPayout(),
      desiredValue: config.maxJobPayout,
      send: () => instance.setMaxJobPayout(config.maxJobPayout),
      verify: async () => {
        const updated = await instance.maxJobPayout();
        if (updated.toString() !== toStringValue(config.maxJobPayout)) {
          throw new Error("maxJobPayout did not update");
        }
      },
    });

    await addParamOp({
      key: "jobDurationLimit",
      label: "Set jobDurationLimit",
      currentValue: await instance.jobDurationLimit(),
      desiredValue: config.jobDurationLimit,
      send: () => instance.setJobDurationLimit(config.jobDurationLimit),
      verify: async () => {
        const updated = await instance.jobDurationLimit();
        if (updated.toString() !== toStringValue(config.jobDurationLimit)) {
          throw new Error("jobDurationLimit did not update");
        }
      },
    });

    await addParamOp({
      key: "completionReviewPeriod",
      label: "Set completionReviewPeriod",
      currentValue: await instance.completionReviewPeriod(),
      desiredValue: config.completionReviewPeriod,
      send: () => instance.setCompletionReviewPeriod(config.completionReviewPeriod),
      verify: async () => {
        const updated = await instance.completionReviewPeriod();
        if (updated.toString() !== toStringValue(config.completionReviewPeriod)) {
          throw new Error("completionReviewPeriod did not update");
        }
      },
    });

    await addParamOp({
      key: "disputeReviewPeriod",
      label: "Set disputeReviewPeriod",
      currentValue: await instance.disputeReviewPeriod(),
      desiredValue: config.disputeReviewPeriod,
      send: () => instance.setDisputeReviewPeriod(config.disputeReviewPeriod),
      verify: async () => {
        const updated = await instance.disputeReviewPeriod();
        if (updated.toString() !== toStringValue(config.disputeReviewPeriod)) {
          throw new Error("disputeReviewPeriod did not update");
        }
      },
    });

    if (config.additionalAgentPayoutPercentage !== undefined) {
      console.warn("additionalAgentPayoutPercentage is deprecated and ignored.");
    }

    if (
      hasMethod(instance, "termsAndConditionsIpfsHash")
      && hasMethod(instance, "updateTermsAndConditionsIpfsHash")
    ) {
      await addParamOp({
        key: "termsAndConditionsIpfsHash",
        label: "Set termsAndConditionsIpfsHash",
        currentValue: await instance.termsAndConditionsIpfsHash(),
        desiredValue: config.termsAndConditionsIpfsHash,
        send: () =>
          instance.updateTermsAndConditionsIpfsHash(
            config.termsAndConditionsIpfsHash
          ),
        verify: async () => {
          const updated = await instance.termsAndConditionsIpfsHash();
          if (updated !== config.termsAndConditionsIpfsHash) {
            throw new Error("termsAndConditionsIpfsHash did not update");
          }
        },
      });
    }

    if (hasMethod(instance, "contactEmail") && hasMethod(instance, "updateContactEmail")) {
      await addParamOp({
        key: "contactEmail",
        label: "Set contactEmail",
        currentValue: await instance.contactEmail(),
        desiredValue: config.contactEmail,
        send: () => instance.updateContactEmail(config.contactEmail),
        verify: async () => {
          const updated = await instance.contactEmail();
          if (updated !== config.contactEmail) {
            throw new Error("contactEmail did not update");
          }
        },
      });
    }

    if (hasMethod(instance, "additionalText1") && hasMethod(instance, "updateAdditionalText1")) {
      await addParamOp({
        key: "additionalText1",
        label: "Set additionalText1",
        currentValue: await instance.additionalText1(),
        desiredValue: config.additionalText1,
        send: () => instance.updateAdditionalText1(config.additionalText1),
        verify: async () => {
          const updated = await instance.additionalText1();
          if (updated !== config.additionalText1) {
            throw new Error("additionalText1 did not update");
          }
        },
      });
    }

    if (hasMethod(instance, "additionalText2") && hasMethod(instance, "updateAdditionalText2")) {
      await addParamOp({
        key: "additionalText2",
        label: "Set additionalText2",
        currentValue: await instance.additionalText2(),
        desiredValue: config.additionalText2,
        send: () => instance.updateAdditionalText2(config.additionalText2),
        verify: async () => {
          const updated = await instance.additionalText2();
          if (updated !== config.additionalText2) {
            throw new Error("additionalText2 did not update");
          }
        },
      });
    }

    if (hasMethod(instance, "additionalText3") && hasMethod(instance, "updateAdditionalText3")) {
      await addParamOp({
        key: "additionalText3",
        label: "Set additionalText3",
        currentValue: await instance.additionalText3(),
        desiredValue: config.additionalText3,
        send: () => instance.updateAdditionalText3(config.additionalText3),
        verify: async () => {
          const updated = await instance.additionalText3();
          if (updated !== config.additionalText3) {
            throw new Error("additionalText3 did not update");
          }
        },
      });
    }

    const currentValidatorMerkleRoot = await instance.validatorMerkleRoot();
    const currentAgentMerkleRoot = await instance.agentMerkleRoot();
    const desiredValidatorMerkleRoot = config.validatorMerkleRoot ?? currentValidatorMerkleRoot;
    const desiredAgentMerkleRoot = config.agentMerkleRoot ?? currentAgentMerkleRoot;

    if (
      desiredValidatorMerkleRoot !== currentValidatorMerkleRoot ||
      desiredAgentMerkleRoot !== currentAgentMerkleRoot
    ) {
      ops.push({
        key: "merkleRoots",
        label: `Update Merkle roots: validator ${currentValidatorMerkleRoot} -> ${desiredValidatorMerkleRoot}, agent ${currentAgentMerkleRoot} -> ${desiredAgentMerkleRoot}`,
        send: () =>
          instance.updateMerkleRoots(desiredValidatorMerkleRoot, desiredAgentMerkleRoot),
        verify: async () => {
          const updatedValidator = await instance.validatorMerkleRoot();
          const updatedAgent = await instance.agentMerkleRoot();
          if (updatedValidator !== desiredValidatorMerkleRoot || updatedAgent !== desiredAgentMerkleRoot) {
            throw new Error("Merkle roots did not update");
          }
        },
      });
    }

    if (config.agentNftRequired !== undefined) {
      await addParamOp({ key: 'agentNftRequired', label: 'Set NFT requirement for future jobs only',
        currentValue: await instance.agentNftRequired(), desiredValue: config.agentNftRequired,
        send: () => instance.setAgentNftRequired(config.agentNftRequired),
        verify: async () => {
          if (await instance.agentNftRequired() !== config.agentNftRequired) throw new Error('agentNftRequired did not update');
        } });
    }

    const agiTypeOps = [];
    if (Array.isArray(config.agiTypes)) {
      for (const entry of config.agiTypes) {
        if (!entry || !entry.nftAddress || entry.nftAddress === ZERO_ADDRESS) {
          throw new Error("AGI type entry missing nftAddress");
        }
        const payout = toStringValue(entry.payoutPercentage);
        const { needsUpdate } = await ensureAgiType(instance, {
          nftAddress: entry.nftAddress,
          payoutPercentage: payout,
        });
        if (!needsUpdate) continue;
        agiTypeOps.push({
          key: `agiType:${entry.nftAddress}`,
          label: `Add/update AGI type ${entry.nftAddress} eligibility score ${payout}`,
          send: () => instance.addAGIType(entry.nftAddress, payout),
          verify: async () => {
            const updated = await fetchAgiTypes(instance);
            const found = updated.find(
              (item) => item.nftAddress.toLowerCase() === entry.nftAddress.toLowerCase()
            );
            if (!found || found.payoutPercentage !== payout) {
              throw new Error(`AGI type ${entry.nftAddress} eligibility score did not update`);
            }
          },
        });
      }
    }

    if (!Number.isInteger(validationRewardTargetNumber) || validationRewardTargetNumber < 1 || validationRewardTargetNumber > 60) {
      throw new Error('Validator rewards must be 1..60%; fixed wallet shares consume 40% of the job cost.');
    }
    if (agiTypeOps.length) {
      const reserves = await Promise.all(['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds'].map(method => instance[method]()));
      if (reserves.some(value => BigInt(value) !== 0n)) throw new Error('NFT registry changes require zero outstanding escrow and bonds. Settle or cancel existing jobs before changing collections.');
    }
    ops.push(...agiTypeOps);
    await addValidationRewardOp();

    const listOps = [
      {
        label: "moderator",
        list: config.moderators,
        check: (addr) => instance.moderators(addr),
        add: (addr) => instance.addModerator(addr),
      },
      {
        label: "additional validator",
        list: config.additionalValidators,
        check: (addr) => instance.additionalValidators(addr),
        add: (addr) => instance.addAdditionalValidator(addr),
      },
      {
        label: "additional agent",
        list: config.additionalAgents,
        check: (addr) => instance.additionalAgents(addr),
        add: (addr) => instance.addAdditionalAgent(addr),
      },
      {
        label: "blacklisted agent",
        list: config.blacklistedAgents,
        check: (addr) => instance.blacklistedAgents(addr),
        add: (addr) => instance.blacklistAgent(addr, true),
      },
      {
        label: "blacklisted validator",
        list: config.blacklistedValidators,
        check: (addr) => instance.blacklistedValidators(addr),
        add: (addr) => instance.blacklistValidator(addr, true),
      },
    ];

    for (const group of listOps) {
      if (!Array.isArray(group.list)) continue;
      for (const addr of group.list) {
        if (!addr || addr === ZERO_ADDRESS) continue;
        const exists = await group.check(addr);
        if (exists) continue;
        ops.push({
          key: `${group.label}:${addr}`,
          label: `Add ${group.label} ${addr}`,
          send: () => group.add(addr),
          verify: async () => {
            const updated = await group.check(addr);
            if (!updated) {
              throw new Error(`Failed to add ${group.label} ${addr}`);
            }
          },
        });
      }
    }

    const transferOwnershipTo = config.transferOwnershipTo && normalizeAddress(config.transferOwnershipTo);
    if (transferOwnershipTo && transferOwnershipTo !== ZERO_ADDRESS.toLowerCase()) {
      const currentOwner = await instance.owner();
      if (normalizeAddress(currentOwner) !== transferOwnershipTo) {
        ops.push({
          key: "transferOwnership",
          label: `Propose ownership transfer to ${transferOwnershipTo}; recipient must acceptOwnership()`,
          send: () => instance.transferOwnership(transferOwnershipTo),
          verify: async () => {
            const updated = await instance.pendingOwner();
            if (normalizeAddress(updated) !== transferOwnershipTo) {
              throw new Error("Ownership proposal did not match the requested recipient");
            }
          },
        });
      }
    }

    console.log("Post-deploy configuration plan:");
    console.log(`- contract: ${address}`);
    console.log(`- dry-run: ${args.dryRun}`);
    if (ops.length === 0) {
      console.log("No changes required.");
      return callback();
    }
    ops.forEach((op, index) => {
      console.log(`${index + 1}. ${op.label}`);
    });

    for (const op of ops) {
      await runTx(op, args.dryRun);
    }

    console.log("Configuration complete.");
    callback();
  } catch (error) {
    callback(error);
  } finally {
    provider?.destroy();
  }
};

if (require.main === module) module.exports(cliCallback);
