const path = require('path');
const { toChecksumAddress, isAddress } = require('web3-utils');

const AGIJobManager = artifacts.require('AGIJobManager');
const BondMath = artifacts.require('BondMath');
const ENSOwnership = artifacts.require('ENSOwnership');
const ReputationMath = artifacts.require('ReputationMath');
const TransferUtils = artifacts.require('TransferUtils');
const UriUtils = artifacts.require('UriUtils');

const SNAPSHOT_PATH = path.join(__dirname, 'snapshots', 'legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function loadSnapshot() {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(SNAPSHOT_PATH);
}

function mustAddress(addr, label) {
  if (!addr || !isAddress(addr)) throw new Error(`Invalid ${label}: ${addr}`);
  return toChecksumAddress(addr);
}

async function maybeSet(manager, fnName, args, from) {
  if (typeof manager[fnName] !== 'function') return;
  await manager[fnName](...args, { from });
}

module.exports = async function (deployer, network, accounts) {
  if (process.env.MIGRATE_FROM_LEGACY_SNAPSHOT !== '1') {
    console.log('Skipping legacy snapshot migration (set MIGRATE_FROM_LEGACY_SNAPSHOT=1 to enable).');
    return;
  }

  const snapshot = loadSnapshot();
  const chainId = Number(await web3.eth.getChainId());
  const intendedChainId = Number(snapshot.snapshot.chainId);
  if (chainId !== intendedChainId && chainId !== 1337 && chainId !== 31337) {
    throw new Error(`Snapshot chainId is ${intendedChainId} but deployment chainId is ${chainId}. Refusing to continue.`);
  }
  if (chainId === 1 && process.env.CONFIRM_MAINNET_DEPLOY !== '1') {
    throw new Error('Mainnet deployment blocked. Set CONFIRM_MAINNET_DEPLOY=1 to continue.');
  }

  await deployer.deploy(BondMath);
  await deployer.deploy(ENSOwnership);
  await deployer.deploy(ReputationMath);
  await deployer.deploy(TransferUtils);
  await deployer.deploy(UriUtils);

  await deployer.link(BondMath, AGIJobManager);
  await deployer.link(ENSOwnership, AGIJobManager);
  await deployer.link(ReputationMath, AGIJobManager);
  await deployer.link(TransferUtils, AGIJobManager);
  await deployer.link(UriUtils, AGIJobManager);

  if ((AGIJobManager.bytecode || '').includes('__')) {
    throw new Error('Unresolved link references remain in AGIJobManager bytecode.');
  }

  console.log('Library deployments:');
  console.log(`- BondMath: ${BondMath.address}`);
  console.log(`- ENSOwnership: ${ENSOwnership.address}`);
  console.log(`- ReputationMath: ${ReputationMath.address}`);
  console.log(`- TransferUtils: ${TransferUtils.address}`);
  console.log(`- UriUtils: ${UriUtils.address}`);

  const cfg = snapshot.constructorConfig;
  await deployer.deploy(
    AGIJobManager,
    mustAddress(cfg.agiTokenAddress, 'constructorConfig.agiTokenAddress'),
    cfg.baseIpfsUrl,
    [
      mustAddress(cfg.ensConfig.ensRegistry, 'constructorConfig.ensConfig.ensRegistry'),
      mustAddress(cfg.ensConfig.nameWrapper, 'constructorConfig.ensConfig.nameWrapper'),
    ],
    [cfg.rootNodes.clubRootNode, cfg.rootNodes.agentRootNode, cfg.rootNodes.alphaClubRootNode, cfg.rootNodes.alphaAgentRootNode],
    [cfg.merkleRoots.validatorMerkleRoot, cfg.merkleRoots.agentMerkleRoot],
  );

  const manager = await AGIJobManager.deployed();
  const from = accounts[0];

  const rc = snapshot.runtimeConfig;
  await maybeSet(manager, 'setValidationRewardPercentage', [rc.validationRewardPercentage], from);
  await maybeSet(manager, 'setRequiredValidatorApprovals', [rc.requiredValidatorApprovals], from);
  await maybeSet(manager, 'setRequiredValidatorDisapprovals', [rc.requiredValidatorDisapprovals], from);
  await maybeSet(manager, 'setVoteQuorum', [rc.voteQuorum], from);
  await maybeSet(manager, 'setPremiumReputationThreshold', [rc.premiumReputationThreshold], from);
  await maybeSet(manager, 'setMaxJobPayout', [rc.maxJobPayout], from);
  await maybeSet(manager, 'setJobDurationLimit', [rc.jobDurationLimit], from);
  await maybeSet(manager, 'setCompletionReviewPeriod', [rc.completionReviewPeriod], from);
  await maybeSet(manager, 'setDisputeReviewPeriod', [rc.disputeReviewPeriod], from);
  await maybeSet(manager, 'setValidatorBondParams', [rc.validatorBondBps, rc.validatorBondMin, rc.validatorBondMax], from);
  await maybeSet(manager, 'setAgentBondParams', [rc.agentBondBps, rc.agentBondMin, rc.agentBondMax], from);
  await maybeSet(manager, 'setValidatorSlashBps', [rc.validatorSlashBps], from);
  await maybeSet(manager, 'setChallengePeriodAfterApproval', [rc.challengePeriodAfterApproval], from);
  await maybeSet(manager, 'setEnsJobPages', [rc.ensJobPages || ZERO_ADDRESS], from);
  await maybeSet(manager, 'setUseEnsJobTokenURI', [Boolean(rc.useEnsJobTokenURI)], from);
  await maybeSet(manager, 'setBaseIpfsUrl', [cfg.baseIpfsUrl], from);

  for (const a of snapshot.dynamicSets.moderators) await manager.addModerator(mustAddress(a, 'moderator'), { from });
  for (const a of snapshot.dynamicSets.additionalAgents) await manager.addAdditionalAgent(mustAddress(a, 'additionalAgent'), { from });
  for (const a of snapshot.dynamicSets.additionalValidators) await manager.addAdditionalValidator(mustAddress(a, 'additionalValidator'), { from });
  for (const a of snapshot.dynamicSets.blacklistedAgents) await manager.blacklistAgent(mustAddress(a, 'blacklistedAgent'), true, { from });
  for (const a of snapshot.dynamicSets.blacklistedValidators) await manager.blacklistValidator(mustAddress(a, 'blacklistedValidator'), true, { from });

  const enabledTypes = snapshot.agiTypes.filter((x) => x.enabled && String(x.payoutPercentage) !== '0');
  const disabledTypes = snapshot.agiTypes.filter((x) => !x.enabled || String(x.payoutPercentage) === '0');
  for (const t of enabledTypes) {
    try {
      await manager.addAGIType(mustAddress(t.nftAddress, 'agiType.nftAddress'), t.payoutPercentage, { from });
    } catch (e) {
      throw new Error(`addAGIType failed for ${t.nftAddress} payout=${t.payoutPercentage}: ${e.message}`);
    }
  }
  for (const t of disabledTypes) {
    try {
      await manager.addAGIType(mustAddress(t.nftAddress, 'disabledAgiType.nftAddress'), '1', { from });
      await manager.disableAGIType(mustAddress(t.nftAddress, 'disabledAgiType.nftAddress'), { from });
    } catch (e) {
      throw new Error(`disableAGIType replay failed for ${t.nftAddress}: ${e.message}`);
    }
  }

  if (rc.paused) {
    await maybeSet(manager, 'pauseIntake', [], from);
  }
  if (rc.settlementPaused) {
    await maybeSet(manager, 'setSettlementPaused', [true], from);
  }

  if (rc.lockIdentityConfig) {
    await maybeSet(manager, 'lockIdentityConfiguration', [], from);
  }

  const newOwner = process.env.NEW_OWNER ? mustAddress(process.env.NEW_OWNER, 'NEW_OWNER') : mustAddress(rc.owner, 'runtimeConfig.owner');
  if (newOwner.toLowerCase() !== from.toLowerCase()) {
    await manager.transferOwnership(newOwner, { from });
  }

  const checks = [
    ['agiToken', (await manager.agiToken()).toString(), mustAddress(cfg.agiTokenAddress, 'snapshot agiTokenAddress')],
    ['owner', (await manager.owner()).toString(), newOwner],
    ['ens', (await manager.ens()).toString(), mustAddress(cfg.ensConfig.ensRegistry, 'snapshot ensRegistry')],
    ['nameWrapper', (await manager.nameWrapper()).toString(), mustAddress(cfg.ensConfig.nameWrapper, 'snapshot nameWrapper')],
    ['clubRootNode', await manager.clubRootNode(), cfg.rootNodes.clubRootNode],
    ['agentRootNode', await manager.agentRootNode(), cfg.rootNodes.agentRootNode],
    ['alphaClubRootNode', await manager.alphaClubRootNode(), cfg.rootNodes.alphaClubRootNode],
    ['alphaAgentRootNode', await manager.alphaAgentRootNode(), cfg.rootNodes.alphaAgentRootNode],
    ['validatorMerkleRoot', await manager.validatorMerkleRoot(), cfg.merkleRoots.validatorMerkleRoot],
    ['agentMerkleRoot', await manager.agentMerkleRoot(), cfg.merkleRoots.agentMerkleRoot],
    ['paused', String(await manager.paused()), String(Boolean(rc.paused))],
    ['settlementPaused', String(await manager.settlementPaused()), String(Boolean(rc.settlementPaused))],
    ['requiredValidatorApprovals', (await manager.requiredValidatorApprovals()).toString(), String(rc.requiredValidatorApprovals)],
    ['requiredValidatorDisapprovals', (await manager.requiredValidatorDisapprovals()).toString(), String(rc.requiredValidatorDisapprovals)],
    ['voteQuorum', (await manager.voteQuorum()).toString(), String(rc.voteQuorum)],
    ['premiumReputationThreshold', (await manager.premiumReputationThreshold()).toString(), String(rc.premiumReputationThreshold)],
    ['validationRewardPercentage', (await manager.validationRewardPercentage()).toString(), String(rc.validationRewardPercentage)],
    ['maxJobPayout', (await manager.maxJobPayout()).toString(), String(rc.maxJobPayout)],
    ['jobDurationLimit', (await manager.jobDurationLimit()).toString(), String(rc.jobDurationLimit)],
    ['completionReviewPeriod', (await manager.completionReviewPeriod()).toString(), String(rc.completionReviewPeriod)],
    ['disputeReviewPeriod', (await manager.disputeReviewPeriod()).toString(), String(rc.disputeReviewPeriod)],
  ];

  for (const [label, actual, expected] of checks) {
    if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
      throw new Error(`Assertion failed for ${label}: actual=${actual} expected=${expected}`);
    }
  }

  for (const a of snapshot.dynamicSets.moderators) {
    if (!(await manager.moderators(a))) throw new Error(`Moderator assertion failed for ${a}`);
  }
  for (const a of snapshot.dynamicSets.additionalAgents) {
    if (!(await manager.additionalAgents(a))) throw new Error(`Additional agent assertion failed for ${a}`);
  }
  for (const a of snapshot.dynamicSets.additionalValidators) {
    if (!(await manager.additionalValidators(a))) throw new Error(`Additional validator assertion failed for ${a}`);
  }
  for (const a of snapshot.dynamicSets.blacklistedAgents) {
    if (!(await manager.blacklistedAgents(a))) throw new Error(`Blacklisted agent assertion failed for ${a}`);
  }
  for (const a of snapshot.dynamicSets.blacklistedValidators) {
    if (!(await manager.blacklistedValidators(a))) throw new Error(`Blacklisted validator assertion failed for ${a}`);
  }

  for (let i = 0; i < snapshot.agiTypes.length; i += 1) {
    const onchain = await manager.agiTypes(i);
    const expected = snapshot.agiTypes[i];
    if (onchain.nftAddress.toLowerCase() !== expected.nftAddress.toLowerCase()) {
      throw new Error(`AGI type index ${i} nft mismatch: ${onchain.nftAddress} != ${expected.nftAddress}`);
    }
    const expectedPayout = expected.enabled ? String(expected.payoutPercentage) : '0';
    if (onchain.payoutPercentage.toString() !== expectedPayout) {
      throw new Error(`AGI type index ${i} payout mismatch: ${onchain.payoutPercentage.toString()} != ${expectedPayout}`);
    }
  }

  console.log(`AGIJobManager deployed at: ${manager.address}`);
  console.log('All assertions passed.');
  console.log('Note: baseIpfsUrl/useEnsJobTokenURI cannot be asserted directly because they have no public getters.');
};
