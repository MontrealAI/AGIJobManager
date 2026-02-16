const fs = require('fs');
const path = require('path');

const AGIJobManager = artifacts.require('AGIJobManager');
const BondMath = artifacts.require('BondMath');
const ENSOwnership = artifacts.require('ENSOwnership');
const ReputationMath = artifacts.require('ReputationMath');
const TransferUtils = artifacts.require('TransferUtils');
const UriUtils = artifacts.require('UriUtils');

const SNAPSHOT_FILE = path.join(__dirname, 'snapshots', 'legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json');

function normalizeAddress(value) {
  return web3.utils.toChecksumAddress(value);
}

function eqAddr(a, b) {
  return normalizeAddress(a) === normalizeAddress(b);
}

async function assertEq(name, actual, expected, isAddr = false) {
  const ok = isAddr ? eqAddr(actual, expected) : String(actual) === String(expected);
  if (!ok) throw new Error(`Assertion failed for ${name}: expected=${expected}, actual=${actual}`);
}

module.exports = async function (deployer, network, accounts) {
  if (process.env.DEPLOY_FROM_LEGACY_SNAPSHOT !== '1') {
    console.log('[legacy-snapshot-migration] skipped (set DEPLOY_FROM_LEGACY_SNAPSHOT=1 to enable).');
    return;
  }

  if (!fs.existsSync(SNAPSHOT_FILE)) {
    throw new Error(`Snapshot file missing: ${SNAPSHOT_FILE}`);
  }

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
  const chainId = Number(await web3.eth.getChainId());
  if (chainId !== Number(snapshot.chainId)) {
    throw new Error(`ChainId mismatch: runtime=${chainId}, snapshot=${snapshot.chainId}`);
  }
  if (chainId === 1 && process.env.CONFIRM_MAINNET_DEPLOY !== '1') {
    throw new Error('Refusing mainnet deploy. Set CONFIRM_MAINNET_DEPLOY=1 to continue.');
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
    throw new Error('Unresolved library link references remain in AGIJobManager bytecode.');
  }

  console.log('[legacy-snapshot-migration] Libraries:');
  console.log(`- BondMath: ${BondMath.address}`);
  console.log(`- ENSOwnership: ${ENSOwnership.address}`);
  console.log(`- ReputationMath: ${ReputationMath.address}`);
  console.log(`- TransferUtils: ${TransferUtils.address}`);
  console.log(`- UriUtils: ${UriUtils.address}`);

  const c = snapshot.config;
  const baseIpfsUrl = snapshot.constructor.baseIpfsUrl;
  if (!baseIpfsUrl) {
    throw new Error('Snapshot is missing constructor.baseIpfsUrl');
  }
  const ensConfig = [c.ens, c.nameWrapper];
  const rootNodes = [c.clubRootNode, c.agentRootNode, c.alphaClubRootNode || snapshot.derivedRoots[0].value, c.alphaAgentRootNode || snapshot.derivedRoots[1].value];
  const merkleRoots = [c.validatorMerkleRoot, c.agentMerkleRoot];

  await deployer.deploy(AGIJobManager, c.agiToken, baseIpfsUrl, ensConfig, rootNodes, merkleRoots);
  const manager = await AGIJobManager.deployed();
  console.log(`[legacy-snapshot-migration] AGIJobManager deployed at ${manager.address}`);

  await manager.setValidationRewardPercentage(c.validationRewardPercentage);
  if (c.requiredValidatorApprovals !== undefined) await manager.setRequiredValidatorApprovals(c.requiredValidatorApprovals);
  if (c.requiredValidatorDisapprovals !== undefined) await manager.setRequiredValidatorDisapprovals(c.requiredValidatorDisapprovals);
  if (c.voteQuorum !== undefined) await manager.setVoteQuorum(c.voteQuorum);
  if (c.premiumReputationThreshold !== undefined) await manager.setPremiumReputationThreshold(c.premiumReputationThreshold);
  if (c.maxJobPayout !== undefined) await manager.setMaxJobPayout(c.maxJobPayout);
  if (c.jobDurationLimit !== undefined) await manager.setJobDurationLimit(c.jobDurationLimit);
  if (c.completionReviewPeriod !== undefined) await manager.setCompletionReviewPeriod(c.completionReviewPeriod);
  if (c.disputeReviewPeriod !== undefined) await manager.setDisputeReviewPeriod(c.disputeReviewPeriod);
  if (c.validatorBondBps !== undefined && c.validatorBondMin !== undefined && c.validatorBondMax !== undefined) {
    await manager.setValidatorBondParams(c.validatorBondBps, c.validatorBondMin, c.validatorBondMax);
  }
  if (c.agentBondBps !== undefined && c.agentBondMin !== undefined && c.agentBondMax !== undefined) {
    await manager.setAgentBondParams(c.agentBondBps, c.agentBondMin, c.agentBondMax);
  }
  if (c.validatorSlashBps !== undefined) await manager.setValidatorSlashBps(c.validatorSlashBps);
  if (c.challengePeriodAfterApproval !== undefined) await manager.setChallengePeriodAfterApproval(c.challengePeriodAfterApproval);
  if (c.ensJobPages !== undefined) await manager.setEnsJobPages(c.ensJobPages);
  if (c.useEnsJobTokenURI !== undefined) await manager.setUseEnsJobTokenURI(Boolean(c.useEnsJobTokenURI));

  for (const m of snapshot.dynamic.moderators || []) {
    await manager.addModerator(m.address);
  }
  for (const a of snapshot.dynamic.additionalAgents || []) {
    await manager.addAdditionalAgent(a.address);
  }
  for (const v of snapshot.dynamic.additionalValidators || []) {
    await manager.addAdditionalValidator(v.address);
  }
  for (const a of snapshot.dynamic.blacklistedAgents || []) {
    await manager.blacklistAgent(a.address, true);
  }
  for (const v of snapshot.dynamic.blacklistedValidators || []) {
    await manager.blacklistValidator(v.address, true);
  }

  for (const t of snapshot.dynamic.agiTypes || []) {
    if (String(t.payoutPercentage) !== '0') {
      try {
        await manager.addAGIType(t.nftAddress, t.payoutPercentage);
      } catch (err) {
        throw new Error(`addAGIType failed for ${t.nftAddress}: ${err.message}`);
      }
    }
  }
  for (const t of snapshot.dynamic.agiTypes || []) {
    if (!t.enabled || String(t.payoutPercentage) === '0') {
      try { await manager.disableAGIType(t.nftAddress); } catch (_) {}
    }
  }

  if (c.paused === true) await manager.pauseIntake();
  if (c.settlementPaused === true) await manager.setSettlementPaused(true);
  if (c.lockIdentityConfig === true) await manager.lockIdentityConfiguration();

  const newOwner = (process.env.NEW_OWNER || c.owner || accounts[0]).trim();
  await manager.transferOwnership(normalizeAddress(newOwner));

  // Assertions
  await assertEq('owner', await manager.owner(), newOwner, true);
  await assertEq('agiToken', await manager.agiToken(), c.agiToken, true);
  await assertEq('ens', await manager.ens(), c.ens, true);
  await assertEq('nameWrapper', await manager.nameWrapper(), c.nameWrapper, true);
  await assertEq('clubRootNode', await manager.clubRootNode(), c.clubRootNode);
  await assertEq('agentRootNode', await manager.agentRootNode(), c.agentRootNode);
  await assertEq('alphaClubRootNode', await manager.alphaClubRootNode(), c.alphaClubRootNode || snapshot.derivedRoots[0].value);
  await assertEq('alphaAgentRootNode', await manager.alphaAgentRootNode(), c.alphaAgentRootNode || snapshot.derivedRoots[1].value);
  await assertEq('validatorMerkleRoot', await manager.validatorMerkleRoot(), c.validatorMerkleRoot);
  await assertEq('agentMerkleRoot', await manager.agentMerkleRoot(), c.agentMerkleRoot);
  await assertEq('requiredValidatorApprovals', await manager.requiredValidatorApprovals(), c.requiredValidatorApprovals);
  await assertEq('requiredValidatorDisapprovals', await manager.requiredValidatorDisapprovals(), c.requiredValidatorDisapprovals);
  await assertEq('premiumReputationThreshold', await manager.premiumReputationThreshold(), c.premiumReputationThreshold);
  await assertEq('validationRewardPercentage', await manager.validationRewardPercentage(), c.validationRewardPercentage);
  await assertEq('maxJobPayout', await manager.maxJobPayout(), c.maxJobPayout);
  await assertEq('jobDurationLimit', await manager.jobDurationLimit(), c.jobDurationLimit);
  if (c.voteQuorum !== undefined) await assertEq('voteQuorum', await manager.voteQuorum(), c.voteQuorum);
  if (c.completionReviewPeriod !== undefined) await assertEq('completionReviewPeriod', await manager.completionReviewPeriod(), c.completionReviewPeriod);
  if (c.disputeReviewPeriod !== undefined) await assertEq('disputeReviewPeriod', await manager.disputeReviewPeriod(), c.disputeReviewPeriod);
  if (c.settlementPaused !== undefined) await assertEq('settlementPaused', await manager.settlementPaused(), c.settlementPaused);
  if (c.lockIdentityConfig !== undefined) await assertEq('lockIdentityConfig', await manager.lockIdentityConfig(), c.lockIdentityConfig);

  for (const m of snapshot.dynamic.moderators || []) {
    await assertEq(`moderator:${m.address}`, await manager.moderators(m.address), true);
  }
  for (const a of snapshot.dynamic.additionalAgents || []) {
    await assertEq(`additionalAgent:${a.address}`, await manager.additionalAgents(a.address), true);
  }
  for (const v of snapshot.dynamic.additionalValidators || []) {
    await assertEq(`additionalValidator:${v.address}`, await manager.additionalValidators(v.address), true);
  }
  for (const a of snapshot.dynamic.blacklistedAgents || []) {
    await assertEq(`blacklistedAgent:${a.address}`, await manager.blacklistedAgents(a.address), true);
  }
  for (const v of snapshot.dynamic.blacklistedValidators || []) {
    await assertEq(`blacklistedValidator:${v.address}`, await manager.blacklistedValidators(v.address), true);
  }

  console.log('[legacy-snapshot-migration] all assertions passed');
  console.log('[legacy-snapshot-migration] note: baseIpfsUrl/useEnsJobTokenURI are not directly readable in contract ABI; constructor snapshot and behavior checks are authoritative.');
};
