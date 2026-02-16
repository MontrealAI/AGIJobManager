const path = require('path');

const AGIJobManager = artifacts.require('AGIJobManager');
const BondMath = artifacts.require('BondMath');
const ENSOwnership = artifacts.require('ENSOwnership');
const ReputationMath = artifacts.require('ReputationMath');
const TransferUtils = artifacts.require('TransferUtils');
const UriUtils = artifacts.require('UriUtils');

const SNAPSHOT = require(path.join(__dirname, 'snapshots', 'legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json'));

function assertEqual(label, actual, expected) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

async function callIfPresent(instance, fn, args = []) {
  if (typeof instance[fn] !== 'function') return false;
  await instance[fn](...args);
  return true;
}

async function maybeAssert(instance, fn, expected, transform = (x) => x) {
  if (typeof instance[fn] !== 'function' || expected === null || expected === undefined) return;
  const actual = await instance[fn]();
  assertEqual(fn, transform(actual), transform(expected));
}

module.exports = async function (deployer, network, accounts) {
  const chainId = await web3.eth.getChainId();
  const targetChainId = Number(SNAPSHOT.source.chainId);
  if (chainId !== targetChainId) {
    throw new Error(`Refusing to deploy: chainId ${chainId} does not match snapshot chainId ${targetChainId}`);
  }
  if (chainId === 1 && process.env.CONFIRM_MAINNET_DEPLOY !== '1') {
    throw new Error('Mainnet deployment blocked. Set CONFIRM_MAINNET_DEPLOY=1 to continue.');
  }

  const libs = [BondMath, ENSOwnership, ReputationMath, TransferUtils, UriUtils];
  for (const lib of libs) await deployer.deploy(lib);
  for (const lib of libs) await deployer.link(lib, AGIJobManager);

  const artifact = AGIJobManager._json || {};
  const unresolved = (artifact.bytecode || '').match(/__\$[a-fA-F0-9_]{34}\$__/g) || [];
  if (unresolved.length > 0) {
    throw new Error(`Unresolved library placeholders found in AGIJobManager bytecode: ${unresolved.join(', ')}`);
  }

  console.log('Library deployment summary:');
  for (const lib of libs) {
    const deployed = await lib.deployed();
    console.log(`- ${lib.contractName}: ${deployed.address}`);
  }

  await deployer.deploy(
    AGIJobManager,
    SNAPSHOT.addresses.agiToken,
    SNAPSHOT.constructor.baseIpfsUrl,
    SNAPSHOT.constructor.ensConfig,
    SNAPSHOT.constructor.rootNodes,
    SNAPSHOT.constructor.merkleRoots
  );

  const manager = await AGIJobManager.deployed();
  console.log(`Deployed AGIJobManager: ${manager.address}`);

  await callIfPresent(manager, 'setValidationRewardPercentage', [SNAPSHOT.params.validationRewardPercentage]);
  await callIfPresent(manager, 'setRequiredValidatorApprovals', [SNAPSHOT.params.requiredValidatorApprovals]);
  await callIfPresent(manager, 'setRequiredValidatorDisapprovals', [SNAPSHOT.params.requiredValidatorDisapprovals]);
  await callIfPresent(manager, 'setVoteQuorum', [SNAPSHOT.params.voteQuorum]);
  await callIfPresent(manager, 'setPremiumReputationThreshold', [SNAPSHOT.params.premiumReputationThreshold]);
  await callIfPresent(manager, 'setMaxJobPayout', [SNAPSHOT.params.maxJobPayout]);
  await callIfPresent(manager, 'setJobDurationLimit', [SNAPSHOT.params.jobDurationLimit]);
  await callIfPresent(manager, 'setCompletionReviewPeriod', [SNAPSHOT.params.completionReviewPeriod]);
  await callIfPresent(manager, 'setDisputeReviewPeriod', [SNAPSHOT.params.disputeReviewPeriod]);
  await callIfPresent(manager, 'setValidatorBondParams', [SNAPSHOT.params.validatorBondBps, SNAPSHOT.params.validatorBondMin, SNAPSHOT.params.validatorBondMax]);
  await callIfPresent(manager, 'setAgentBondParams', [SNAPSHOT.params.agentBondBps, SNAPSHOT.params.agentBond, SNAPSHOT.params.agentBondMax]);
  await callIfPresent(manager, 'setValidatorSlashBps', [SNAPSHOT.params.validatorSlashBps]);
  await callIfPresent(manager, 'setChallengePeriodAfterApproval', [SNAPSHOT.params.challengePeriodAfterApproval]);

  await callIfPresent(manager, 'setEnsJobPages', [SNAPSHOT.addresses.ensJobPages]);
  if (SNAPSHOT.booleans.useEnsJobTokenURI !== null) {
    await callIfPresent(manager, 'setUseEnsJobTokenURI', [SNAPSHOT.booleans.useEnsJobTokenURI]);
  }
  await callIfPresent(manager, 'setBaseIpfsUrl', [SNAPSHOT.constructor.baseIpfsUrl]);

  for (const row of SNAPSHOT.dynamicSets.moderators.filter((x) => x.enabled)) await manager.addModerator(row.address);
  for (const row of SNAPSHOT.dynamicSets.additionalAgents.filter((x) => x.enabled)) await manager.addAdditionalAgent(row.address);
  for (const row of SNAPSHOT.dynamicSets.additionalValidators.filter((x) => x.enabled)) await manager.addAdditionalValidator(row.address);
  for (const row of SNAPSHOT.dynamicSets.blacklistedAgents.filter((x) => x.enabled)) await manager.blacklistAgent(row.address, true);
  for (const row of SNAPSHOT.dynamicSets.blacklistedValidators.filter((x) => x.enabled)) await manager.blacklistValidator(row.address, true);

  for (const agiType of SNAPSHOT.agiTypes) {
    if (!agiType.enabled || agiType.payoutPercentage === '0') continue;
    try {
      await manager.addAGIType(agiType.nftAddress, agiType.payoutPercentage);
    } catch (err) {
      throw new Error(`Failed to restore AGI type ${agiType.nftAddress} (${agiType.payoutPercentage}): ${err.message}`);
    }
  }

  for (const agiType of SNAPSHOT.agiTypes.filter((x) => !x.enabled || x.payoutPercentage === '0')) {
    await manager.addAGIType(agiType.nftAddress, '1');
    await manager.disableAGIType(agiType.nftAddress);
  }

  if (SNAPSHOT.booleans.paused) await manager.pauseIntake();
  if (SNAPSHOT.booleans.settlementPaused) await manager.setSettlementPaused(true);
  if (SNAPSHOT.booleans.lockIdentityConfig) await manager.lockIdentityConfiguration();

  const ownerOverride = (process.env.NEW_OWNER || '').trim();
  const finalOwner = ownerOverride || SNAPSHOT.addresses.owner;
  if (!web3.utils.isAddress(finalOwner)) throw new Error(`Invalid NEW_OWNER/owner address: ${finalOwner}`);
  const ownerChecksum = web3.utils.toChecksumAddress(finalOwner);
  await manager.transferOwnership(ownerChecksum);

  await maybeAssert(manager, 'owner', ownerChecksum);
  await maybeAssert(manager, 'agiToken', SNAPSHOT.addresses.agiToken);
  await maybeAssert(manager, 'ens', SNAPSHOT.addresses.ensRegistry);
  await maybeAssert(manager, 'nameWrapper', SNAPSHOT.addresses.nameWrapper);
  await maybeAssert(manager, 'ensJobPages', SNAPSHOT.addresses.ensJobPages);
  await maybeAssert(manager, 'clubRootNode', SNAPSHOT.constructor.rootNodes[0]);
  await maybeAssert(manager, 'agentRootNode', SNAPSHOT.constructor.rootNodes[1]);
  await maybeAssert(manager, 'alphaClubRootNode', SNAPSHOT.constructor.rootNodes[2]);
  await maybeAssert(manager, 'alphaAgentRootNode', SNAPSHOT.constructor.rootNodes[3]);
  await maybeAssert(manager, 'validatorMerkleRoot', SNAPSHOT.constructor.merkleRoots[0]);
  await maybeAssert(manager, 'agentMerkleRoot', SNAPSHOT.constructor.merkleRoots[1]);
  await maybeAssert(manager, 'paused', SNAPSHOT.booleans.paused, (x) => String(Boolean(x)));
  await maybeAssert(manager, 'settlementPaused', SNAPSHOT.booleans.settlementPaused, (x) => String(Boolean(x)));
  await maybeAssert(manager, 'lockIdentityConfig', SNAPSHOT.booleans.lockIdentityConfig, (x) => String(Boolean(x)));
  await maybeAssert(manager, 'requiredValidatorApprovals', SNAPSHOT.params.requiredValidatorApprovals);
  await maybeAssert(manager, 'requiredValidatorDisapprovals', SNAPSHOT.params.requiredValidatorDisapprovals);
  await maybeAssert(manager, 'voteQuorum', SNAPSHOT.params.voteQuorum);
  await maybeAssert(manager, 'premiumReputationThreshold', SNAPSHOT.params.premiumReputationThreshold);
  await maybeAssert(manager, 'validationRewardPercentage', SNAPSHOT.params.validationRewardPercentage);
  await maybeAssert(manager, 'maxJobPayout', SNAPSHOT.params.maxJobPayout);
  await maybeAssert(manager, 'jobDurationLimit', SNAPSHOT.params.jobDurationLimit);
  await maybeAssert(manager, 'completionReviewPeriod', SNAPSHOT.params.completionReviewPeriod);
  await maybeAssert(manager, 'disputeReviewPeriod', SNAPSHOT.params.disputeReviewPeriod);
  await maybeAssert(manager, 'validatorBondBps', SNAPSHOT.params.validatorBondBps);
  await maybeAssert(manager, 'validatorBondMin', SNAPSHOT.params.validatorBondMin);
  await maybeAssert(manager, 'validatorBondMax', SNAPSHOT.params.validatorBondMax);
  await maybeAssert(manager, 'agentBond', SNAPSHOT.params.agentBond);
  await maybeAssert(manager, 'agentBondBps', SNAPSHOT.params.agentBondBps);
  await maybeAssert(manager, 'agentBondMax', SNAPSHOT.params.agentBondMax);
  await maybeAssert(manager, 'validatorSlashBps', SNAPSHOT.params.validatorSlashBps);
  await maybeAssert(manager, 'challengePeriodAfterApproval', SNAPSHOT.params.challengePeriodAfterApproval);

  for (const row of SNAPSHOT.dynamicSets.moderators.filter((x) => x.enabled)) {
    const status = await manager.moderators(row.address);
    if (!status) throw new Error(`Moderator not restored: ${row.address}`);
  }
  for (const row of SNAPSHOT.dynamicSets.additionalAgents.filter((x) => x.enabled)) {
    const status = await manager.additionalAgents(row.address);
    if (!status) throw new Error(`Additional agent not restored: ${row.address}`);
  }
  for (const row of SNAPSHOT.dynamicSets.additionalValidators.filter((x) => x.enabled)) {
    const status = await manager.additionalValidators(row.address);
    if (!status) throw new Error(`Additional validator not restored: ${row.address}`);
  }
  for (const row of SNAPSHOT.dynamicSets.blacklistedAgents.filter((x) => x.enabled)) {
    const status = await manager.blacklistedAgents(row.address);
    if (!status) throw new Error(`Blacklisted agent not restored: ${row.address}`);
  }
  for (const row of SNAPSHOT.dynamicSets.blacklistedValidators.filter((x) => x.enabled)) {
    const status = await manager.blacklistedValidators(row.address);
    if (!status) throw new Error(`Blacklisted validator not restored: ${row.address}`);
  }

  for (let i = 0; i < SNAPSHOT.agiTypes.length; i += 1) {
    const expected = SNAPSHOT.agiTypes[i];
    const actual = await manager.agiTypes(i);
    assertEqual(`agiTypes[${i}].nftAddress`, actual.nftAddress, expected.nftAddress);
    assertEqual(`agiTypes[${i}].payoutPercentage`, actual.payoutPercentage.toString(), expected.payoutPercentage);
  }
  try {
    await manager.agiTypes(SNAPSHOT.agiTypes.length);
    throw new Error('agiTypes length appears larger than snapshot; expected out-of-bounds read to revert');
  } catch (err) {
    if (!/revert|invalid opcode|out of bounds/i.test(String(err.message))) throw err;
  }

  console.log('All post-deploy assertions passed.');
  console.log('Note: useEnsJobTokenURI/baseIpfsUrl do not expose public getters in this contract variant, so direct readback is unavailable.');
};
