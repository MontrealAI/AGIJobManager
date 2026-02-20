const fs = require('fs');
const path = require('path');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
const MAINNET_CHAIN_ID = 1;
const MAINNET_CONFIRMATION_VALUE = 'I_UNDERSTAND';

const DEFAULTS = {
  identity: {
    agiTokenAddress: '0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa',
    baseIpfsUrl: 'https://ipfs.io/ipfs/',
    ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    nameWrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
  },
  authRoots: {
    roots: {
      club: 'club.agi.eth',
      agent: 'agent.agi.eth',
      alphaClub: 'alpha.club.agi.eth',
      alphaAgent: 'alpha.agent.agi.eth',
    },
    rootNodes: null,
  },
  merkleRoots: {
    validatorMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
    agentMerkleRoot: '0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b',
  },
  parameters: {
    requiredValidatorApprovals: null,
    requiredValidatorDisapprovals: null,
    voteQuorum: null,
    validationRewardPercentage: null,
    premiumReputationThreshold: null,
    maxJobPayout: null,
    jobDurationLimit: null,
    completionReviewPeriod: null,
    disputeReviewPeriod: null,
    challengePeriodAfterApproval: null,
    validatorBondBps: null,
    validatorBondMin: null,
    validatorBondMax: null,
    validatorSlashBps: null,
    agentBondBps: null,
    agentBondMin: null,
    agentBondMax: null,
    agentBond: null,
  },
  roles: {
    moderators: [],
    additionalAgents: [],
    additionalValidators: [],
    blacklistedAgents: [],
    blacklistedValidators: [],
  },
  agiTypes: [
    {
      enabled: true,
      label: 'AIMYTHICAL NFT (example gate)',
      nftAddress: '0x130909390ac76c53986957814bde8786b8605ff3',
      payoutPercentage: 80,
    },
  ],
  operationalFlags: {
    paused: null,
    settlementPaused: null,
  },
  postDeployIdentity: {
    ensJobPages: null,
    useEnsJobTokenURI: null,
    lockIdentityConfiguration: false,
  },
  ownership: {
    transferTo: null,
  },
};

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function isObj(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, patch) {
  if (!isObj(base) || !isObj(patch)) return patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (isObj(v) && isObj(base[k])) out[k] = deepMerge(base[k], v);
    else out[k] = v;
  }
  return out;
}

function durationToSeconds(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase();
    if (!raw) return null;
    if (/^\d+$/.test(raw)) return Number(raw);
    const m = raw.match(/^(\d+)\s*([smhdw])$/);
    if (!m) throw new Error(`Invalid duration value "${value}". Use seconds or suffix s/m/h/d/w.`);
    const n = Number(m[1]);
    const unit = m[2];
    const f = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[unit];
    return n * f;
  }
  throw new Error(`Unsupported duration type: ${typeof value}`);
}

function loadExternalConfig(configPath) {
  if (!configPath) return {};
  const absPath = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(absPath)) throw new Error(`Config file not found: ${absPath}`);
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(absPath);
}

function envOr(v, fallback) {
  return v === undefined || v === null || String(v).trim() === '' ? fallback : v;
}

function parseBool(value) {
  if (value === undefined || value === null || value === '') return null;
  const x = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(x)) return true;
  if (['0', 'false', 'no', 'n'].includes(x)) return false;
  throw new Error(`Invalid boolean env value: ${value}`);
}

function parseJsonArray(value, label) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error('must be an array');
    return parsed;
  } catch (err) {
    throw new Error(`${label} must be valid JSON array: ${err.message}`);
  }
}

