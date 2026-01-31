const assert = require("assert");

const CHECK = {
  PASS: "PASS",
  FAIL: "FAIL",
  WARN: "WARN",
};

function evaluateInvariants({
  requiredValidatorApprovals,
  requiredValidatorDisapprovals,
  maxValidators,
  validationRewardPercentage,
  maxJobPayout,
  jobDurationLimit,
  maxAgentPayoutPercentage,
  agiToken,
  ens,
  nameWrapper,
}) {
  const results = [];
  const approvals = Number(requiredValidatorApprovals);
  const disapprovals = Number(requiredValidatorDisapprovals);
  const maxValidatorsNum = Number(maxValidators);
  const validationRewardNum = Number(validationRewardPercentage);
  const maxAgentPayoutNum = Number(maxAgentPayoutPercentage);

  results.push({
    key: "agiToken",
    status: agiToken && agiToken !== "0x0000000000000000000000000000000000000000" ? CHECK.PASS : CHECK.FAIL,
    message: "agiToken address must be non-zero",
  });
  results.push({
    key: "ens",
    status: ens && ens !== "0x0000000000000000000000000000000000000000" ? CHECK.PASS : CHECK.WARN,
    message: "ENS address should be set for on-chain ownership checks",
  });
  results.push({
    key: "nameWrapper",
    status: nameWrapper && nameWrapper !== "0x0000000000000000000000000000000000000000" ? CHECK.PASS : CHECK.WARN,
    message: "NameWrapper address should be set for wrapped ENS ownership checks",
  });
  results.push({
    key: "validatorThresholds",
    status:
      approvals <= maxValidatorsNum &&
      disapprovals <= maxValidatorsNum &&
      approvals + disapprovals <= maxValidatorsNum
        ? CHECK.PASS
        : CHECK.FAIL,
    message: "Validator thresholds must respect MAX_VALIDATORS_PER_JOB",
  });
  results.push({
    key: "validatorApprovalsNonZero",
    status: approvals > 0 ? CHECK.PASS : CHECK.WARN,
    message: "requiredValidatorApprovals is zero (single approval completes jobs)",
  });
  results.push({
    key: "validatorDisapprovalsNonZero",
    status: disapprovals > 0 ? CHECK.PASS : CHECK.WARN,
    message: "requiredValidatorDisapprovals is zero (single disapproval triggers dispute)",
  });
  results.push({
    key: "validationRewardPercentage",
    status: validationRewardNum > 0 && validationRewardNum <= 100 ? CHECK.PASS : CHECK.FAIL,
    message: "validationRewardPercentage must be in 1..100",
  });
  results.push({
    key: "maxJobPayout",
    status: BigInt(maxJobPayout) > 0n ? CHECK.PASS : CHECK.FAIL,
    message: "maxJobPayout must be > 0",
  });
  results.push({
    key: "jobDurationLimit",
    status: BigInt(jobDurationLimit) > 0n ? CHECK.PASS : CHECK.FAIL,
    message: "jobDurationLimit must be > 0",
  });
  results.push({
    key: "combinedPayouts",
    status: validationRewardNum + maxAgentPayoutNum <= 100 ? CHECK.PASS : CHECK.FAIL,
    message: "validationRewardPercentage + maxAgentPayoutPercentage must be <= 100",
  });

  return results;
}

function formatResult(result) {
  const icon = result.status === CHECK.PASS ? "✅" : result.status === CHECK.WARN ? "⚠️" : "❌";
  return `${icon} ${result.key}: ${result.message}`;
}

function parseArgs(argv) {
  const args = { fromBlock: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--address" || arg === "-a") {
      args.address = argv[i + 1];
      i += 1;
    } else if (arg === "--from-block") {
      args.fromBlock = Number(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

async function loadMaxAgentPayoutPercentage(contract, fromBlock) {
  const events = await contract.getPastEvents("AGITypeUpdated", {
    fromBlock,
    toBlock: "latest",
  });
  const payoutByNft = new Map();
  for (const event of events) {
    payoutByNft.set(event.returnValues.nftAddress.toLowerCase(), Number(event.returnValues.payoutPercentage));
  }
  let maxPayout = 0;
  for (const value of payoutByNft.values()) {
    if (value > maxPayout) {
      maxPayout = value;
    }
  }
  return maxPayout;
}

module.exports = async function validateParams(callback) {
  try {
    assert(global.artifacts, "This script must be run via truffle exec");
    const { address, fromBlock } = parseArgs(process.argv);
    if (!address) {
      throw new Error("Missing --address <AGIJobManagerAddress>");
    }

    const AGIJobManager = artifacts.require("AGIJobManager");
    const instance = await AGIJobManager.at(address);

    const [
      owner,
      paused,
      agiToken,
      ens,
      nameWrapper,
      requiredValidatorApprovals,
      requiredValidatorDisapprovals,
      validationRewardPercentage,
      maxJobPayout,
      jobDurationLimit,
      maxValidators,
    ] = await Promise.all([
      instance.owner(),
      instance.paused(),
      instance.agiToken(),
      instance.ens(),
      instance.nameWrapper(),
      instance.requiredValidatorApprovals(),
      instance.requiredValidatorDisapprovals(),
      instance.validationRewardPercentage(),
      instance.maxJobPayout(),
      instance.jobDurationLimit(),
      instance.MAX_VALIDATORS_PER_JOB(),
    ]);

    const maxAgentPayoutPercentage = await loadMaxAgentPayoutPercentage(instance, fromBlock);

    const results = evaluateInvariants({
      requiredValidatorApprovals,
      requiredValidatorDisapprovals,
      maxValidators,
      validationRewardPercentage,
      maxJobPayout,
      jobDurationLimit,
      maxAgentPayoutPercentage,
      agiToken,
      ens,
      nameWrapper,
    });

    console.log("AGIJobManager parameter check:");
    console.log(`- contract: ${address}`);
    console.log(`- owner: ${owner}`);
    console.log(`- paused: ${paused}`);
    console.log(`- maxAgentPayoutPercentage (from events): ${maxAgentPayoutPercentage}`);
    for (const result of results) {
      console.log(formatResult(result));
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

module.exports.evaluateInvariants = evaluateInvariants;
module.exports.formatResult = formatResult;
module.exports.CHECK = CHECK;
