const fs = require('fs');
const path = require('path');

const AGIJobManager = artifacts.require('AGIJobManager');
const UriUtils = artifacts.require('UriUtils');
const TransferUtils = artifacts.require('TransferUtils');
const BondMath = artifacts.require('BondMath');
const ReputationMath = artifacts.require('ReputationMath');
const ENSOwnership = artifacts.require('ENSOwnership');

const { loadConfig } = require('./lib/loadConfig');
const { validateProductionConfig } = require('./lib/validateProductionConfig');
const { pretty, formatEthWei, redactAddress } = require('./lib/format');

const MAINNET_CONFIRMATION_VALUE = 'I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET';
const DEFAULT_ONCHAIN = {
  requiredValidatorApprovals: '3',
  requiredValidatorDisapprovals: '3',
  voteQuorum: '3',
  validationRewardPercentage: '8',
  premiumReputationThreshold: '10000',
  maxJobPayout: '88888888000000000000000000',
  jobDurationLimit: '10000000',
  completionReviewPeriod: String(7 * 24 * 60 * 60),
  disputeReviewPeriod: String(14 * 24 * 60 * 60),
  challengePeriodAfterApproval: String(24 * 60 * 60),
  validatorBondBps: '1500',
  validatorBondMin: '10000000000000000000',
  validatorBondMax: '88888888000000000000000000',
  validatorSlashBps: '8000',
  agentBondBps: '500',
  agentBondMin: '1000000000000000000',
  agentBondMax: '88888888000000000000000000',
  agentBond: '1000000000000000000',
};

function ensureEnabled() {
  if (process.env.AGIJOBMANAGER_DEPLOY !== '1') {
    console.log('Skipping AGIJobManager production migration (disabled). Set AGIJOBMANAGER_DEPLOY=1 to enable.');
    return false;
  }
  return true;
}

function toStringOrNull(value) {
  return value === null || value === undefined ? null : String(value);
}

async function deployLibrary(deployer, library, networkId) {
  await deployer.deploy(library);
  const instance = await library.deployed();
  return {
    address: instance.address,
    txHash: library.networks?.[String(networkId)]?.transactionHash || instance.transactionHash || null,
  };
}

async function ownerTx(manager, from, receipt, label, fn) {
  const tx = await fn();
  receipt.actions.push({ label, txHash: tx.tx, blockNumber: tx.receipt?.blockNumber || null });
  console.log(`  ✓ ${label} :: ${tx.tx}`);
}

function resolveExpectedParameters(protocolParameters) {
  const expected = { ...DEFAULT_ONCHAIN };
  for (const [key, value] of Object.entries(protocolParameters)) {
    if (value !== null && value !== undefined && key !== 'agentBondMinOverride') {
      expected[key] = String(value);
    }
  }
  if (protocolParameters.agentBondMin !== null && protocolParameters.agentBondMin !== undefined) {
    expected.agentBond = String(protocolParameters.agentBondMin);
  }
  if (protocolParameters.agentBondMinOverride !== null && protocolParameters.agentBondMinOverride !== undefined) {
    expected.agentBond = String(protocolParameters.agentBondMinOverride);
  }
  return expected;
}

function assertEq(label, actual, expected) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
    throw new Error(`Verification failed for ${label}. expected=${expected}, actual=${actual}`);
  }
}


function isValidThresholdPair(approvals, disapprovals) {
  const a = Number(approvals);
  const d = Number(disapprovals);
  return Number.isInteger(a) && Number.isInteger(d) && a >= 0 && d >= 0 && a <= 50 && d <= 50 && (a + d <= 50);
}