function applyEnvOverrides(config) {
  const out = deepClone(config);

  out.identity.agiTokenAddress = envOr(process.env.AGI_TOKEN_ADDRESS, out.identity.agiTokenAddress);
  out.identity.baseIpfsUrl = envOr(process.env.AGI_BASE_IPFS_URL, out.identity.baseIpfsUrl);
  out.identity.ensRegistry = envOr(process.env.AGI_ENS_REGISTRY, out.identity.ensRegistry);
  out.identity.nameWrapper = envOr(process.env.AGI_NAMEWRAPPER, out.identity.nameWrapper);

  out.merkleRoots.validatorMerkleRoot = envOr(process.env.AGI_VALIDATOR_MERKLE_ROOT, out.merkleRoots.validatorMerkleRoot);
  out.merkleRoots.agentMerkleRoot = envOr(process.env.AGI_AGENT_MERKLE_ROOT, out.merkleRoots.agentMerkleRoot);

  const rootsEnv = {
    clubRootNode: process.env.AGI_CLUB_ROOT_NODE,
    agentRootNode: process.env.AGI_AGENT_ROOT_NODE,
    alphaClubRootNode: process.env.AGI_ALPHA_CLUB_ROOT_NODE,
    alphaAgentRootNode: process.env.AGI_ALPHA_AGENT_ROOT_NODE,
  };
  if (Object.values(rootsEnv).some(Boolean)) {
    out.authRoots.rootNodes = {
      clubRootNode: envOr(rootsEnv.clubRootNode, out.authRoots.rootNodes?.clubRootNode || ZERO_BYTES32),
      agentRootNode: envOr(rootsEnv.agentRootNode, out.authRoots.rootNodes?.agentRootNode || ZERO_BYTES32),
      alphaClubRootNode: envOr(rootsEnv.alphaClubRootNode, out.authRoots.rootNodes?.alphaClubRootNode || ZERO_BYTES32),
      alphaAgentRootNode: envOr(rootsEnv.alphaAgentRootNode, out.authRoots.rootNodes?.alphaAgentRootNode || ZERO_BYTES32),
    };
  }

  const n = (k) => {
    if (process.env[k] === undefined) return null;
    const raw = String(process.env[k]).trim();
    if (!/^\d+$/.test(raw)) throw new Error(`${k} must be a non-negative integer string.`);
    return raw;
  };
  const duration = (k) => (process.env[k] === undefined ? null : process.env[k]);

  const parameterOverrides = {
    requiredValidatorApprovals: n('AGI_REQUIRED_VALIDATOR_APPROVALS'),
    requiredValidatorDisapprovals: n('AGI_REQUIRED_VALIDATOR_DISAPPROVALS'),
    voteQuorum: n('AGI_VOTE_QUORUM'),
    validationRewardPercentage: n('AGI_VALIDATION_REWARD_PERCENTAGE'),
    premiumReputationThreshold: n('AGI_PREMIUM_REPUTATION_THRESHOLD'),
    maxJobPayout: n('AGI_MAX_JOB_PAYOUT'),
    jobDurationLimit: n('AGI_JOB_DURATION_LIMIT'),
    completionReviewPeriod: duration('AGI_COMPLETION_REVIEW_PERIOD'),
    disputeReviewPeriod: duration('AGI_DISPUTE_REVIEW_PERIOD'),
    challengePeriodAfterApproval: duration('AGI_CHALLENGE_PERIOD_AFTER_APPROVAL'),
    validatorBondBps: n('AGI_VALIDATOR_BOND_BPS'),
    validatorBondMin: n('AGI_VALIDATOR_BOND_MIN'),
    validatorBondMax: n('AGI_VALIDATOR_BOND_MAX'),
    validatorSlashBps: n('AGI_VALIDATOR_SLASH_BPS'),
    agentBondBps: n('AGI_AGENT_BOND_BPS'),
    agentBondMin: n('AGI_AGENT_BOND_MIN'),
    agentBondMax: n('AGI_AGENT_BOND_MAX'),
    agentBond: n('AGI_AGENT_BOND'),
  };

  for (const [key, value] of Object.entries(parameterOverrides)) {
    if (value !== null) out.parameters[key] = value;
  }

  const moderators = parseJsonArray(process.env.AGI_MODERATORS_JSON, 'AGI_MODERATORS_JSON');
  const additionalAgents = parseJsonArray(process.env.AGI_ADDITIONAL_AGENTS_JSON, 'AGI_ADDITIONAL_AGENTS_JSON');
  const additionalValidators = parseJsonArray(process.env.AGI_ADDITIONAL_VALIDATORS_JSON, 'AGI_ADDITIONAL_VALIDATORS_JSON');
  const blacklistedAgents = parseJsonArray(process.env.AGI_BLACKLISTED_AGENTS_JSON, 'AGI_BLACKLISTED_AGENTS_JSON');
  const blacklistedValidators = parseJsonArray(process.env.AGI_BLACKLISTED_VALIDATORS_JSON, 'AGI_BLACKLISTED_VALIDATORS_JSON');
  if (moderators) out.roles.moderators = moderators;
  if (additionalAgents) out.roles.additionalAgents = additionalAgents;
  if (additionalValidators) out.roles.additionalValidators = additionalValidators;
  if (blacklistedAgents) out.roles.blacklistedAgents = blacklistedAgents;
  if (blacklistedValidators) out.roles.blacklistedValidators = blacklistedValidators;

  const agiTypes = parseJsonArray(process.env.AGI_TYPES_JSON, 'AGI_TYPES_JSON');
  if (agiTypes) out.agiTypes = agiTypes;

  const paused = parseBool(process.env.AGI_PAUSED);
  const settlementPaused = parseBool(process.env.AGI_SETTLEMENT_PAUSED);
  if (paused !== null) out.operationalFlags.paused = paused;
  if (settlementPaused !== null) out.operationalFlags.settlementPaused = settlementPaused;

  out.postDeployIdentity.ensJobPages = envOr(process.env.AGI_ENS_JOB_PAGES, out.postDeployIdentity.ensJobPages);
  const useEnsJobTokenURI = parseBool(process.env.AGI_USE_ENS_JOB_TOKEN_URI);
  const lockIdentityConfiguration = parseBool(process.env.AGI_LOCK_IDENTITY_CONFIGURATION);
  if (useEnsJobTokenURI !== null) out.postDeployIdentity.useEnsJobTokenURI = useEnsJobTokenURI;
  if (lockIdentityConfiguration !== null) out.postDeployIdentity.lockIdentityConfiguration = lockIdentityConfiguration;

  out.ownership.transferTo = envOr(process.env.AGI_TRANSFER_OWNERSHIP_TO, out.ownership.transferTo);

  return out;
}

