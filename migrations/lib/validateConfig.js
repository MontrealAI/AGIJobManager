const { ZERO_ADDRESS, ZERO_BYTES32 } = require('./deployConfig');

function assert(condition, message) {
  if (!condition) throw new Error(`[deploy-config] ${message}`);
}

function isBytes32(value) {
  return /^0x[0-9a-fA-F]{64}$/.test(String(value || ''));
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ''));
}

function isNonNegativeInteger(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0;
  if (typeof value === 'string') return /^\d+$/.test(value);
  return false;
}

function validateAddressField(label, value, web3, { allowZero = false } = {}) {
  assert(isAddress(value), `${label} must be a valid address. Received: ${value}`);
  if (!allowZero) assert(value.toLowerCase() !== ZERO_ADDRESS.toLowerCase(), `${label} must not be zero address.`);
}

function validateOptionalAddressField(label, value, web3, { allowZero = true } = {}) {
  if (value === null || value === undefined || value === '') return;
  validateAddressField(label, value, web3, { allowZero });
}

function validateBps(label, value) {
  if (value === null || value === undefined) return;
  assert(isNonNegativeInteger(value), `${label} must be a non-negative integer.`);
  assert(value <= 10000, `${label} must be <= 10000 bps.`);
}

function validateUint(label, value) {
  if (value === null || value === undefined) return;
  assert(isNonNegativeInteger(value), `${label} must be a non-negative integer.`);
}

