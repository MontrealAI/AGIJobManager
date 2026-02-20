const fs = require('fs');
const path = require('path');

const AGIJobManager = artifacts.require('AGIJobManager');
const UriUtils = artifacts.require('UriUtils');
const TransferUtils = artifacts.require('TransferUtils');
const BondMath = artifacts.require('BondMath');
const ReputationMath = artifacts.require('ReputationMath');
const ENSOwnership = artifacts.require('ENSOwnership');

const {
  MAINNET_CHAIN_ID,
  MAINNET_CONFIRMATION_VALUE,
  buildResolvedConfig,
} = require('./lib/deployConfig');
const { validateConfig } = require('./lib/validateConfig');

function toPrintable(value) {
  return JSON.stringify(value, null, 2);
}

function asString(value) {
  return value === null || value === undefined ? null : String(value);
}

async function deployLibrary(deployer, libraryArtifact, deployed) {
  await deployer.deploy(libraryArtifact);
  const instance = await libraryArtifact.deployed();
  const txHash = libraryArtifact.networks?.[String(deployer.network_id)]?.transactionHash || instance.transactionHash || null;
  deployed[libraryArtifact.contractName] = {
    address: instance.address,
    txHash,
  };
}

async function runOwnerTx(manager, actionLog, label, fn) {
  const tx = await fn();
  actionLog.push({ label, txHash: tx.tx, blockNumber: tx.receipt?.blockNumber || null });
  return tx;
}

function printSummary(summary) {
  console.log('================ AGIJobManager Deployment Config Summary ================');
  console.log(toPrintable(summary));
  console.log('=========================================================================');
}

function assertEqual(label, actual, expected) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
    throw new Error(`Verification failed for ${label}. actual=${actual} expected=${expected}`);
  }
}

