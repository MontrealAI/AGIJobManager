/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const AGIJobManager = artifacts.require('AGIJobManager');
const BondMath = artifacts.require('BondMath');
const ENSOwnership = artifacts.require('ENSOwnership');
const ReputationMath = artifacts.require('ReputationMath');
const TransferUtils = artifacts.require('TransferUtils');
const UriUtils = artifacts.require('UriUtils');

const SNAPSHOT_PATH = path.join(__dirname, 'snapshots', 'legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json');

function assertCond(condition, message) {
  if (!condition) throw new Error(message);
}

function hasMethod(instance, name) {
  return instance && instance[name] && typeof instance[name] === 'function';
}

function mustChecksum(addr) {
  assertCond(web3.utils.checkAddressChecksum(addr), `Address is not checksum formatted: ${addr}`);
}

async function setIfPresent(contract, method, value) {
  if (!hasMethod(contract, method)) return;
  await contract[method](value);
}

async function assertEqual(label, actual, expected) {
  const a = String(actual).toLowerCase();
  const e = String(expected).toLowerCase();
  assertCond(a === e, `Assertion failed for ${label}: expected ${expected}, got ${actual}`);
}

module.exports = async function (deployer, network) {
  if (process.env.USE_LEGACY_SNAPSHOT_MIGRATION !== '1') {
    console.log('[legacy-snapshot-migration] skipped (set USE_LEGACY_SNAPSHOT_MIGRATION=1 to enable).');
    return;
  }

  assertCond(fs.existsSync(SNAPSHOT_PATH), `Missing snapshot JSON at ${SNAPSHOT_PATH}. Run snapshot script first.`);
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));

  const chainId = Number(await web3.eth.getChainId());
  assertCond(chainId === Number(snapshot.source.chainId), `ChainId mismatch: runtime=${chainId}, snapshot=${snapshot.source.chainId}`);
  if (chainId === 1) {
    assertCond(process.env.CONFIRM_MAINNET_DEPLOY === '1', 'Refusing mainnet deploy. Set CONFIRM_MAINNET_DEPLOY=1 to continue.');
  }

  const ownerOverride = (process.env.NEW_OWNER || '').trim();
  const finalOwner = ownerOverride || snapshot.addresses.owner;
  mustChecksum(snapshot.addresses.agiToken);
  mustChecksum(snapshot.addresses.ensRegistry);
  mustChecksum(snapshot.addresses.nameWrapper);
  mustChecksum(finalOwner);

  const libs = [BondMath, ENSOwnership, ReputationMath, TransferUtils, UriUtils];
  const deployedLibs = {};
  for (const lib of libs) {
    await deployer.deploy(lib);
    await deployer.link(lib, AGIJobManager);
    const inst = await lib.deployed();
    deployedLibs[lib.contractName] = inst.address;
  }

  const unresolvedLinkPattern = /__\$[0-9a-fA-F]{34}\$__/;
  assertCond(!unresolvedLinkPattern.test(AGIJobManager.bytecode), 'Unresolved library link references detected in AGIJobManager bytecode.');

  await deployer.deploy(
    AGIJobManager,
    snapshot.addresses.agiToken,
    snapshot.strings.baseIpfsUrl,
    [snapshot.addresses.ensRegistry, snapshot.addresses.nameWrapper],
    [
      snapshot.roots.clubRootNode,
      snapshot.roots.agentRootNode,
      snapshot.roots.alphaClubRootNode,
      snapshot.roots.alphaAgentRootNode,
    ],
    [snapshot.merkleRoots.validatorMerkleRoot, snapshot.merkleRoots.agentMerkleRoot],
  );

  const manager = await AGIJobManager.deployed();
  console.log('[legacy-snapshot-migration] deployed libraries:', deployedLibs);
  console.log(`[legacy-snapshot-migration] AGIJobManager: ${manager.address}`);

  await setIfPresent(manager, 'setValidationRewardPercentage', snapshot.params.validationRewardPercentage);

  await setIfPresent(manager, 'setRequiredValidatorApprovals', snapshot.params.requiredValidatorApprovals);
  await setIfPresent(manager, 'setRequiredValidatorDisapprovals', snapshot.params.requiredValidatorDisapprovals);
  await setIfPresent(manager, 'setVoteQuorum', snapshot.params.voteQuorum);
  await setIfPresent(manager, 'setPremiumReputationThreshold', snapshot.params.premiumReputationThreshold);
  await setIfPresent(manager, 'setMaxJobPayout', snapshot.params.maxJobPayout);
  await setIfPresent(manager, 'setJobDurationLimit', snapshot.params.jobDurationLimit);
  await setIfPresent(manager, 'setCompletionReviewPeriod', snapshot.params.completionReviewPeriod);
  await setIfPresent(manager, 'setDisputeReviewPeriod', snapshot.params.disputeReviewPeriod);

  if (hasMethod(manager, 'setValidatorBondParams')) {
    await manager.setValidatorBondParams(
      snapshot.params.validatorBondBps,
      snapshot.params.validatorBondMin,
      snapshot.params.validatorBondMax,
    );
  }
  if (hasMethod(manager, 'setAgentBondParams')) {
    await manager.setAgentBondParams(
      snapshot.params.agentBondBps,
      snapshot.params.agentBond,
      snapshot.params.agentBondMax,
    );
  }
  await setIfPresent(manager, 'setValidatorSlashBps', snapshot.params.validatorSlashBps);
  await setIfPresent(manager, 'setChallengePeriodAfterApproval', snapshot.params.challengePeriodAfterApproval);

  if (hasMethod(manager, 'setEnsJobPages') && snapshot.addresses.ensJobPages) {
    await manager.setEnsJobPages(snapshot.addresses.ensJobPages);
  }
  if (hasMethod(manager, 'setUseEnsJobTokenURI') && snapshot.flags.useEnsJobTokenURI !== undefined && snapshot.flags.useEnsJobTokenURI !== null) {
    await manager.setUseEnsJobTokenURI(snapshot.flags.useEnsJobTokenURI);
  }
  if (hasMethod(manager, 'setSettlementPaused') && snapshot.flags.settlementPaused !== undefined && snapshot.flags.settlementPaused !== null) {
    await manager.setSettlementPaused(snapshot.flags.settlementPaused);
  }

  for (const item of snapshot.dynamic.moderators) {
    await manager.addModerator(item.address);
  }
  for (const item of snapshot.dynamic.additionalAgents) {
    await manager.addAdditionalAgent(item.address);
  }
  for (const item of snapshot.dynamic.additionalValidators) {
    await manager.addAdditionalValidator(item.address);
  }
  for (const item of snapshot.dynamic.blacklistedAgents) {
    await manager.blacklistAgent(item.address, true);
  }
  for (const item of snapshot.dynamic.blacklistedValidators) {
    await manager.blacklistValidator(item.address, true);
  }

  const enabledAgiTypes = snapshot.dynamic.agiTypes.filter((t) => t.enabled && t.payoutPercentage !== '0');
  const disabledAgiTypes = snapshot.dynamic.agiTypes.filter((t) => !t.enabled || t.payoutPercentage === '0');

  for (const agiType of enabledAgiTypes) {
    try {
      await manager.addAGIType(agiType.nftAddress, agiType.payoutPercentage);
    } catch (error) {
      throw new Error(`Failed restoring AGI type ${agiType.nftAddress} pct=${agiType.payoutPercentage}: ${error.message}`);
    }
  }

  for (const agiType of disabledAgiTypes) {
    try {
      await manager.addAGIType(agiType.nftAddress, 1);
      await manager.disableAGIType(agiType.nftAddress);
    } catch (error) {
      throw new Error(`Failed restoring disabled AGI type ${agiType.nftAddress}: ${error.message}`);
    }
  }

  if (snapshot.flags.paused === true) {
    if (hasMethod(manager, 'pauseIntake')) {
      await manager.pauseIntake();
    } else if (hasMethod(manager, 'pause')) {
      await manager.pause();
    }
  }

  if (snapshot.flags.lockIdentityConfig === true && hasMethod(manager, 'lockIdentityConfiguration')) {
    await manager.lockIdentityConfiguration();
  }

  if (finalOwner.toLowerCase() !== (await manager.owner()).toLowerCase()) {
    await manager.transferOwnership(finalOwner);
  }

  await assertEqual('owner', await manager.owner(), finalOwner);
  await assertEqual('agiToken', await manager.agiToken(), snapshot.addresses.agiToken);
  await assertEqual('ens', await manager.ens(), snapshot.addresses.ensRegistry);
  await assertEqual('nameWrapper', await manager.nameWrapper(), snapshot.addresses.nameWrapper);
  await assertEqual('clubRootNode', await manager.clubRootNode(), snapshot.roots.clubRootNode);
  await assertEqual('agentRootNode', await manager.agentRootNode(), snapshot.roots.agentRootNode);
  await assertEqual('alphaClubRootNode', await manager.alphaClubRootNode(), snapshot.roots.alphaClubRootNode);
  await assertEqual('alphaAgentRootNode', await manager.alphaAgentRootNode(), snapshot.roots.alphaAgentRootNode);
  await assertEqual('validatorMerkleRoot', await manager.validatorMerkleRoot(), snapshot.merkleRoots.validatorMerkleRoot);
  await assertEqual('agentMerkleRoot', await manager.agentMerkleRoot(), snapshot.merkleRoots.agentMerkleRoot);
  await assertEqual('requiredValidatorApprovals', await manager.requiredValidatorApprovals(), snapshot.params.requiredValidatorApprovals);
  await assertEqual('requiredValidatorDisapprovals', await manager.requiredValidatorDisapprovals(), snapshot.params.requiredValidatorDisapprovals);
  await assertEqual('voteQuorum', await manager.voteQuorum(), snapshot.params.voteQuorum);
  await assertEqual('premiumReputationThreshold', await manager.premiumReputationThreshold(), snapshot.params.premiumReputationThreshold);
  await assertEqual('validationRewardPercentage', await manager.validationRewardPercentage(), snapshot.params.validationRewardPercentage);
  await assertEqual('maxJobPayout', await manager.maxJobPayout(), snapshot.params.maxJobPayout);
  await assertEqual('jobDurationLimit', await manager.jobDurationLimit(), snapshot.params.jobDurationLimit);
  await assertEqual('completionReviewPeriod', await manager.completionReviewPeriod(), snapshot.params.completionReviewPeriod);
  await assertEqual('disputeReviewPeriod', await manager.disputeReviewPeriod(), snapshot.params.disputeReviewPeriod);
  await assertEqual('validatorBondBps', await manager.validatorBondBps(), snapshot.params.validatorBondBps);
  await assertEqual('validatorBondMin', await manager.validatorBondMin(), snapshot.params.validatorBondMin);
  await assertEqual('validatorBondMax', await manager.validatorBondMax(), snapshot.params.validatorBondMax);
  await assertEqual('agentBondBps', await manager.agentBondBps(), snapshot.params.agentBondBps);
  await assertEqual('agentBond', await manager.agentBond(), snapshot.params.agentBond);
  await assertEqual('agentBondMax', await manager.agentBondMax(), snapshot.params.agentBondMax);
  await assertEqual('validatorSlashBps', await manager.validatorSlashBps(), snapshot.params.validatorSlashBps);
  await assertEqual('challengePeriodAfterApproval', await manager.challengePeriodAfterApproval(), snapshot.params.challengePeriodAfterApproval);
  await assertEqual('paused', await manager.paused(), snapshot.flags.paused);
  await assertEqual('settlementPaused', await manager.settlementPaused(), snapshot.flags.settlementPaused);
  await assertEqual('lockIdentityConfig', await manager.lockIdentityConfig(), snapshot.flags.lockIdentityConfig);

  for (const item of snapshot.dynamic.moderators) {
    await assertEqual(`moderator ${item.address}`, await manager.moderators(item.address), true);
  }
  for (const item of snapshot.dynamic.additionalAgents) {
    await assertEqual(`additionalAgent ${item.address}`, await manager.additionalAgents(item.address), true);
  }
  for (const item of snapshot.dynamic.additionalValidators) {
    await assertEqual(`additionalValidator ${item.address}`, await manager.additionalValidators(item.address), true);
  }
  for (const item of snapshot.dynamic.blacklistedAgents) {
    await assertEqual(`blacklistedAgent ${item.address}`, await manager.blacklistedAgents(item.address), true);
  }
  for (const item of snapshot.dynamic.blacklistedValidators) {
    await assertEqual(`blacklistedValidator ${item.address}`, await manager.blacklistedValidators(item.address), true);
  }

  for (let i = 0; i < snapshot.dynamic.agiTypes.length; i += 1) {
    const expected = snapshot.dynamic.agiTypes[i];
    const actual = await manager.agiTypes(i);
    await assertEqual(`agiTypes[${i}].nftAddress`, actual.nftAddress, expected.nftAddress);
    await assertEqual(`agiTypes[${i}].payoutPercentage`, actual.payoutPercentage, expected.payoutPercentage);
  }

  console.log('[legacy-snapshot-migration] Note: baseIpfsUrl/useEnsJobTokenURI are private; direct getter assertion is not possible.');
  console.log('[legacy-snapshot-migration] all assertions passed.');
};
