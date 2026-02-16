/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const AGIJobManager = artifacts.require('AGIJobManager');
const BondMath = artifacts.require('BondMath');
const ENSOwnership = artifacts.require('ENSOwnership');
const ReputationMath = artifacts.require('ReputationMath');
const TransferUtils = artifacts.require('TransferUtils');
const UriUtils = artifacts.require('UriUtils');

const SNAPSHOT_FILE = path.join(__dirname, 'snapshots', 'legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json');

function requireSnapshot() {
  if (!fs.existsSync(SNAPSHOT_FILE)) {
    throw new Error(`Snapshot file missing: ${SNAPSHOT_FILE}. Run scripts/snapshotLegacyMainnetConfig.js first.`);
  }
  return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
}

function eqAddr(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function assertNoLinkPlaceholders(bytecode, label) {
  if (/__\$[0-9a-f]{34}\$__/i.test(bytecode) || /__[^_]{1,64}__/.test(bytecode)) {
    throw new Error(`Unresolved link references remain in ${label} bytecode`);
  }
}

async function setIfAvailable(instance, fnName, args, txOpts) {
  if (typeof instance[fnName] !== 'function') return false;
  await instance[fnName](...args, txOpts);
  return true;
}

module.exports = async function migration(deployer, network, accounts) {
  if ((process.env.USE_LEGACY_SNAPSHOT_MIGRATION || '') !== '1') {
    console.log('[legacy-snapshot-migration] skipped (set USE_LEGACY_SNAPSHOT_MIGRATION=1 to enable)');
    return;
  }

  const snapshot = requireSnapshot();
  const chainId = Number(await web3.eth.getChainId());
  if (chainId !== Number(snapshot.chainId)) {
    throw new Error(`ChainId mismatch. Snapshot=${snapshot.chainId}, connected=${chainId}`);
  }
  if (chainId === 1 && process.env.CONFIRM_MAINNET_DEPLOY !== '1') {
    throw new Error('Refusing mainnet deploy without CONFIRM_MAINNET_DEPLOY=1');
  }

  const from = accounts[0];
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

  assertNoLinkPlaceholders(AGIJobManager.binary, 'AGIJobManager');

  const cfg = snapshot.config;
  await deployer.deploy(
    AGIJobManager,
    cfg.agiToken,
    cfg.baseIpfsUrl,
    [cfg.ensRegistry, cfg.nameWrapper],
    [cfg.clubRootNode, cfg.agentRootNode, cfg.alphaClubRootNode, cfg.alphaAgentRootNode],
    [cfg.validatorMerkleRoot, cfg.agentMerkleRoot]
  );

  const instance = await AGIJobManager.deployed();

  const numericSetters = [
    ['setValidationRewardPercentage', cfg.validationRewardPercentage],
    ['setRequiredValidatorApprovals', cfg.requiredValidatorApprovals],
    ['setRequiredValidatorDisapprovals', cfg.requiredValidatorDisapprovals],
    ['setVoteQuorum', cfg.voteQuorum],
    ['setPremiumReputationThreshold', cfg.premiumReputationThreshold],
    ['setMaxJobPayout', cfg.maxJobPayout],
    ['setJobDurationLimit', cfg.jobDurationLimit],
    ['setCompletionReviewPeriod', cfg.completionReviewPeriod],
    ['setDisputeReviewPeriod', cfg.disputeReviewPeriod],
    ['setValidatorBondParams', [cfg.validatorBondBps, cfg.validatorBondMin, cfg.validatorBondMax]],
    ['setAgentBondParams', [cfg.agentBondBps, cfg.agentBond, cfg.agentBondMax]],
    ['setAgentBond', cfg.agentBond],
    ['setValidatorSlashBps', cfg.validatorSlashBps],
    ['setChallengePeriodAfterApproval', cfg.challengePeriodAfterApproval],
  ];

  for (const [fn, raw] of numericSetters) {
    if (raw === undefined || raw === null) continue;
    const args = Array.isArray(raw) ? raw.map((v) => v.toString()) : [raw.toString()];
    await setIfAvailable(instance, fn, args, { from });
  }

  await setIfAvailable(instance, 'setEnsJobPages', [cfg.ensJobPages], { from });
  await setIfAvailable(instance, 'setUseEnsJobTokenURI', [Boolean(cfg.useEnsJobTokenURI)], { from });

  for (const item of snapshot.roleSets.moderators) {
    await instance.addModerator(item.address, { from });
  }
  for (const item of snapshot.roleSets.additionalAgents) {
    await instance.addAdditionalAgent(item.address, { from });
  }
  for (const item of snapshot.roleSets.additionalValidators) {
    await instance.addAdditionalValidator(item.address, { from });
  }
  for (const item of snapshot.roleSets.blacklistedAgents) {
    await instance.blacklistAgent(item.address, true, { from });
  }
  for (const item of snapshot.roleSets.blacklistedValidators) {
    await instance.blacklistValidator(item.address, true, { from });
  }

  for (const agiType of snapshot.agiTypes) {
    if (agiType.enabled && Number(agiType.payoutPercentage) > 0) {
      try {
        await instance.addAGIType(agiType.nftAddress, agiType.payoutPercentage, { from });
      } catch (err) {
        throw new Error(`Failed addAGIType(${agiType.nftAddress}, ${agiType.payoutPercentage}): ${err.message}`);
      }
    }
  }
  for (const agiType of snapshot.agiTypes) {
    if (!agiType.enabled) {
      try {
        await instance.addAGIType(agiType.nftAddress, '1', { from });
      } catch (_) {
        // ignore if already exists or not accepted
      }
      try {
        await instance.disableAGIType(agiType.nftAddress, { from });
      } catch (err) {
        throw new Error(`Failed disableAGIType(${agiType.nftAddress}): ${err.message}`);
      }
    }
  }

  if (cfg.paused) {
    if (typeof instance.pauseIntake === 'function') await instance.pauseIntake({ from });
    else await instance.pause({ from });
  }
  if (cfg.settlementPaused) {
    if (typeof instance.setSettlementPaused === 'function') await instance.setSettlementPaused(true, { from });
    else if (typeof instance.pauseAll === 'function') await instance.pauseAll({ from });
  }

  if (cfg.lockIdentityConfig) {
    await instance.lockIdentityConfiguration({ from });
  }

  const targetOwner = process.env.NEW_OWNER || cfg.owner;
  if (!web3.utils.isAddress(targetOwner)) throw new Error(`Invalid owner address: ${targetOwner}`);
  if (!eqAddr(targetOwner, cfg.owner)) {
    console.log(`[legacy-snapshot-migration] overriding snapshot owner ${cfg.owner} -> ${targetOwner}`);
  }
  await instance.transferOwnership(web3.utils.toChecksumAddress(targetOwner), { from });

  function assertEq(label, actual, expected) {
    if (String(actual) !== String(expected)) {
      throw new Error(`Assertion failed for ${label}: actual=${actual} expected=${expected}`);
    }
  }

  assertEq('owner', await instance.owner(), web3.utils.toChecksumAddress(targetOwner));
  assertEq('agiToken', await instance.agiToken(), cfg.agiToken);
  assertEq('ens', await instance.ens(), cfg.ensRegistry);
  assertEq('nameWrapper', await instance.nameWrapper(), cfg.nameWrapper);
  assertEq('ensJobPages', await instance.ensJobPages(), cfg.ensJobPages);
  assertEq('clubRootNode', await instance.clubRootNode(), cfg.clubRootNode);
  assertEq('agentRootNode', await instance.agentRootNode(), cfg.agentRootNode);
  assertEq('alphaClubRootNode', await instance.alphaClubRootNode(), cfg.alphaClubRootNode);
  assertEq('alphaAgentRootNode', await instance.alphaAgentRootNode(), cfg.alphaAgentRootNode);
  assertEq('validatorMerkleRoot', await instance.validatorMerkleRoot(), cfg.validatorMerkleRoot);
  assertEq('agentMerkleRoot', await instance.agentMerkleRoot(), cfg.agentMerkleRoot);
  assertEq('paused', await instance.paused(), cfg.paused);
  assertEq('settlementPaused', await instance.settlementPaused(), cfg.settlementPaused);
  assertEq('lockIdentityConfig', await instance.lockIdentityConfig(), cfg.lockIdentityConfig);
  assertEq('useEnsJobTokenURI', await instance.useEnsJobTokenURI(), cfg.useEnsJobTokenURI);
  async function assertNumericIfDefined(label, getterName, expected) {
    if (expected === undefined || expected === null) return;
    assertEq(label, (await instance[getterName]()).toString(), expected);
  }

  await assertNumericIfDefined('requiredValidatorApprovals', 'requiredValidatorApprovals', cfg.requiredValidatorApprovals);
  await assertNumericIfDefined('requiredValidatorDisapprovals', 'requiredValidatorDisapprovals', cfg.requiredValidatorDisapprovals);
  await assertNumericIfDefined('voteQuorum', 'voteQuorum', cfg.voteQuorum);
  await assertNumericIfDefined('premiumReputationThreshold', 'premiumReputationThreshold', cfg.premiumReputationThreshold);
  await assertNumericIfDefined('validationRewardPercentage', 'validationRewardPercentage', cfg.validationRewardPercentage);
  await assertNumericIfDefined('maxJobPayout', 'maxJobPayout', cfg.maxJobPayout);
  await assertNumericIfDefined('jobDurationLimit', 'jobDurationLimit', cfg.jobDurationLimit);
  await assertNumericIfDefined('completionReviewPeriod', 'completionReviewPeriod', cfg.completionReviewPeriod);
  await assertNumericIfDefined('disputeReviewPeriod', 'disputeReviewPeriod', cfg.disputeReviewPeriod);
  await assertNumericIfDefined('validatorBondBps', 'validatorBondBps', cfg.validatorBondBps);
  await assertNumericIfDefined('validatorBondMin', 'validatorBondMin', cfg.validatorBondMin);
  await assertNumericIfDefined('validatorBondMax', 'validatorBondMax', cfg.validatorBondMax);
  await assertNumericIfDefined('validatorSlashBps', 'validatorSlashBps', cfg.validatorSlashBps);
  await assertNumericIfDefined('challengePeriodAfterApproval', 'challengePeriodAfterApproval', cfg.challengePeriodAfterApproval);
  await assertNumericIfDefined('agentBond', 'agentBond', cfg.agentBond);
  await assertNumericIfDefined('agentBondBps', 'agentBondBps', cfg.agentBondBps);
  await assertNumericIfDefined('agentBondMax', 'agentBondMax', cfg.agentBondMax);

  for (const item of snapshot.roleSets.moderators) assertEq(`moderator:${item.address}`, await instance.moderators(item.address), true);
  for (const item of snapshot.roleSets.additionalAgents) assertEq(`additionalAgent:${item.address}`, await instance.additionalAgents(item.address), true);
  for (const item of snapshot.roleSets.additionalValidators) assertEq(`additionalValidator:${item.address}`, await instance.additionalValidators(item.address), true);
  for (const item of snapshot.roleSets.blacklistedAgents) assertEq(`blacklistedAgent:${item.address}`, await instance.blacklistedAgents(item.address), true);
  for (const item of snapshot.roleSets.blacklistedValidators) assertEq(`blacklistedValidator:${item.address}`, await instance.blacklistedValidators(item.address), true);

  for (let i = 0; i < snapshot.agiTypes.length; i += 1) {
    const onchain = await instance.agiTypes(i);
    assertEq(`agiTypes[${i}].nftAddress`, onchain.nftAddress, snapshot.agiTypes[i].nftAddress);
    assertEq(`agiTypes[${i}].payoutPercentage`, onchain.payoutPercentage.toString(), snapshot.agiTypes[i].payoutPercentage);
  }

  console.log('Library deployment summary:');
  console.log(`- BondMath: ${BondMath.address}`);
  console.log(`- ENSOwnership: ${ENSOwnership.address}`);
  console.log(`- ReputationMath: ${ReputationMath.address}`);
  console.log(`- TransferUtils: ${TransferUtils.address}`);
  console.log(`- UriUtils: ${UriUtils.address}`);
  console.log(`- AGIJobManager: ${instance.address}`);
  console.log('- Note: baseIpfsUrl is private; cannot assert directly via public getter.');
  console.log('All assertions passed.');
};
