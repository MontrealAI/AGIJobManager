const path = require('path');
const AGIJobManager = artifacts.require('AGIJobManager');
const BondMath = artifacts.require('BondMath');
const ENSOwnership = artifacts.require('ENSOwnership');
const ReputationMath = artifacts.require('ReputationMath');
const TransferUtils = artifacts.require('TransferUtils');
const UriUtils = artifacts.require('UriUtils');

const SNAPSHOT = require(path.join(__dirname, 'snapshots', 'legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json'));

function assertEq(label, actual, expected) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
    throw new Error(`Assertion failed for ${label}: actual=${actual} expected=${expected}`);
  }
}

async function applyNumericParam(manager, owner, snapshot, paramName, setterName) {
  const value = snapshot.numericParams ? snapshot.numericParams[paramName] : undefined;
  if (value === undefined || value === null || value === '') {
    return;
  }
  if (typeof manager[setterName] !== 'function') {
    return;
  }
  await manager[setterName](value, { from: owner });
}

function isSnapshotReplayComplete(snapshot) {
  const provenance = snapshot.provenance || {};
  if (provenance.replayComplete === false) return false;

  const note = String(provenance.note || '').toLowerCase();
  const derivedBy = String(provenance.derivedBy || '').toLowerCase();

  if (note.includes('unavailable') || note.includes('must be reviewed') || note.includes('incomplete')) {
    return false;
  }
  if (!derivedBy.includes('transaction input replay')) {
    return false;
  }

  return true;
}