async function applyValidatorThresholdUpdates(manager, deployerAddress, receipt, protocolParameters) {
  const hasApprovals = protocolParameters.requiredValidatorApprovals !== null && protocolParameters.requiredValidatorApprovals !== undefined;
  const hasDisapprovals = protocolParameters.requiredValidatorDisapprovals !== null && protocolParameters.requiredValidatorDisapprovals !== undefined;
  if (!hasApprovals && !hasDisapprovals) return;

  const currentApprovals = Number((await manager.requiredValidatorApprovals()).toString());
  const currentDisapprovals = Number((await manager.requiredValidatorDisapprovals()).toString());
  const targetApprovals = hasApprovals ? Number(protocolParameters.requiredValidatorApprovals) : currentApprovals;
  const targetDisapprovals = hasDisapprovals ? Number(protocolParameters.requiredValidatorDisapprovals) : currentDisapprovals;

  if (!isValidThresholdPair(targetApprovals, targetDisapprovals)) {
    throw new Error(`Invalid final validator threshold pair: approvals=${targetApprovals}, disapprovals=${targetDisapprovals}`);
  }

  if (hasApprovals && hasDisapprovals && targetApprovals !== currentApprovals && targetDisapprovals !== currentDisapprovals) {
    const canApprovalsFirst = isValidThresholdPair(targetApprovals, currentDisapprovals) && isValidThresholdPair(targetApprovals, targetDisapprovals);
    const canDisapprovalsFirst = isValidThresholdPair(currentApprovals, targetDisapprovals) && isValidThresholdPair(targetApprovals, targetDisapprovals);

    if (canApprovalsFirst) {
      await ownerTx(manager, deployerAddress, receipt, 'setRequiredValidatorApprovals', () => manager.setRequiredValidatorApprovals(targetApprovals, { from: deployerAddress }));
      await ownerTx(manager, deployerAddress, receipt, 'setRequiredValidatorDisapprovals', () => manager.setRequiredValidatorDisapprovals(targetDisapprovals, { from: deployerAddress }));
      return;
    }
    if (canDisapprovalsFirst) {
      await ownerTx(manager, deployerAddress, receipt, 'setRequiredValidatorDisapprovals', () => manager.setRequiredValidatorDisapprovals(targetDisapprovals, { from: deployerAddress }));
      await ownerTx(manager, deployerAddress, receipt, 'setRequiredValidatorApprovals', () => manager.setRequiredValidatorApprovals(targetApprovals, { from: deployerAddress }));
      return;
    }

    throw new Error(
      `Cannot apply validator thresholds from (${currentApprovals}, ${currentDisapprovals}) to (${targetApprovals}, ${targetDisapprovals}) without intermediate invalid pair.`
    );
  }

  if (hasApprovals && targetApprovals !== currentApprovals) {
    await ownerTx(manager, deployerAddress, receipt, 'setRequiredValidatorApprovals', () => manager.setRequiredValidatorApprovals(targetApprovals, { from: deployerAddress }));
  }
  if (hasDisapprovals && targetDisapprovals !== currentDisapprovals) {
    await ownerTx(manager, deployerAddress, receipt, 'setRequiredValidatorDisapprovals', () => manager.setRequiredValidatorDisapprovals(targetDisapprovals, { from: deployerAddress }));
  }
}
module.exports = async function (deployer, network, accounts) {
  if (!ensureEnabled()) return;

  const chainId = await web3.eth.getChainId();
  if (Number(chainId) === 1 && process.env.DEPLOY_CONFIRM_MAINNET !== MAINNET_CONFIRMATION_VALUE) {
    throw new Error(
      `Mainnet deployment blocked. Set DEPLOY_CONFIRM_MAINNET=${MAINNET_CONFIRMATION_VALUE} and re-run.`
    );
  }

  const deployerAddress = accounts[0];
  const deployerBalance = await web3.eth.getBalance(deployerAddress);
  const dryRun = process.env.DEPLOY_DRY_RUN === '1';

  const loaded = loadConfig({ network, chainId, web3 });
  const { config, constructorArgs } = loaded;
  const validation = await validateProductionConfig({ config, constructorArgs, chainId, web3 });

  const summary = {
    network,
    chainId,
    dryRun,
    deployer: redactAddress(deployerAddress),
    deployerBalanceEth: formatEthWei(deployerBalance, web3),
    configPath: loaded.configPath,
    constructorArgs,
    protocolParameters: config.protocolParameters,
    dynamicLists: {
      moderators: config.dynamicLists.moderators.length,
      additionalAgents: config.dynamicLists.additionalAgents.length,
      additionalValidators: config.dynamicLists.additionalValidators.length,
      blacklistedAgents: config.dynamicLists.blacklistedAgents.length,
      blacklistedValidators: config.dynamicLists.blacklistedValidators.length,
    },
    agiTypes: config.agiTypes.length,
    warnings: validation.warnings,
  };

  console.log('================ AGIJobManager Production Deployment Summary ================');
  console.log(pretty(summary));
  console.log('==============================================================================');

  if (dryRun) {
    console.log('DEPLOY_DRY_RUN=1 detected: config validated, deployment skipped.');
    return;
  }

  const receipt = {
    timestamp: new Date().toISOString(),
    network,
    chainId,
    deployerAddress,
    configPath: loaded.configPath,
    resolvedConfig: config,
    constructorArgs,
    warnings: validation.warnings,
    libraries: {},
    manager: null,
    actions: [],
    verification: {
      checks: [],
      notes: [
        'baseIpfsUrl and useEnsJobTokenURI are private/non-readable and cannot be asserted on-chain via public getter.',
      ],
    },
  };

  console.log('Deploying libraries...');
  receipt.libraries.BondMath = await deployLibrary(deployer, BondMath, deployer.network_id);
  receipt.libraries.ENSOwnership = await deployLibrary(deployer, ENSOwnership, deployer.network_id);
  receipt.libraries.ReputationMath = await deployLibrary(deployer, ReputationMath, deployer.network_id);
  receipt.libraries.TransferUtils = await deployLibrary(deployer, TransferUtils, deployer.network_id);
  receipt.libraries.UriUtils = await deployLibrary(deployer, UriUtils, deployer.network_id);

  await deployer.link(BondMath, AGIJobManager);
  await deployer.link(ENSOwnership, AGIJobManager);
  await deployer.link(ReputationMath, AGIJobManager);
  await deployer.link(TransferUtils, AGIJobManager);
  await deployer.link(UriUtils, AGIJobManager);

  console.log('Deploying AGIJobManager...');
  await deployer.deploy(
    AGIJobManager,
    constructorArgs.agiTokenAddress,
    constructorArgs.baseIpfsUrl,
    constructorArgs.ensConfig,
    constructorArgs.rootNodes,
    constructorArgs.merkleRoots
  );

  const manager = await AGIJobManager.deployed();
  receipt.manager = {
    address: manager.address,
    txHash: AGIJobManager.networks?.[String(deployer.network_id)]?.transactionHash || manager.transactionHash || null,
  };

  const p = config.protocolParameters;
  const i = config.identity;
  const f = config.operationalFlags;

  if (p.validationRewardPercentage !== null) {
    await ownerTx(manager, deployerAddress, receipt, 'setValidationRewardPercentage', () => manager.setValidationRewardPercentage(p.validationRewardPercentage, { from: deployerAddress }));
  }
  await applyValidatorThresholdUpdates(manager, deployerAddress, receipt, p);
  if (p.voteQuorum !== null) {
    await ownerTx(manager, deployerAddress, receipt, 'setVoteQuorum', () => manager.setVoteQuorum(p.voteQuorum, { from: deployerAddress }));
  }
  if (p.premiumReputationThreshold !== null) {
    await ownerTx(manager, deployerAddress, receipt, 'setPremiumReputationThreshold', () => manager.setPremiumReputationThreshold(p.premiumReputationThreshold, { from: deployerAddress }));
  }
  if (p.maxJobPayout !== null) {
    await ownerTx(manager, deployerAddress, receipt, 'setMaxJobPayout', () => manager.setMaxJobPayout(p.maxJobPayout, { from: deployerAddress }));
  }
  if (p.jobDurationLimit !== null) {
    await ownerTx(manager, deployerAddress, receipt, 'setJobDurationLimit', () => manager.setJobDurationLimit(p.jobDurationLimit, { from: deployerAddress }));
  }
  if (p.completionReviewPeriod !== null) {
    await ownerTx(manager, deployerAddress, receipt, 'setCompletionReviewPeriod', () => manager.setCompletionReviewPeriod(p.completionReviewPeriod, { from: deployerAddress }));
  }
  if (p.disputeReviewPeriod !== null) {
    await ownerTx(manager, deployerAddress, receipt, 'setDisputeReviewPeriod', () => manager.setDisputeReviewPeriod(p.disputeReviewPeriod, { from: deployerAddress }));
  }
  if (p.challengePeriodAfterApproval !== null) {
    await ownerTx(manager, deployerAddress, receipt, 'setChallengePeriodAfterApproval', () => manager.setChallengePeriodAfterApproval(p.challengePeriodAfterApproval, { from: deployerAddress }));
  }
  if (p.validatorBondBps !== null || p.validatorBondMin !== null || p.validatorBondMax !== null) {
    await ownerTx(manager, deployerAddress, receipt, 'setValidatorBondParams', () => manager.setValidatorBondParams(
      toStringOrNull(p.validatorBondBps) || DEFAULT_ONCHAIN.validatorBondBps,
      toStringOrNull(p.validatorBondMin) || DEFAULT_ONCHAIN.validatorBondMin,
      toStringOrNull(p.validatorBondMax) || DEFAULT_ONCHAIN.validatorBondMax,
      { from: deployerAddress }
    ));
  }
  if (p.validatorSlashBps !== null) {
    await ownerTx(manager, deployerAddress, receipt, 'setValidatorSlashBps', () => manager.setValidatorSlashBps(p.validatorSlashBps, { from: deployerAddress }));
  }
  if (p.agentBondBps !== null || p.agentBondMin !== null || p.agentBondMax !== null) {
    await ownerTx(manager, deployerAddress, receipt, 'setAgentBondParams', () => manager.setAgentBondParams(
      toStringOrNull(p.agentBondBps) || DEFAULT_ONCHAIN.agentBondBps,
      toStringOrNull(p.agentBondMin) || DEFAULT_ONCHAIN.agentBondMin,
      toStringOrNull(p.agentBondMax) || DEFAULT_ONCHAIN.agentBondMax,
      { from: deployerAddress }
    ));
  }
  if (p.agentBondMinOverride !== null && p.agentBondMinOverride !== undefined) {
    await ownerTx(manager, deployerAddress, receipt, 'setAgentBond', () => manager.setAgentBond(p.agentBondMinOverride, { from: deployerAddress }));
  }
  if (i.baseIpfsUrl) {
    await ownerTx(manager, deployerAddress, receipt, 'setBaseIpfsUrl', () => manager.setBaseIpfsUrl(i.baseIpfsUrl, { from: deployerAddress }));
  }
  if (i.ensJobPages) {
    await ownerTx(manager, deployerAddress, receipt, 'setEnsJobPages', () => manager.setEnsJobPages(i.ensJobPages, { from: deployerAddress }));
  }
  if (i.useEnsJobTokenURI !== null && i.useEnsJobTokenURI !== undefined) {
    await ownerTx(manager, deployerAddress, receipt, 'setUseEnsJobTokenURI', () => manager.setUseEnsJobTokenURI(i.useEnsJobTokenURI, { from: deployerAddress }));
  }

  for (const moderator of config.dynamicLists.moderators) {
    await ownerTx(manager, deployerAddress, receipt, `addModerator(${moderator})`, () => manager.addModerator(moderator, { from: deployerAddress }));
  }
  for (const agent of config.dynamicLists.additionalAgents) {
    await ownerTx(manager, deployerAddress, receipt, `addAdditionalAgent(${agent})`, () => manager.addAdditionalAgent(agent, { from: deployerAddress }));
  }
  for (const validator of config.dynamicLists.additionalValidators) {
    await ownerTx(manager, deployerAddress, receipt, `addAdditionalValidator(${validator})`, () => manager.addAdditionalValidator(validator, { from: deployerAddress }));
  }
  for (const blacklistedAgent of config.dynamicLists.blacklistedAgents) {
    await ownerTx(manager, deployerAddress, receipt, `blacklistAgent(${blacklistedAgent})`, () => manager.blacklistAgent(blacklistedAgent, true, { from: deployerAddress }));
  }
  for (const blacklistedValidator of config.dynamicLists.blacklistedValidators) {
    await ownerTx(manager, deployerAddress, receipt, `blacklistValidator(${blacklistedValidator})`, () => manager.blacklistValidator(blacklistedValidator, true, { from: deployerAddress }));
  }

  for (let idx = 0; idx < config.agiTypes.length; idx += 1) {
    const agiType = config.agiTypes[idx];
    await ownerTx(manager, deployerAddress, receipt, `addAGIType[${idx}](${agiType.nftAddress})`, () =>
      manager.addAGIType(agiType.nftAddress, agiType.payoutPercentage, { from: deployerAddress }));
  }

  if (f.settlementPaused !== null && f.settlementPaused !== undefined) {
    await ownerTx(manager, deployerAddress, receipt, `setSettlementPaused(${f.settlementPaused})`, () => manager.setSettlementPaused(f.settlementPaused, { from: deployerAddress }));
  }
  if (f.paused !== null && f.paused !== undefined) {
    const currentlyPaused = await manager.paused();
    if (f.paused && !currentlyPaused) {
      await ownerTx(manager, deployerAddress, receipt, 'pause', () => manager.pause({ from: deployerAddress }));
    } else if (!f.paused && currentlyPaused) {
      await ownerTx(manager, deployerAddress, receipt, 'unpause', () => manager.unpause({ from: deployerAddress }));
    } else {
      console.log(`  - paused already ${currentlyPaused}; no paused state tx needed.`);
    }
  }

  if (i.lockIdentityConfiguration) {
    await ownerTx(manager, deployerAddress, receipt, 'lockIdentityConfiguration', () => manager.lockIdentityConfiguration({ from: deployerAddress }));
  }
  if (config.ownership.finalOwner) {
    await ownerTx(manager, deployerAddress, receipt, `transferOwnership(${config.ownership.finalOwner})`, () => manager.transferOwnership(config.ownership.finalOwner, { from: deployerAddress }));
  }

  const expected = resolveExpectedParameters(config.protocolParameters);

  const checks = [
    ['agiToken', (await manager.agiToken()).toString(), config.identity.agiTokenAddress],
    ['ens', (await manager.ens()).toString(), config.identity.ensRegistry],
    ['nameWrapper', (await manager.nameWrapper()).toString(), config.identity.nameWrapper],
    ['ensJobPages', (await manager.ensJobPages()).toString(), config.identity.ensJobPages || '0x0000000000000000000000000000000000000000'],
    ['clubRootNode', await manager.clubRootNode(), constructorArgs.resolvedRootNodes.clubRootNode],
    ['agentRootNode', await manager.agentRootNode(), constructorArgs.resolvedRootNodes.agentRootNode],
    ['alphaClubRootNode', await manager.alphaClubRootNode(), constructorArgs.resolvedRootNodes.alphaClubRootNode],
    ['alphaAgentRootNode', await manager.alphaAgentRootNode(), constructorArgs.resolvedRootNodes.alphaAgentRootNode],
    ['validatorMerkleRoot', await manager.validatorMerkleRoot(), config.merkleRoots.validatorMerkleRoot],
    ['agentMerkleRoot', await manager.agentMerkleRoot(), config.merkleRoots.agentMerkleRoot],
    ['requiredValidatorApprovals', (await manager.requiredValidatorApprovals()).toString(), expected.requiredValidatorApprovals],
    ['requiredValidatorDisapprovals', (await manager.requiredValidatorDisapprovals()).toString(), expected.requiredValidatorDisapprovals],
    ['voteQuorum', (await manager.voteQuorum()).toString(), expected.voteQuorum],
    ['validationRewardPercentage', (await manager.validationRewardPercentage()).toString(), expected.validationRewardPercentage],
    ['premiumReputationThreshold', (await manager.premiumReputationThreshold()).toString(), expected.premiumReputationThreshold],
    ['maxJobPayout', (await manager.maxJobPayout()).toString(), expected.maxJobPayout],
    ['jobDurationLimit', (await manager.jobDurationLimit()).toString(), expected.jobDurationLimit],
    ['completionReviewPeriod', (await manager.completionReviewPeriod()).toString(), expected.completionReviewPeriod],
    ['disputeReviewPeriod', (await manager.disputeReviewPeriod()).toString(), expected.disputeReviewPeriod],
    ['challengePeriodAfterApproval', (await manager.challengePeriodAfterApproval()).toString(), expected.challengePeriodAfterApproval],
    ['validatorBondBps', (await manager.validatorBondBps()).toString(), expected.validatorBondBps],
    ['validatorBondMin', (await manager.validatorBondMin()).toString(), expected.validatorBondMin],
    ['validatorBondMax', (await manager.validatorBondMax()).toString(), expected.validatorBondMax],
    ['validatorSlashBps', (await manager.validatorSlashBps()).toString(), expected.validatorSlashBps],
    ['agentBondBps', (await manager.agentBondBps()).toString(), expected.agentBondBps],
    ['agentBond', (await manager.agentBond()).toString(), expected.agentBond],
    ['agentBondMax', (await manager.agentBondMax()).toString(), expected.agentBondMax],
    ['settlementPaused', String(await manager.settlementPaused()), String(config.operationalFlags.settlementPaused ?? false)],
    ['paused', String(await manager.paused()), String(config.operationalFlags.paused ?? false)],
  ];

  for (const [label, actual, expectedValue] of checks) {
    assertEq(label, actual, expectedValue);
    receipt.verification.checks.push({ label, actual: String(actual), expected: String(expectedValue), ok: true });
  }

  if (i.lockIdentityConfiguration) {
    const lockState = await manager.lockIdentityConfig();
    assertEq('lockIdentityConfig', String(lockState), 'true');
    receipt.verification.checks.push({ label: 'lockIdentityConfig', actual: 'true', expected: 'true', ok: true });
  }

  const blockNumber = Number(receipt.actions[receipt.actions.length - 1]?.blockNumber || (await web3.eth.getBlockNumber()));
  const deploymentDir = path.resolve(process.cwd(), 'deployments', network);
  fs.mkdirSync(deploymentDir, { recursive: true });
  const receiptPath = path.join(deploymentDir, `AGIJobManager.${chainId}.${blockNumber}.json`);
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

  console.log('Deployment completed successfully.');
  console.log(`AGIJobManager: ${receipt.manager.address}`);
  console.log(`Receipt: ${receiptPath}`);
};
