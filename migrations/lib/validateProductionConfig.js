const { ZERO_BYTES32 } = require('./namehash');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_PERIOD_SECONDS = 365 * 24 * 60 * 60;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isBytes32(value) {
  return /^0x[a-fA-F0-9]{64}$/.test(String(value || ''));
}

function asBigInt(value, label) {
  const raw = String(value);
  assert(/^\d+$/.test(raw), `${label} must be a non-negative integer string.`);
  return BigInt(raw);
}

function normalizeAddress(value, label, web3, { allowZero = false } = {}) {
  assert(typeof value === 'string', `${label} must be a string.`);
  const candidate = String(value).trim();
  const canonicalCandidate = web3.utils.isAddress(candidate) ? candidate : candidate.toLowerCase();
  assert(web3.utils.isAddress(canonicalCandidate), `${label} is not a valid address: ${value}`);
  const checksum = web3.utils.toChecksumAddress(canonicalCandidate);
  assert(allowZero || checksum.toLowerCase() !== ZERO_ADDRESS.toLowerCase(), `${label} cannot be the zero address.`);
  return checksum;
}


async function assertAddressHasCode(web3, label, address) {
  const code = await web3.eth.getCode(address);
  assert(code && code !== '0x', `${label} must point to deployed contract bytecode: ${address}`);
}

async function warnIfNoCode(web3, label, address, warnings) {
  if (!address || address.toLowerCase() === ZERO_ADDRESS.toLowerCase()) return;
  const code = await web3.eth.getCode(address);
  if (!code || code === '0x') warnings.push(`${label} (${address}) has no bytecode. VERIFY BEFORE MAINNET.`);
}

