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

module.exports = async function (deployer, network, accounts) {
  if (network === 'development' || network === 'test') {
    return;
  }

  const chainId = Number(await web3.eth.getChainId());
  if (chainId !== Number(SNAPSHOT.chainId)) {
    throw new Error(`Snapshot chainId mismatch: connected=${chainId} snapshot=${SNAPSHOT.chainId}`);
  }
  if (chainId === 1 && process.env.CONFIRM_MAINNET_DEPLOY !== '1') {
    throw new Error('Refusing mainnet deployment without CONFIRM_MAINNET_DEPLOY=1');
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

  if (SNAPSHOT.numericParams.validationRewardPercentage) {
    await manager.setValidationRewardPercentage(SNAPSHOT.numericParams.validationRewardPercentage, { from: owner });
  }
  if (SNAPSHOT.numericParams.requiredValidatorApprovals) {
    await manager.setRequiredValidatorApprovals(SNAPSHOT.numericParams.requiredValidatorApprovals, { from: owner });
  }
  if (SNAPSHOT.numericParams.requiredValidatorDisapprovals) {
    await manager.setRequiredValidatorDisapprovals(SNAPSHOT.numericParams.requiredValidatorDisapprovals, { from: owner });
  }
  if (SNAPSHOT.numericParams.premiumReputationThreshold) {
    await manager.setPremiumReputationThreshold(SNAPSHOT.numericParams.premiumReputationThreshold, { from: owner });
  }
  if (SNAPSHOT.numericParams.maxJobPayout) {
    await manager.setMaxJobPayout(SNAPSHOT.numericParams.maxJobPayout, { from: owner });
  }
  if (SNAPSHOT.numericParams.jobDurationLimit) {
    await manager.setJobDurationLimit(SNAPSHOT.numericParams.jobDurationLimit, { from: owner });
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
    if (Number(row.payoutPercentage) > 0) {
      try {
        await manager.addAGIType(row.nftAddress, row.payoutPercentage, { from: owner });
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
  assertEq('requiredValidatorApprovals', await manager.requiredValidatorApprovals(), SNAPSHOT.numericParams.requiredValidatorApprovals);
  assertEq('requiredValidatorDisapprovals', await manager.requiredValidatorDisapprovals(), SNAPSHOT.numericParams.requiredValidatorDisapprovals);
  assertEq('premiumReputationThreshold', await manager.premiumReputationThreshold(), SNAPSHOT.numericParams.premiumReputationThreshold);
  assertEq('validationRewardPercentage', await manager.validationRewardPercentage(), SNAPSHOT.numericParams.validationRewardPercentage);
  assertEq('maxJobPayout', await manager.maxJobPayout(), SNAPSHOT.numericParams.maxJobPayout);
  assertEq('jobDurationLimit', await manager.jobDurationLimit(), SNAPSHOT.numericParams.jobDurationLimit);
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