function validateConfig(config, web3) {
  validateAddressField('identity.agiTokenAddress', config.identity.agiTokenAddress, web3);
  validateAddressField('identity.ensRegistry', config.identity.ensRegistry, web3, { allowZero: true });
  validateAddressField('identity.nameWrapper', config.identity.nameWrapper, web3, { allowZero: true });

  assert(typeof config.identity.baseIpfsUrl === 'string', 'identity.baseIpfsUrl must be a string.');
  assert(config.identity.baseIpfsUrl.length > 0, 'identity.baseIpfsUrl must not be empty.');

  for (const [k, v] of Object.entries(config.resolvedRootNodes || {})) {
    assert(isBytes32(v), `resolvedRootNodes.${k} must be bytes32 hex.`);
  }
  assert(isBytes32(config.merkleRoots.validatorMerkleRoot), 'merkleRoots.validatorMerkleRoot must be bytes32 hex.');
  assert(isBytes32(config.merkleRoots.agentMerkleRoot), 'merkleRoots.agentMerkleRoot must be bytes32 hex.');

  validateUint('parameters.requiredValidatorApprovals', config.parameters.requiredValidatorApprovals);
  validateUint('parameters.requiredValidatorDisapprovals', config.parameters.requiredValidatorDisapprovals);
  validateUint('parameters.voteQuorum', config.parameters.voteQuorum);
  validateUint('parameters.validationRewardPercentage', config.parameters.validationRewardPercentage);
  if (config.parameters.validationRewardPercentage !== null && config.parameters.validationRewardPercentage !== undefined) {
    const rewardPct = Number(config.parameters.validationRewardPercentage);
    assert(rewardPct > 0 && rewardPct <= 100, 'parameters.validationRewardPercentage must be in (0,100].');
  }
  validateUint('parameters.premiumReputationThreshold', config.parameters.premiumReputationThreshold);
  validateUint('parameters.maxJobPayout', config.parameters.maxJobPayout);
  validateUint('parameters.jobDurationLimit', config.parameters.jobDurationLimit);
  validateUint('parameters.completionReviewPeriod', config.parameters.completionReviewPeriod);
  validateUint('parameters.disputeReviewPeriod', config.parameters.disputeReviewPeriod);
  validateUint('parameters.challengePeriodAfterApproval', config.parameters.challengePeriodAfterApproval);

  validateBps('parameters.validatorBondBps', config.parameters.validatorBondBps);
  validateBps('parameters.validatorSlashBps', config.parameters.validatorSlashBps);
  validateBps('parameters.agentBondBps', config.parameters.agentBondBps);

  validateUint('parameters.validatorBondMin', config.parameters.validatorBondMin);
  validateUint('parameters.validatorBondMax', config.parameters.validatorBondMax);
  validateUint('parameters.agentBondMin', config.parameters.agentBondMin);
  validateUint('parameters.agentBondMax', config.parameters.agentBondMax);
  validateUint('parameters.agentBond', config.parameters.agentBond);

  const toBig = (value, fallback) => BigInt(value === null || value === undefined ? fallback : String(value));

  const vbps = config.parameters.validatorBondBps;
  const vmin = config.parameters.validatorBondMin;
  const vmax = config.parameters.validatorBondMax;
  if (vbps !== null || vmin !== null || vmax !== null) {
    const bps = Number(vbps === null || vbps === undefined ? 1500 : vbps);
    const min = toBig(vmin, '10000000000000000000');
    const max = toBig(vmax, '88888888000000000000000000');
    assert(min <= max, 'parameters.validatorBondMin must be <= parameters.validatorBondMax.');
    if (bps === 0 && min === 0n) {
      assert(max === 0n, 'parameters.validatorBondMax must be 0 when validatorBondBps=0 and validatorBondMin=0.');
    } else {
      assert(max > 0n, 'parameters.validatorBondMax must be > 0 unless validator bonds are fully disabled.');
      assert(!(bps > 0 && min === 0n), 'parameters.validatorBondMin must be > 0 when validatorBondBps > 0.');
    }
  }

  const abps = config.parameters.agentBondBps;
  const amin = config.parameters.agentBondMin;
  const amax = config.parameters.agentBondMax;
  if (abps !== null || amin !== null || amax !== null) {
    const bps = Number(abps === null || abps === undefined ? 500 : abps);
    const min = toBig(amin, '1000000000000000000');
    const max = toBig(amax, '88888888000000000000000000');
    assert(min <= max, 'parameters.agentBondMin must be <= parameters.agentBondMax.');
    if (bps === 0 && min === 0n && max === 0n) {
      // valid fully-disabled mode
    } else {
      assert(max > 0n, 'parameters.agentBondMax must be > 0 unless agent bonds are fully disabled.');
    }
  }

  if (config.parameters.agentBond !== null && config.parameters.agentBondMax !== null) {
    assert(
      toBig(config.parameters.agentBond, '0') <= toBig(config.parameters.agentBondMax, '0'),
      'parameters.agentBond must be <= parameters.agentBondMax when both are specified.'
    );
  }

  const approvals = config.parameters.requiredValidatorApprovals;
  const disapprovals = config.parameters.requiredValidatorDisapprovals;
  if (approvals !== null && disapprovals !== null) {
    assert(Number(approvals) + Number(disapprovals) <= 50, 'requiredValidatorApprovals + requiredValidatorDisapprovals must be <= 50.');
  }
  if (config.parameters.voteQuorum !== null) {
    assert(Number(config.parameters.voteQuorum) > 0 && Number(config.parameters.voteQuorum) <= 50, 'parameters.voteQuorum must be 1..50.');
  }

  const validateAddressList = (label, addresses) => {
    assert(Array.isArray(addresses), `${label} must be an array.`);
    addresses.forEach((entry, i) => validateAddressField(`${label}[${i}]`, entry, web3));
  };

  validateAddressList('roles.moderators', config.roles.moderators);
  validateAddressList('roles.additionalAgents', config.roles.additionalAgents);
  validateAddressList('roles.additionalValidators', config.roles.additionalValidators);
  validateAddressList('roles.blacklistedAgents', config.roles.blacklistedAgents);
  validateAddressList('roles.blacklistedValidators', config.roles.blacklistedValidators);

  assert(Array.isArray(config.agiTypes), 'agiTypes must be an array.');
  const validationRewardPct = Number(
    config.parameters.validationRewardPercentage === null || config.parameters.validationRewardPercentage === undefined
      ? 8
      : config.parameters.validationRewardPercentage
  );
  const maxAGITypePayoutPct = 100 - validationRewardPct;
  assert(maxAGITypePayoutPct >= 0, 'parameters.validationRewardPercentage must be <= 100.');
  config.agiTypes.forEach((entry, i) => {
    assert(typeof entry === 'object' && entry !== null, `agiTypes[${i}] must be an object.`);
    if (entry.enabled === false) return;
    validateAddressField(`agiTypes[${i}].nftAddress`, entry.nftAddress, web3);
    validateUint(`agiTypes[${i}].payoutPercentage`, entry.payoutPercentage);
    assert(entry.payoutPercentage > 0 && entry.payoutPercentage <= 100, `agiTypes[${i}].payoutPercentage must be in (0,100].`);
    assert(
      Number(entry.payoutPercentage) <= maxAGITypePayoutPct,
      `agiTypes[${i}].payoutPercentage must be <= ${maxAGITypePayoutPct} when validationRewardPercentage=${validationRewardPct}.`
    );
  });

  validateOptionalAddressField('postDeployIdentity.ensJobPages', config.postDeployIdentity.ensJobPages, web3, { allowZero: true });
  if (config.postDeployIdentity.useEnsJobTokenURI !== null) {
    assert(typeof config.postDeployIdentity.useEnsJobTokenURI === 'boolean', 'postDeployIdentity.useEnsJobTokenURI must be boolean or null.');
  }
  assert(typeof config.postDeployIdentity.lockIdentityConfiguration === 'boolean', 'postDeployIdentity.lockIdentityConfiguration must be boolean.');

  validateOptionalAddressField('ownership.transferTo', config.ownership.transferTo, web3, { allowZero: false });

  const anyNonZeroRoot = config.constructorArgs.rootNodes.some((x) => String(x).toLowerCase() !== ZERO_BYTES32.toLowerCase());
  if (anyNonZeroRoot) {
    assert(
      config.identity.ensRegistry.toLowerCase() !== ZERO_ADDRESS.toLowerCase(),
      'identity.ensRegistry must be non-zero when any root node is non-zero.'
    );
  }

  return true;
}

module.exports = {
  validateConfig,
};