async function validateProductionConfig({ config, constructorArgs, chainId, web3 }) {
  const warnings = [];
  const identity = config.identity || {};
  const protocolParameters = config.protocolParameters || {};
  const dynamicLists = config.dynamicLists || {};

  identity.agiTokenAddress = normalizeAddress(identity.agiTokenAddress, 'identity.agiTokenAddress', web3);
  identity.ensRegistry = normalizeAddress(identity.ensRegistry, 'identity.ensRegistry', web3, { allowZero: true });
  identity.nameWrapper = normalizeAddress(identity.nameWrapper, 'identity.nameWrapper', web3, { allowZero: true });
  if (identity.ensJobPages) {
    identity.ensJobPages = normalizeAddress(identity.ensJobPages, 'identity.ensJobPages', web3, { allowZero: true });
  }
  assert(typeof identity.baseIpfsUrl === 'string', 'identity.baseIpfsUrl must be a string.');
  assert(Buffer.byteLength(identity.baseIpfsUrl, 'utf8') <= 512, 'identity.baseIpfsUrl must be <= 512 bytes.');

  await assertAddressHasCode(web3, 'identity.agiTokenAddress', identity.agiTokenAddress);
  if (identity.ensRegistry.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
    await assertAddressHasCode(web3, 'identity.ensRegistry', identity.ensRegistry);
  }
  if (identity.nameWrapper.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
    await assertAddressHasCode(web3, 'identity.nameWrapper', identity.nameWrapper);
  }
  if (identity.ensJobPages) await warnIfNoCode(web3, 'identity.ensJobPages', identity.ensJobPages, warnings);

  Object.entries(constructorArgs.resolvedRootNodes).forEach(([key, value]) => {
    assert(isBytes32(value), `authorizationRoots.${key} must resolve to bytes32.`);
  });

  assert(isBytes32(config.merkleRoots.validatorMerkleRoot), 'merkleRoots.validatorMerkleRoot must be bytes32.');
  assert(isBytes32(config.merkleRoots.agentMerkleRoot), 'merkleRoots.agentMerkleRoot must be bytes32.');

  const approvals = protocolParameters.requiredValidatorApprovals;
  const disapprovals = protocolParameters.requiredValidatorDisapprovals;
  if (approvals !== null && approvals !== undefined) {
    const n = Number(approvals);
    assert(Number.isInteger(n) && n >= 0 && n <= 50, 'protocolParameters.requiredValidatorApprovals must be 0..50.');
  }
  if (disapprovals !== null && disapprovals !== undefined) {
    const n = Number(disapprovals);
    assert(Number.isInteger(n) && n >= 0 && n <= 50, 'protocolParameters.requiredValidatorDisapprovals must be 0..50.');
  }
  const effectiveApprovals = Number(approvals ?? 3);
  const effectiveDisapprovals = Number(disapprovals ?? 3);
  assert(effectiveApprovals + effectiveDisapprovals <= 50, 'effective approvals + disapprovals must be <= 50.');

  if (protocolParameters.voteQuorum !== null && protocolParameters.voteQuorum !== undefined) {
    const quorum = Number(protocolParameters.voteQuorum);
    assert(Number.isInteger(quorum) && quorum >= 1 && quorum <= 50, 'protocolParameters.voteQuorum must be 1..50.');
  }

  if (protocolParameters.jobDurationLimit !== null && protocolParameters.jobDurationLimit !== undefined) {
    const limit = Number(protocolParameters.jobDurationLimit);
    assert(Number.isInteger(limit) && limit > 0, 'protocolParameters.jobDurationLimit must be > 0.');
  }

  ['completionReviewPeriod', 'disputeReviewPeriod', 'challengePeriodAfterApproval'].forEach((key) => {
    const v = protocolParameters[key];
    if (v === null || v === undefined) return;
    const n = Number(v);
    assert(Number.isInteger(n) && n > 0 && n <= MAX_PERIOD_SECONDS, `protocolParameters.${key} must be 1..31536000 seconds.`);
  });

  ['validatorBondBps', 'validatorSlashBps', 'agentBondBps'].forEach((key) => {
    const v = protocolParameters[key];
    if (v === null || v === undefined) return;
    const n = Number(v);
    assert(Number.isInteger(n) && n >= 0 && n <= 10000, `protocolParameters.${key} must be 0..10000.`);
  });

  const vBps = asBigInt(protocolParameters.validatorBondBps ?? '1500', 'protocolParameters.validatorBondBps');
  const vMin = asBigInt(protocolParameters.validatorBondMin ?? '10000000000000000000', 'protocolParameters.validatorBondMin');
  const vMax = asBigInt(protocolParameters.validatorBondMax ?? '88888888000000000000000000', 'protocolParameters.validatorBondMax');
  assert(vMin <= vMax, 'protocolParameters.validatorBondMin must be <= validatorBondMax.');
  if (vBps === 0n && vMin === 0n) assert(vMax === 0n, 'validator bond disabled mode must be (0,0,0).');
  if (!(vBps === 0n && vMin === 0n)) assert(vMax !== 0n && !(vBps > 0n && vMin === 0n), 'invalid validator bond parameters.');

  const aBps = asBigInt(protocolParameters.agentBondBps ?? '500', 'protocolParameters.agentBondBps');
  const aMin = asBigInt(protocolParameters.agentBondMin ?? '1000000000000000000', 'protocolParameters.agentBondMin');
  const aMax = asBigInt(protocolParameters.agentBondMax ?? '88888888000000000000000000', 'protocolParameters.agentBondMax');
  assert(aMin <= aMax, 'protocolParameters.agentBondMin must be <= agentBondMax.');
  if (!(aBps === 0n && aMin === 0n && aMax === 0n)) assert(aMax !== 0n, 'protocolParameters.agentBondMax must be non-zero when agent bond enabled.');

  if (protocolParameters.agentBondMinOverride !== null && protocolParameters.agentBondMinOverride !== undefined) {
    const over = asBigInt(protocolParameters.agentBondMinOverride, 'protocolParameters.agentBondMinOverride');
    if (aMax === 0n) assert(over === 0n, 'protocolParameters.agentBondMinOverride must be 0 when agent bonds disabled.');
    else assert(over <= aMax, 'protocolParameters.agentBondMinOverride must be <= agentBondMax.');
  }

  const valPct = Number(protocolParameters.validationRewardPercentage ?? 8);
  assert(Number.isInteger(valPct) && valPct >= 1 && valPct <= 100, 'protocolParameters.validationRewardPercentage must be 1..100.');
  const maxPayoutPct = 100 - valPct;
  assert(Array.isArray(config.agiTypes), 'agiTypes must be an array.');
  for (let i = 0; i < config.agiTypes.length; i += 1) {
    const agiType = config.agiTypes[i];
    agiType.nftAddress = normalizeAddress(agiType.nftAddress, `agiTypes[${i}].nftAddress`, web3);
    const pct = Number(agiType.payoutPercentage);
    assert(Number.isInteger(pct) && pct >= 1 && pct <= 100, `agiTypes[${i}].payoutPercentage must be 1..100.`);
    assert(pct <= maxPayoutPct, `agiTypes[${i}].payoutPercentage must be <= ${maxPayoutPct}.`);
    await warnIfNoCode(web3, `agiTypes[${i}].nftAddress`, agiType.nftAddress, warnings);
  }

  const validateAddressArray = (label, values) => {
    assert(Array.isArray(values), `${label} must be an array.`);
    return values.map((value) => normalizeAddress(value, label, web3));
  };

  dynamicLists.moderators = validateAddressArray('dynamicLists.moderators[]', dynamicLists.moderators || []);
  dynamicLists.additionalAgents = validateAddressArray('dynamicLists.additionalAgents[]', dynamicLists.additionalAgents || []);
  dynamicLists.additionalValidators = validateAddressArray('dynamicLists.additionalValidators[]', dynamicLists.additionalValidators || []);
  dynamicLists.blacklistedAgents = validateAddressArray('dynamicLists.blacklistedAgents[]', dynamicLists.blacklistedAgents || []);
  dynamicLists.blacklistedValidators = validateAddressArray('dynamicLists.blacklistedValidators[]', dynamicLists.blacklistedValidators || []);

  if (Number(chainId) === 1 && config.ownership.requireFinalOwnerOnMainnet) {
    assert(config.ownership.finalOwner, 'ownership.finalOwner is required on mainnet when requireFinalOwnerOnMainnet=true.');
  }
  if (config.ownership.finalOwner) {
    config.ownership.finalOwner = normalizeAddress(config.ownership.finalOwner, 'ownership.finalOwner', web3);
  }

  if (Object.values(constructorArgs.resolvedRootNodes).some((v) => String(v).toLowerCase() !== ZERO_BYTES32.toLowerCase())) {
    assert(identity.ensRegistry.toLowerCase() !== ZERO_ADDRESS.toLowerCase(), 'identity.ensRegistry must be non-zero when root nodes are configured.');
  }

  return { warnings };
}

module.exports = {
  validateProductionConfig,
};
