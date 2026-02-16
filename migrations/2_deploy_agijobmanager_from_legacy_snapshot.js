const fs = require('fs');
const path = require('path');

const AGIJobManager = artifacts.require('AGIJobManager');
const BondMath = artifacts.require('BondMath');
const ENSOwnership = artifacts.require('ENSOwnership');
const ReputationMath = artifacts.require('ReputationMath');
const TransferUtils = artifacts.require('TransferUtils');
const UriUtils = artifacts.require('UriUtils');

const SNAPSHOT_PATH = path.join(__dirname, 'snapshots', 'legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json');

function assertEq(actual, expected, label) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
    throw new Error(`Assertion failed for ${label}: actual=${actual} expected=${expected}`);
  }
}

function assertTruthy(value, message) {
  if (!value) throw new Error(message);
}

function normalizeAddress(value, web3) {
  return web3.utils.toChecksumAddress(value);
}

module.exports = async function (deployer, network, accounts) {
  if (network === 'test' || network === 'development') {
    console.log('[snapshot-migration] Skipping snapshot deployment on test/development network.');
    return;
  }

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const chainId = Number(await web3.eth.getChainId());
  assertEq(chainId, snapshot.chainId, 'chainId');
  if (chainId === 1 && process.env.CONFIRM_MAINNET_DEPLOY !== '1') {
    throw new Error('Refusing mainnet deployment. Set CONFIRM_MAINNET_DEPLOY=1 to continue.');
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

  const bytecode = AGIJobManager.bytecode || '';
  if (bytecode.includes('__')) {
    throw new Error('Unresolved AGIJobManager link references remain in bytecode.');
  }

  await deployer.deploy(
    AGIJobManager,
    snapshot.addressConfig.agiTokenAddress,
    snapshot.addressConfig.baseIpfsUrl,
    [snapshot.addressConfig.ensRegistry, snapshot.addressConfig.nameWrapper],
    [
      snapshot.rootNodes.clubRootNode,
      snapshot.rootNodes.agentRootNode,
      snapshot.rootNodes.alphaClubRootNode,
      snapshot.rootNodes.alphaAgentRootNode,
    ],
    [snapshot.merkleRoots.validatorMerkleRoot, snapshot.merkleRoots.agentMerkleRoot]
  );

  const manager = await AGIJobManager.deployed();

  await manager.setValidationRewardPercentage(snapshot.params.validationRewardPercentage);
  await manager.setRequiredValidatorApprovals(snapshot.params.requiredValidatorApprovals);
  await manager.setRequiredValidatorDisapprovals(snapshot.params.requiredValidatorDisapprovals);
  await manager.setPremiumReputationThreshold(snapshot.params.premiumReputationThreshold);
  await manager.setVoteQuorum(snapshot.params.voteQuorum);
  await manager.setMaxJobPayout(snapshot.params.maxJobPayout);
  await manager.setJobDurationLimit(snapshot.params.jobDurationLimit);
  await manager.setCompletionReviewPeriod(snapshot.params.completionReviewPeriod);
  await manager.setDisputeReviewPeriod(snapshot.params.disputeReviewPeriod);
  await manager.setValidatorBondParams(
    snapshot.params.validatorBondBps,
    snapshot.params.validatorBondMin,
    snapshot.params.validatorBondMax
  );
  await manager.setValidatorSlashBps(snapshot.params.validatorSlashBps);
  await manager.setChallengePeriodAfterApproval(snapshot.params.challengePeriodAfterApproval);
  await manager.setAgentBondParams(snapshot.params.agentBondBps, snapshot.params.agentBondMin, snapshot.params.agentBondMax);
  await manager.setAgentBond(snapshot.params.agentBond);
  await manager.setEnsJobPages(snapshot.addressConfig.ensJobPages);
  await manager.setUseEnsJobTokenURI(snapshot.booleans.useEnsJobTokenURI);

  for (const item of snapshot.dynamicSets.moderators) {
    await manager.addModerator(item.address);
  }
  for (const item of snapshot.dynamicSets.additionalAgents) {
    await manager.addAdditionalAgent(item.address);
  }
  for (const item of snapshot.dynamicSets.additionalValidators) {
    await manager.addAdditionalValidator(item.address);
  }
  for (const item of snapshot.dynamicSets.blacklistedAgents) {
    await manager.blacklistAgent(item.address, true);
  }
  for (const item of snapshot.dynamicSets.blacklistedValidators) {
    await manager.blacklistValidator(item.address, true);
  }

  for (const agiType of snapshot.agiTypes) {
    try {
      if (agiType.enabled && agiType.payoutPercentage !== '0') {
        await manager.addAGIType(agiType.nftAddress, agiType.payoutPercentage);
      }
    } catch (err) {
      throw new Error(`Failed restoring AGI type ${agiType.nftAddress}: ${err.message}`);
    }
  }

  if (snapshot.booleans.paused) {
    await manager.pauseIntake();
  }
  await manager.setSettlementPaused(!!snapshot.booleans.settlementPaused);

  if (snapshot.booleans.lockIdentityConfig) {
    await manager.lockIdentityConfiguration();
  }

  const targetOwner = process.env.NEW_OWNER
    ? normalizeAddress(process.env.NEW_OWNER, web3)
    : normalizeAddress(snapshot.addressConfig.owner, web3);

  if (targetOwner.toLowerCase() !== accounts[0].toLowerCase()) {
    await manager.transferOwnership(targetOwner);
  }

  assertEq(await manager.agiToken(), snapshot.addressConfig.agiTokenAddress, 'agiToken');
  assertEq(await manager.ens(), snapshot.addressConfig.ensRegistry, 'ens');
  assertEq(await manager.nameWrapper(), snapshot.addressConfig.nameWrapper, 'nameWrapper');
  assertEq(await manager.clubRootNode(), snapshot.rootNodes.clubRootNode, 'clubRootNode');
  assertEq(await manager.agentRootNode(), snapshot.rootNodes.agentRootNode, 'agentRootNode');
  assertEq(await manager.alphaClubRootNode(), snapshot.rootNodes.alphaClubRootNode, 'alphaClubRootNode');
  assertEq(await manager.alphaAgentRootNode(), snapshot.rootNodes.alphaAgentRootNode, 'alphaAgentRootNode');
  assertEq(await manager.validatorMerkleRoot(), snapshot.merkleRoots.validatorMerkleRoot, 'validatorMerkleRoot');
  assertEq(await manager.agentMerkleRoot(), snapshot.merkleRoots.agentMerkleRoot, 'agentMerkleRoot');
  assertEq(await manager.requiredValidatorApprovals(), snapshot.params.requiredValidatorApprovals, 'requiredValidatorApprovals');
  assertEq(await manager.requiredValidatorDisapprovals(), snapshot.params.requiredValidatorDisapprovals, 'requiredValidatorDisapprovals');
  assertEq(await manager.premiumReputationThreshold(), snapshot.params.premiumReputationThreshold, 'premiumReputationThreshold');
  assertEq(await manager.validationRewardPercentage(), snapshot.params.validationRewardPercentage, 'validationRewardPercentage');
  assertEq(await manager.voteQuorum(), snapshot.params.voteQuorum, 'voteQuorum');
  assertEq(await manager.maxJobPayout(), snapshot.params.maxJobPayout, 'maxJobPayout');
  assertEq(await manager.jobDurationLimit(), snapshot.params.jobDurationLimit, 'jobDurationLimit');
  assertEq(await manager.completionReviewPeriod(), snapshot.params.completionReviewPeriod, 'completionReviewPeriod');
  assertEq(await manager.disputeReviewPeriod(), snapshot.params.disputeReviewPeriod, 'disputeReviewPeriod');
  assertEq(await manager.validatorBondBps(), snapshot.params.validatorBondBps, 'validatorBondBps');
  assertEq(await manager.validatorBondMin(), snapshot.params.validatorBondMin, 'validatorBondMin');
  assertEq(await manager.validatorBondMax(), snapshot.params.validatorBondMax, 'validatorBondMax');
  assertEq(await manager.validatorSlashBps(), snapshot.params.validatorSlashBps, 'validatorSlashBps');
  assertEq(await manager.challengePeriodAfterApproval(), snapshot.params.challengePeriodAfterApproval, 'challengePeriodAfterApproval');
  assertEq(await manager.agentBond(), snapshot.params.agentBond, 'agentBond');
  assertEq(await manager.agentBondBps(), snapshot.params.agentBondBps, 'agentBondBps');
  assertEq(await manager.agentBondMax(), snapshot.params.agentBondMax, 'agentBondMax');
  assertEq(await manager.ensJobPages(), snapshot.addressConfig.ensJobPages, 'ensJobPages');
  assertEq(await manager.useEnsJobTokenURI(), String(snapshot.booleans.useEnsJobTokenURI), 'useEnsJobTokenURI');
  assertEq(await manager.paused(), String(snapshot.booleans.paused), 'paused');
  assertEq(await manager.settlementPaused(), String(snapshot.booleans.settlementPaused), 'settlementPaused');
  assertEq(await manager.lockIdentityConfig(), String(snapshot.booleans.lockIdentityConfig), 'lockIdentityConfig');
  assertEq(await manager.owner(), targetOwner, 'owner');

  for (const item of snapshot.dynamicSets.moderators) {
    assertTruthy(await manager.moderators(item.address), `moderator not restored: ${item.address}`);
  }
  for (const item of snapshot.dynamicSets.additionalAgents) {
    assertTruthy(await manager.additionalAgents(item.address), `additional agent not restored: ${item.address}`);
  }
  for (const item of snapshot.dynamicSets.additionalValidators) {
    assertTruthy(await manager.additionalValidators(item.address), `additional validator not restored: ${item.address}`);
  }
  for (const item of snapshot.dynamicSets.blacklistedAgents) {
    assertTruthy(await manager.blacklistedAgents(item.address), `blacklisted agent not restored: ${item.address}`);
  }
  for (const item of snapshot.dynamicSets.blacklistedValidators) {
    assertTruthy(await manager.blacklistedValidators(item.address), `blacklisted validator not restored: ${item.address}`);
  }

  let restoredAgiTypeCount = 0;
  for (const agiType of snapshot.agiTypes) {
    if (!agiType.enabled || agiType.payoutPercentage === '0') continue;
    const row = await manager.agiTypes(restoredAgiTypeCount);
    assertEq(row.nftAddress || row[0], agiType.nftAddress, `agiTypes[${restoredAgiTypeCount}].nftAddress`);
    assertEq(row.payoutPercentage || row[1], agiType.payoutPercentage, `agiTypes[${restoredAgiTypeCount}].payoutPercentage`);
    restoredAgiTypeCount += 1;
  }

  console.log('[snapshot-migration] deployed libraries:');
  console.log(`- BondMath: ${BondMath.address}`);
  console.log(`- ENSOwnership: ${ENSOwnership.address}`);
  console.log(`- ReputationMath: ${ReputationMath.address}`);
  console.log(`- TransferUtils: ${TransferUtils.address}`);
  console.log(`- UriUtils: ${UriUtils.address}`);
  console.log(`[snapshot-migration] deployed AGIJobManager: ${manager.address}`);
  console.log('[snapshot-migration] all assertions passed.');
  console.log('[snapshot-migration] baseIpfsUrl cannot be asserted directly (private storage, no getter).');
};