module.exports = async function (deployer, network, accounts) {
  const configPathHint = process.env.DEPLOY_CONFIG_PATH || process.env.AGI_DEPLOY_CONFIG_PATH || null;
  const isEphemeralNetwork = network === 'test' || network === 'development';
  if (isEphemeralNetwork && !configPathHint && process.env.DEPLOY_FORCE_PRODUCTION_MIGRATION !== '1') {
    console.log(
      'Skipping production migration on ephemeral network without DEPLOY_CONFIG_PATH. Set DEPLOY_FORCE_PRODUCTION_MIGRATION=1 to force.'
    );
    return;
  }

  const chainId = await web3.eth.getChainId();
  const deployerAddress = accounts[0];
  const deployerBalanceWei = await web3.eth.getBalance(deployerAddress);

  const config = buildResolvedConfig({ network, chainId, web3 });
  validateConfig(config, web3);

  const summary = {
    metadata: {
      network,
      chainId,
      deployerAddress,
      deployerBalanceEth: web3.utils.fromWei(deployerBalanceWei, 'ether'),
      configHash: config.metadata.configHash,
      configPath: config.metadata.configPath,
      dryRun: process.env.DEPLOY_DRY_RUN === '1',
    },
    constructorArgs: config.constructorArgs,
    postDeployIdentity: config.postDeployIdentity,
    parameters: config.parameters,
    roles: config.roles,
    agiTypes: config.agiTypes,
    operationalFlags: config.operationalFlags,
    ownership: config.ownership,
  };

  printSummary(summary);

  if (Number(chainId) === MAINNET_CHAIN_ID) {
    const confirmation = process.env.DEPLOY_CONFIRM_MAINNET;
    if (confirmation !== MAINNET_CONFIRMATION_VALUE) {
      throw new Error(
        `Mainnet deployment blocked. Set DEPLOY_CONFIRM_MAINNET=${MAINNET_CONFIRMATION_VALUE} to continue.`
      );
    }
  }

  if (process.env.DEPLOY_DRY_RUN === '1') {
    console.log('DEPLOY_DRY_RUN=1 set. Exiting before deployment.');
    return;
  }

  const receipt = {
    chainId,
    network,
    deployerAddress,
    deployerBalanceWei,
    timestamp: new Date().toISOString(),
    configHash: config.metadata.configHash,
    config,
    libraries: {},
    manager: null,
    actions: [],
    verification: {
      checked: [],
      notes: [],
    },
  };

  await deployLibrary(deployer, BondMath, receipt.libraries);
  await deployLibrary(deployer, ENSOwnership, receipt.libraries);
  await deployLibrary(deployer, ReputationMath, receipt.libraries);
  await deployLibrary(deployer, TransferUtils, receipt.libraries);
  await deployLibrary(deployer, UriUtils, receipt.libraries);

  await deployer.link(BondMath, AGIJobManager);
  await deployer.link(ENSOwnership, AGIJobManager);
  await deployer.link(ReputationMath, AGIJobManager);
  await deployer.link(TransferUtils, AGIJobManager);
  await deployer.link(UriUtils, AGIJobManager);

  await deployer.deploy(
    AGIJobManager,
    config.constructorArgs.agiTokenAddress,
    config.constructorArgs.baseIpfsUrl,
    config.constructorArgs.ensConfig,
    config.constructorArgs.rootNodes,
    config.constructorArgs.merkleRoots
  );

  const manager = await AGIJobManager.deployed();
  receipt.manager = {
    address: manager.address,
    txHash: AGIJobManager.networks?.[String(deployer.network_id)]?.transactionHash || manager.transactionHash || null,
  };

  console.log('Libraries deployed:');
  for (const [name, info] of Object.entries(receipt.libraries)) {
    console.log(`- ${name}: ${info.address} (tx: ${info.txHash || 'n/a'})`);
  }
  console.log(`- AGIJobManager: ${manager.address} (tx: ${receipt.manager.txHash || 'n/a'})`);

  const p = config.parameters;
  const post = config.postDeployIdentity;

  if (p.validationRewardPercentage !== null) {
    await runOwnerTx(manager, receipt.actions, 'setValidationRewardPercentage', () =>
      manager.setValidationRewardPercentage(p.validationRewardPercentage, { from: deployerAddress })
    );
  }
  if (p.requiredValidatorApprovals !== null) {
    await runOwnerTx(manager, receipt.actions, 'setRequiredValidatorApprovals', () =>
      manager.setRequiredValidatorApprovals(p.requiredValidatorApprovals, { from: deployerAddress })
    );
  }
  if (p.requiredValidatorDisapprovals !== null) {
    await runOwnerTx(manager, receipt.actions, 'setRequiredValidatorDisapprovals', () =>
      manager.setRequiredValidatorDisapprovals(p.requiredValidatorDisapprovals, { from: deployerAddress })
    );
  }
  if (p.voteQuorum !== null) {
    await runOwnerTx(manager, receipt.actions, 'setVoteQuorum', () => manager.setVoteQuorum(p.voteQuorum, { from: deployerAddress }));
  }

  if (p.premiumReputationThreshold !== null) {
    await runOwnerTx(manager, receipt.actions, 'setPremiumReputationThreshold', () =>
      manager.setPremiumReputationThreshold(p.premiumReputationThreshold, { from: deployerAddress })
    );
  }
  if (p.maxJobPayout !== null) {
    await runOwnerTx(manager, receipt.actions, 'setMaxJobPayout', () => manager.setMaxJobPayout(p.maxJobPayout, { from: deployerAddress }));
  }
  if (p.jobDurationLimit !== null) {
    await runOwnerTx(manager, receipt.actions, 'setJobDurationLimit', () => manager.setJobDurationLimit(p.jobDurationLimit, { from: deployerAddress }));
  }
  if (p.completionReviewPeriod !== null) {
    await runOwnerTx(manager, receipt.actions, 'setCompletionReviewPeriod', () =>
      manager.setCompletionReviewPeriod(p.completionReviewPeriod, { from: deployerAddress })
    );
  }
  if (p.disputeReviewPeriod !== null) {
    await runOwnerTx(manager, receipt.actions, 'setDisputeReviewPeriod', () =>
      manager.setDisputeReviewPeriod(p.disputeReviewPeriod, { from: deployerAddress })
    );
  }
  if (p.challengePeriodAfterApproval !== null) {
    await runOwnerTx(manager, receipt.actions, 'setChallengePeriodAfterApproval', () =>
      manager.setChallengePeriodAfterApproval(p.challengePeriodAfterApproval, { from: deployerAddress })
    );
  }
  if (p.validatorBondBps !== null || p.validatorBondMin !== null || p.validatorBondMax !== null) {
    const bps = p.validatorBondBps !== null ? p.validatorBondBps : (await manager.validatorBondBps()).toString();
    const min = p.validatorBondMin !== null ? p.validatorBondMin : (await manager.validatorBondMin()).toString();
    const max = p.validatorBondMax !== null ? p.validatorBondMax : (await manager.validatorBondMax()).toString();
    await runOwnerTx(manager, receipt.actions, 'setValidatorBondParams', () => manager.setValidatorBondParams(bps, min, max, { from: deployerAddress }));
  }
  if (p.validatorSlashBps !== null) {
    await runOwnerTx(manager, receipt.actions, 'setValidatorSlashBps', () =>
      manager.setValidatorSlashBps(p.validatorSlashBps, { from: deployerAddress })
    );
  }
  if (p.agentBondBps !== null || p.agentBondMin !== null || p.agentBondMax !== null) {
    const bps = p.agentBondBps !== null ? p.agentBondBps : (await manager.agentBondBps()).toString();
    const min = p.agentBondMin !== null ? p.agentBondMin : (await manager.agentBond()).toString();
    const max = p.agentBondMax !== null ? p.agentBondMax : (await manager.agentBondMax()).toString();
    await runOwnerTx(manager, receipt.actions, 'setAgentBondParams', () => manager.setAgentBondParams(bps, min, max, { from: deployerAddress }));
  }
  if (p.agentBond !== null) {
    await runOwnerTx(manager, receipt.actions, 'setAgentBond', () => manager.setAgentBond(p.agentBond, { from: deployerAddress }));
  }

  for (const agiType of config.agiTypes.filter((x) => x.enabled !== false)) {
    await runOwnerTx(manager, receipt.actions, `addAGIType:${agiType.nftAddress}`, () =>
      manager.addAGIType(agiType.nftAddress, agiType.payoutPercentage, { from: deployerAddress })
    );
  }

  for (const moderator of config.roles.moderators) {
    await runOwnerTx(manager, receipt.actions, `addModerator:${moderator}`, () => manager.addModerator(moderator, { from: deployerAddress }));
  }
  for (const agent of config.roles.additionalAgents) {
    await runOwnerTx(manager, receipt.actions, `addAdditionalAgent:${agent}`, () => manager.addAdditionalAgent(agent, { from: deployerAddress }));
  }
  for (const validator of config.roles.additionalValidators) {
    await runOwnerTx(manager, receipt.actions, `addAdditionalValidator:${validator}`, () =>
      manager.addAdditionalValidator(validator, { from: deployerAddress })
    );
  }
  for (const agent of config.roles.blacklistedAgents) {
    await runOwnerTx(manager, receipt.actions, `blacklistAgent:${agent}`, () => manager.blacklistAgent(agent, true, { from: deployerAddress }));
  }
  for (const validator of config.roles.blacklistedValidators) {
    await runOwnerTx(manager, receipt.actions, `blacklistValidator:${validator}`, () =>
      manager.blacklistValidator(validator, true, { from: deployerAddress })
    );
  }

  if (config.operationalFlags.paused === true && !(await manager.paused())) {
    await runOwnerTx(manager, receipt.actions, 'pause', () => manager.pause({ from: deployerAddress }));
  } else if (config.operationalFlags.paused === false && (await manager.paused())) {
    await runOwnerTx(manager, receipt.actions, 'unpause', () => manager.unpause({ from: deployerAddress }));
  }

  if (config.operationalFlags.settlementPaused !== null) {
    await runOwnerTx(manager, receipt.actions, 'setSettlementPaused', () =>
      manager.setSettlementPaused(config.operationalFlags.settlementPaused, { from: deployerAddress })
    );
  }

  if (post.ensJobPages !== null && post.ensJobPages !== undefined) {
    await runOwnerTx(manager, receipt.actions, `setEnsJobPages:${post.ensJobPages}`, () =>
      manager.setEnsJobPages(post.ensJobPages, { from: deployerAddress })
    );
  }
  if (post.useEnsJobTokenURI !== null) {
    await runOwnerTx(manager, receipt.actions, `setUseEnsJobTokenURI:${post.useEnsJobTokenURI}`, () =>
      manager.setUseEnsJobTokenURI(post.useEnsJobTokenURI, { from: deployerAddress })
    );
  }

  if (post.lockIdentityConfiguration) {
    await runOwnerTx(manager, receipt.actions, 'lockIdentityConfiguration', () => manager.lockIdentityConfiguration({ from: deployerAddress }));
  }

  if (config.ownership.transferTo) {
    await runOwnerTx(manager, receipt.actions, `transferOwnership:${config.ownership.transferTo}`, () =>
      manager.transferOwnership(config.ownership.transferTo, { from: deployerAddress })
    );
  }

  const checks = [
    ['agiToken', (await manager.agiToken()).toString(), config.identity.agiTokenAddress],
    ['ens', (await manager.ens()).toString(), config.identity.ensRegistry],
    ['nameWrapper', (await manager.nameWrapper()).toString(), config.identity.nameWrapper],
    ['clubRootNode', (await manager.clubRootNode()).toString(), config.resolvedRootNodes.clubRootNode],
    ['agentRootNode', (await manager.agentRootNode()).toString(), config.resolvedRootNodes.agentRootNode],
    ['alphaClubRootNode', (await manager.alphaClubRootNode()).toString(), config.resolvedRootNodes.alphaClubRootNode],
    ['alphaAgentRootNode', (await manager.alphaAgentRootNode()).toString(), config.resolvedRootNodes.alphaAgentRootNode],
    ['validatorMerkleRoot', (await manager.validatorMerkleRoot()).toString(), config.merkleRoots.validatorMerkleRoot],
    ['agentMerkleRoot', (await manager.agentMerkleRoot()).toString(), config.merkleRoots.agentMerkleRoot],
    ['requiredValidatorApprovals', (await manager.requiredValidatorApprovals()).toString(), asString(p.requiredValidatorApprovals ?? 3)],
    ['requiredValidatorDisapprovals', (await manager.requiredValidatorDisapprovals()).toString(), asString(p.requiredValidatorDisapprovals ?? 3)],
    ['voteQuorum', (await manager.voteQuorum()).toString(), asString(p.voteQuorum ?? 3)],
    ['validationRewardPercentage', (await manager.validationRewardPercentage()).toString(), asString(p.validationRewardPercentage ?? 8)],
    ['premiumReputationThreshold', (await manager.premiumReputationThreshold()).toString(), asString(p.premiumReputationThreshold ?? 10000)],
    ['maxJobPayout', (await manager.maxJobPayout()).toString(), asString(p.maxJobPayout ?? '88888888000000000000000000')],
    ['jobDurationLimit', (await manager.jobDurationLimit()).toString(), asString(p.jobDurationLimit ?? 10000000)],
    ['completionReviewPeriod', (await manager.completionReviewPeriod()).toString(), asString(p.completionReviewPeriod ?? 7 * 24 * 3600)],
    ['disputeReviewPeriod', (await manager.disputeReviewPeriod()).toString(), asString(p.disputeReviewPeriod ?? 14 * 24 * 3600)],
    ['challengePeriodAfterApproval', (await manager.challengePeriodAfterApproval()).toString(), asString(p.challengePeriodAfterApproval ?? 24 * 3600)],
    ['validatorBondBps', (await manager.validatorBondBps()).toString(), asString(p.validatorBondBps ?? 1500)],
    ['validatorBondMin', (await manager.validatorBondMin()).toString(), asString(p.validatorBondMin ?? '10000000000000000000')],
    ['validatorBondMax', (await manager.validatorBondMax()).toString(), asString(p.validatorBondMax ?? '88888888000000000000000000')],
    ['validatorSlashBps', (await manager.validatorSlashBps()).toString(), asString(p.validatorSlashBps ?? 8000)],
    ['agentBondBps', (await manager.agentBondBps()).toString(), asString(p.agentBondBps ?? 500)],
    ['agentBondMin', (await manager.agentBond()).toString(), asString(p.agentBond ?? p.agentBondMin ?? '1000000000000000000')],
    ['agentBondMax', (await manager.agentBondMax()).toString(), asString(p.agentBondMax ?? '88888888000000000000000000')],
    ['paused', String(await manager.paused()), String(config.operationalFlags.paused ?? false)],
    ['settlementPaused', String(await manager.settlementPaused()), String(config.operationalFlags.settlementPaused ?? false)],
    ['lockIdentityConfig', String(await manager.lockIdentityConfig()), String(Boolean(post.lockIdentityConfiguration))],
    ['ensJobPages', String(await manager.ensJobPages()), String(post.ensJobPages || '0x0000000000000000000000000000000000000000')],
    ['owner', (await manager.owner()).toString(), config.ownership.transferTo || deployerAddress],
  ];

  for (const [label, actual, expected] of checks) {
    assertEqual(label, actual, expected);
    receipt.verification.checked.push({ label, actual, expected });
  }

  receipt.verification.notes.push('useEnsJobTokenURI and baseIpfsUrl do not expose public getters; direct read-back skipped by design.');

  const latestBlock = await web3.eth.getBlockNumber();
  const outputDir = path.join(process.cwd(), 'deployments', network);
  fs.mkdirSync(outputDir, { recursive: true });
  const fileName = `AGIJobManager.${Date.now()}-${latestBlock}.json`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(receipt, null, 2));

  console.log(`Deployment receipt written: ${filePath}`);
  console.log('Post-deploy action tx hashes:');
  receipt.actions.forEach((action) => {
    console.log(`- ${action.label}: ${action.txHash || 'n/a'}`);
  });
};