function namehash(ensName, web3) {
  const labels = String(ensName || '').toLowerCase().split('.').filter(Boolean);
  let node = ZERO_BYTES32;
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    const labelHash = web3.utils.keccak256(labels[i]);
    node = web3.utils.soliditySha3({ type: 'bytes32', value: node }, { type: 'bytes32', value: labelHash });
  }
  return node;
}

function normalizeDurations(config) {
  const out = deepClone(config);
  out.parameters.completionReviewPeriod = durationToSeconds(out.parameters.completionReviewPeriod);
  out.parameters.disputeReviewPeriod = durationToSeconds(out.parameters.disputeReviewPeriod);
  out.parameters.challengePeriodAfterApproval = durationToSeconds(out.parameters.challengePeriodAfterApproval);
  return out;
}

function resolveNetworkConfig(rawConfig, network, chainId) {
  if (rawConfig.networks && rawConfig.networks[network]) return rawConfig.networks[network];
  if (rawConfig.networks && rawConfig.networks[String(chainId)]) return rawConfig.networks[String(chainId)];
  if (rawConfig[network]) return rawConfig[network];
  if (rawConfig[String(chainId)]) return rawConfig[String(chainId)];
  return rawConfig;
}

function resolveRootNodes(config, web3) {
  if (config.authRoots.rootNodes) {
    return {
      clubRootNode: config.authRoots.rootNodes.clubRootNode,
      agentRootNode: config.authRoots.rootNodes.agentRootNode,
      alphaClubRootNode: config.authRoots.rootNodes.alphaClubRootNode,
      alphaAgentRootNode: config.authRoots.rootNodes.alphaAgentRootNode,
    };
  }

  const roots = config.authRoots.roots || {};
  return {
    clubRootNode: namehash(roots.club, web3),
    agentRootNode: namehash(roots.agent, web3),
    alphaClubRootNode: namehash(roots.alphaClub, web3),
    alphaAgentRootNode: namehash(roots.alphaAgent, web3),
  };
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map(stableSortObject);
  if (!isObj(value)) return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = stableSortObject(value[key]);
    return acc;
  }, {});
}

function buildResolvedConfig({ network, chainId, web3 }) {
  const defaultConfig = deepClone(DEFAULTS);
  const configPath = process.env.DEPLOY_CONFIG_PATH || process.env.AGI_DEPLOY_CONFIG_PATH || '';
  const fileConfigRaw = loadExternalConfig(configPath);
  const fileConfig = resolveNetworkConfig(fileConfigRaw, network, chainId);

  let merged = deepMerge(defaultConfig, fileConfig || {});
  merged = applyEnvOverrides(merged);
  merged = normalizeDurations(merged);

  const rootNodes = resolveRootNodes(merged, web3);

  const resolved = {
    ...merged,
    metadata: {
      configPath: configPath || null,
      network,
      chainId,
    },
    constructorArgs: {
      agiTokenAddress: merged.identity.agiTokenAddress,
      baseIpfsUrl: merged.identity.baseIpfsUrl,
      ensConfig: [merged.identity.ensRegistry, merged.identity.nameWrapper],
      rootNodes: [
        rootNodes.clubRootNode,
        rootNodes.agentRootNode,
        rootNodes.alphaClubRootNode,
        rootNodes.alphaAgentRootNode,
      ],
      merkleRoots: [
        merged.merkleRoots.validatorMerkleRoot,
        merged.merkleRoots.agentMerkleRoot,
      ],
    },
    resolvedRootNodes: rootNodes,
  };

  const sortedForHash = stableSortObject(resolved);
  resolved.metadata.configHash = web3.utils.keccak256(JSON.stringify(sortedForHash));
  resolved.constants = {
    MAINNET_CHAIN_ID,
    MAINNET_CONFIRMATION_VALUE,
    ZERO_ADDRESS,
  };
  return resolved;
}

module.exports = {
  ZERO_ADDRESS,
  ZERO_BYTES32,
  MAINNET_CHAIN_ID,
  MAINNET_CONFIRMATION_VALUE,
  DEFAULTS,
  durationToSeconds,
  namehash,
  buildResolvedConfig,
};