module.exports = async function (deployer, network, accounts) {
  if (network === 'development' || network === 'test') {
    return;
  }

  if (process.env.RUN_LEGACY_SNAPSHOT_MIGRATION !== '1') {
    console.log('Skipping legacy snapshot migration (set RUN_LEGACY_SNAPSHOT_MIGRATION=1 to enable).');
    return;
  }

  const chainId = Number(await web3.eth.getChainId());
  if (chainId !== Number(SNAPSHOT.chainId)) {
    throw new Error(`Snapshot chainId mismatch: connected=${chainId} snapshot=${SNAPSHOT.chainId}`);
  }
  if (chainId === 1 && process.env.CONFIRM_MAINNET_DEPLOY !== '1') {
    throw new Error('Refusing mainnet deployment without CONFIRM_MAINNET_DEPLOY=1');
  }

  if (!isSnapshotReplayComplete(SNAPSHOT)) {
    throw new Error('Snapshot provenance indicates incomplete replay-derived state. Regenerate and commit a fully replayed snapshot before running migration.');
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

  if (/__\$[a-f0-9]{34}\$__/i.test(AGIJobManager.bytecode)) {
    throw new Error('Unresolved library link references remain in AGIJobManager.bytecode');
  }

  await deployer.deploy(
    AGIJobManager,
    SNAPSHOT.addresses.agiToken,
    SNAPSHOT.baseIpfsUrl,
    [SNAPSHOT.addresses.ensRegistry, SNAPSHOT.addresses.nameWrapper],
    [
      SNAPSHOT.roots.clubRootNode,
      SNAPSHOT.roots.agentRootNode,
      SNAPSHOT.roots.alphaClubRootNode,
      SNAPSHOT.roots.alphaAgentRootNode
    ],
    [SNAPSHOT.merkleRoots.validatorMerkleRoot, SNAPSHOT.merkleRoots.agentMerkleRoot]
  );

  const manager = await AGIJobManager.deployed();
  const owner = accounts[0];

  // Apply numeric parameters explicitly from snapshot.
  await applyNumericParam(manager, owner, SNAPSHOT, 'validationRewardPercentage', 'setValidationRewardPercentage');
  await applyNumericParam(manager, owner, SNAPSHOT, 'requiredValidatorApprovals', 'setRequiredValidatorApprovals');
  await applyNumericParam(manager, owner, SNAPSHOT, 'requiredValidatorDisapprovals', 'setRequiredValidatorDisapprovals');
  await applyNumericParam(manager, owner, SNAPSHOT, 'voteQuorum', 'setVoteQuorum');
  await applyNumericParam(manager, owner, SNAPSHOT, 'premiumReputationThreshold', 'setPremiumReputationThreshold');
  await applyNumericParam(manager, owner, SNAPSHOT, 'maxJobPayout', 'setMaxJobPayout');
  await applyNumericParam(manager, owner, SNAPSHOT, 'jobDurationLimit', 'setJobDurationLimit');
  await applyNumericParam(manager, owner, SNAPSHOT, 'completionReviewPeriod', 'setCompletionReviewPeriod');
  await applyNumericParam(manager, owner, SNAPSHOT, 'disputeReviewPeriod', 'setDisputeReviewPeriod');
  await applyNumericParam(manager, owner, SNAPSHOT, 'validatorSlashBps', 'setValidatorSlashBps');
  await applyNumericParam(manager, owner, SNAPSHOT, 'challengePeriodAfterApproval', 'setChallengePeriodAfterApproval');
  await applyNumericParam(manager, owner, SNAPSHOT, 'agentBond', 'setAgentBond');

  if (
    SNAPSHOT.numericParams &&
    SNAPSHOT.numericParams.agentBondBps !== undefined &&
    SNAPSHOT.numericParams.agentBondMin !== undefined &&
    SNAPSHOT.numericParams.agentBondMax !== undefined
  ) {
    await manager.setAgentBondParams(
      SNAPSHOT.numericParams.agentBondBps,
      SNAPSHOT.numericParams.agentBondMin,
      SNAPSHOT.numericParams.agentBondMax,
      { from: owner }
    );
  }

  if (
    SNAPSHOT.numericParams &&
    SNAPSHOT.numericParams.validatorBondBps !== undefined &&
    SNAPSHOT.numericParams.validatorBondMin !== undefined &&
    SNAPSHOT.numericParams.validatorBondMax !== undefined
  ) {
    await manager.setValidatorBondParams(
      SNAPSHOT.numericParams.validatorBondBps,
      SNAPSHOT.numericParams.validatorBondMin,
      SNAPSHOT.numericParams.validatorBondMax,
      { from: owner }
    );
  }

  if (SNAPSHOT.addresses.ensJobPages && SNAPSHOT.addresses.ensJobPages !== '0x0000000000000000000000000000000000000000') {
    await manager.setEnsJobPages(SNAPSHOT.addresses.ensJobPages, { from: owner });
  }
  if (typeof SNAPSHOT.booleans.useEnsJobTokenURI === 'boolean') {
    await manager.setUseEnsJobTokenURI(SNAPSHOT.booleans.useEnsJobTokenURI, { from: owner });
  }

  for (const row of SNAPSHOT.dynamicSets.moderators) {
    await manager.addModerator(row.address, { from: owner });
  }
  for (const row of SNAPSHOT.dynamicSets.additionalAgents) {
    await manager.addAdditionalAgent(row.address, { from: owner });
  }
  for (const row of SNAPSHOT.dynamicSets.additionalValidators) {
    await manager.addAdditionalValidator(row.address, { from: owner });
  }
  for (const row of SNAPSHOT.dynamicSets.blacklistedAgents) {
    await manager.blacklistAgent(row.address, true, { from: owner });
  }
  for (const row of SNAPSHOT.dynamicSets.blacklistedValidators) {
    await manager.blacklistValidator(row.address, true, { from: owner });
  }

  for (const row of SNAPSHOT.agiTypes) {
    const restorePayout = row.restorePayoutPercentage || row.payoutPercentage;
    if (Number(restorePayout) > 0) {
      try {
        await manager.addAGIType(row.nftAddress, restorePayout, { from: owner });
      } catch (err) {
        throw new Error(`addAGIType failed for ${row.nftAddress}: ${err.message}`);
      }
    }
  }

  for (const row of SNAPSHOT.agiTypes) {
    if (!row.enabled) {
      try {
        await manager.disableAGIType(row.nftAddress, { from: owner });
      } catch (err) {
        throw new Error(`disableAGIType failed for ${row.nftAddress}. Snapshot must provide a restorable pre-disable AGI type for disabled entries: ${err.message}`);
      }
    }
  }

  if (SNAPSHOT.booleans.paused) {
    await manager.pauseIntake({ from: owner });
  }
  if (SNAPSHOT.booleans.settlementPaused) {
    await manager.setSettlementPaused(true, { from: owner });
  }
  if (SNAPSHOT.booleans.lockIdentityConfig) {
    await manager.lockIdentityConfiguration({ from: owner });
  }

  const finalOwner = process.env.NEW_OWNER || SNAPSHOT.addresses.owner;
  await manager.transferOwnership(finalOwner, { from: owner });

  assertEq('agiToken', await manager.agiToken(), SNAPSHOT.addresses.agiToken);
  assertEq('ens', await manager.ens(), SNAPSHOT.addresses.ensRegistry);
  assertEq('nameWrapper', await manager.nameWrapper(), SNAPSHOT.addresses.nameWrapper);
  assertEq('clubRootNode', await manager.clubRootNode(), SNAPSHOT.roots.clubRootNode);
  assertEq('agentRootNode', await manager.agentRootNode(), SNAPSHOT.roots.agentRootNode);
  assertEq('alphaClubRootNode', await manager.alphaClubRootNode(), SNAPSHOT.roots.alphaClubRootNode);
  assertEq('alphaAgentRootNode', await manager.alphaAgentRootNode(), SNAPSHOT.roots.alphaAgentRootNode);
  assertEq('validatorMerkleRoot', await manager.validatorMerkleRoot(), SNAPSHOT.merkleRoots.validatorMerkleRoot);
  assertEq('agentMerkleRoot', await manager.agentMerkleRoot(), SNAPSHOT.merkleRoots.agentMerkleRoot);
  const numericGetterMap = {
    requiredValidatorApprovals: 'requiredValidatorApprovals',
    requiredValidatorDisapprovals: 'requiredValidatorDisapprovals',
    voteQuorum: 'voteQuorum',
    premiumReputationThreshold: 'premiumReputationThreshold',
    validationRewardPercentage: 'validationRewardPercentage',
    maxJobPayout: 'maxJobPayout',
    jobDurationLimit: 'jobDurationLimit',
    completionReviewPeriod: 'completionReviewPeriod',
    disputeReviewPeriod: 'disputeReviewPeriod',
    validatorBondBps: 'validatorBondBps',
    validatorBondMin: 'validatorBondMin',
    validatorBondMax: 'validatorBondMax',
    validatorSlashBps: 'validatorSlashBps',
    challengePeriodAfterApproval: 'challengePeriodAfterApproval',
    agentBond: 'agentBond',
    agentBondBps: 'agentBondBps',
    agentBondMin: 'agentBondMin',
    agentBondMax: 'agentBondMax'
  };

  for (const [snapshotKey, getterName] of Object.entries(numericGetterMap)) {
    const expected = SNAPSHOT.numericParams ? SNAPSHOT.numericParams[snapshotKey] : undefined;
    if (expected === undefined || typeof manager[getterName] !== 'function') {
      continue;
    }
    assertEq(snapshotKey, await manager[getterName](), expected);
  }

  assertEq('paused', await manager.paused(), SNAPSHOT.booleans.paused);
  assertEq('settlementPaused', await manager.settlementPaused(), SNAPSHOT.booleans.settlementPaused);

  console.log('Deployed libraries:');
  console.log(`- BondMath: ${BondMath.address}`);
  console.log(`- ENSOwnership: ${ENSOwnership.address}`);
  console.log(`- ReputationMath: ${ReputationMath.address}`);
  console.log(`- TransferUtils: ${TransferUtils.address}`);
  console.log(`- UriUtils: ${UriUtils.address}`);
  console.log(`AGIJobManager deployed at: ${manager.address}`);
  console.log('All assertions passed.');
};
