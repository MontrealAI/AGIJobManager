const fs = require('fs');
const path = require('path');
const { parseDurationSeconds } = require('./durations');
const { namehash } = require('./namehash');

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '..', 'config', 'agijobmanager.config.js');

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function isObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, patch) {
  if (!isObject(base) || !isObject(patch)) return patch;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isObject(value) && isObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return out;
}

function loadModuleFromFile(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return { path: resolved, module: require(resolved) };
}

function resolveConfigPath() {
  if (process.env.AGIJOBMANAGER_CONFIG_PATH) {
    return path.isAbsolute(process.env.AGIJOBMANAGER_CONFIG_PATH)
      ? process.env.AGIJOBMANAGER_CONFIG_PATH
      : path.resolve(process.cwd(), process.env.AGIJOBMANAGER_CONFIG_PATH);
  }
  if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
    return DEFAULT_CONFIG_PATH;
  }
  throw new Error(
    'Missing deployment config. Copy migrations/config/agijobmanager.config.example.js to migrations/config/agijobmanager.config.js or set AGIJOBMANAGER_CONFIG_PATH.'
  );
}

function parseBoolean(v) {
  if (v === undefined || v === null || v === '') return null;
  const normalized = String(v).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  throw new Error(`Invalid boolean value: ${v}`);
}

function getNetworkOverride(configModule, network, chainId) {
  const networks = isObject(configModule.networks) ? configModule.networks : {};
  return networks[network] || networks[String(chainId)] || {};
}

function applyEnvOverrides(config) {
  const out = deepClone(config);
  out.authorizationRoots = out.authorizationRoots || {};
  out.authorizationRoots.roots = out.authorizationRoots.roots || {};
  const rootNodeEnvVars = [
    process.env.AGIJOBMANAGER_ROOT_CLUB_NODE,
    process.env.AGIJOBMANAGER_ROOT_AGENT_NODE,
    process.env.AGIJOBMANAGER_ROOT_ALPHA_CLUB_NODE,
    process.env.AGIJOBMANAGER_ROOT_ALPHA_AGENT_NODE,
  ];
  const hasRootNodeEnvOverride = rootNodeEnvVars.some((v) => v !== undefined && v !== null && v !== '');
  if (hasRootNodeEnvOverride && (out.authorizationRoots.rootNodes === null || out.authorizationRoots.rootNodes === undefined)) {
    out.authorizationRoots.rootNodes = {};
  }
  const setIf = (pathParts, value) => {
    if (value === undefined || value === null || value === '') return;
    let target = out;
    for (let i = 0; i < pathParts.length - 1; i += 1) {
      target = target[pathParts[i]];
    }
    target[pathParts[pathParts.length - 1]] = value;
  };

  setIf(['identity', 'agiTokenAddress'], process.env.AGIJOBMANAGER_AGI_TOKEN_ADDRESS);
  setIf(['identity', 'baseIpfsUrl'], process.env.AGIJOBMANAGER_BASE_IPFS_URL);
  setIf(['identity', 'ensRegistry'], process.env.AGIJOBMANAGER_ENS_REGISTRY);
  setIf(['identity', 'nameWrapper'], process.env.AGIJOBMANAGER_NAME_WRAPPER);
  setIf(['identity', 'ensJobPages'], process.env.AGIJOBMANAGER_ENS_JOB_PAGES);
  const useEnsJobTokenURI = parseBoolean(process.env.AGIJOBMANAGER_USE_ENS_JOB_TOKEN_URI);
  if (useEnsJobTokenURI !== null) out.identity.useEnsJobTokenURI = useEnsJobTokenURI;
  const lockIdentityConfiguration = parseBoolean(process.env.AGIJOBMANAGER_LOCK_IDENTITY_CONFIGURATION);
  if (lockIdentityConfiguration !== null) out.identity.lockIdentityConfiguration = lockIdentityConfiguration;

  setIf(['authorizationRoots', 'roots', 'clubName'], process.env.AGIJOBMANAGER_ROOT_CLUB_NAME);
  setIf(['authorizationRoots', 'roots', 'agentName'], process.env.AGIJOBMANAGER_ROOT_AGENT_NAME);
  setIf(['authorizationRoots', 'roots', 'alphaClubName'], process.env.AGIJOBMANAGER_ROOT_ALPHA_CLUB_NAME);
  setIf(['authorizationRoots', 'roots', 'alphaAgentName'], process.env.AGIJOBMANAGER_ROOT_ALPHA_AGENT_NAME);
  setIf(['authorizationRoots', 'rootNodes', 'clubRootNode'], process.env.AGIJOBMANAGER_ROOT_CLUB_NODE);
  setIf(['authorizationRoots', 'rootNodes', 'agentRootNode'], process.env.AGIJOBMANAGER_ROOT_AGENT_NODE);
  setIf(['authorizationRoots', 'rootNodes', 'alphaClubRootNode'], process.env.AGIJOBMANAGER_ROOT_ALPHA_CLUB_NODE);
  setIf(['authorizationRoots', 'rootNodes', 'alphaAgentRootNode'], process.env.AGIJOBMANAGER_ROOT_ALPHA_AGENT_NODE);

  setIf(['merkleRoots', 'validatorMerkleRoot'], process.env.AGIJOBMANAGER_VALIDATOR_MERKLE_ROOT);
  setIf(['merkleRoots', 'agentMerkleRoot'], process.env.AGIJOBMANAGER_AGENT_MERKLE_ROOT);

  setIf(['protocolParameters', 'requiredValidatorApprovals'], process.env.AGIJOBMANAGER_REQUIRED_VALIDATOR_APPROVALS);
  setIf(['protocolParameters', 'requiredValidatorDisapprovals'], process.env.AGIJOBMANAGER_REQUIRED_VALIDATOR_DISAPPROVALS);
  setIf(['protocolParameters', 'voteQuorum'], process.env.AGIJOBMANAGER_VOTE_QUORUM);
  setIf(['protocolParameters', 'validationRewardPercentage'], process.env.AGIJOBMANAGER_VALIDATION_REWARD_PERCENTAGE);
  setIf(['protocolParameters', 'premiumReputationThreshold'], process.env.AGIJOBMANAGER_PREMIUM_REPUTATION_THRESHOLD);
  setIf(['protocolParameters', 'maxJobPayout'], process.env.AGIJOBMANAGER_MAX_JOB_PAYOUT);
  setIf(['protocolParameters', 'jobDurationLimit'], process.env.AGIJOBMANAGER_JOB_DURATION_LIMIT);
  setIf(['protocolParameters', 'completionReviewPeriod'], process.env.AGIJOBMANAGER_COMPLETION_REVIEW_PERIOD);
  setIf(['protocolParameters', 'disputeReviewPeriod'], process.env.AGIJOBMANAGER_DISPUTE_REVIEW_PERIOD);
  setIf(['protocolParameters', 'challengePeriodAfterApproval'], process.env.AGIJOBMANAGER_CHALLENGE_PERIOD_AFTER_APPROVAL);
  setIf(['protocolParameters', 'validatorBondBps'], process.env.AGIJOBMANAGER_VALIDATOR_BOND_BPS);
  setIf(['protocolParameters', 'validatorBondMin'], process.env.AGIJOBMANAGER_VALIDATOR_BOND_MIN);
  setIf(['protocolParameters', 'validatorBondMax'], process.env.AGIJOBMANAGER_VALIDATOR_BOND_MAX);
  setIf(['protocolParameters', 'validatorSlashBps'], process.env.AGIJOBMANAGER_VALIDATOR_SLASH_BPS);
  setIf(['protocolParameters', 'agentBondBps'], process.env.AGIJOBMANAGER_AGENT_BOND_BPS);
  setIf(['protocolParameters', 'agentBondMin'], process.env.AGIJOBMANAGER_AGENT_BOND_MIN);
  setIf(['protocolParameters', 'agentBondMax'], process.env.AGIJOBMANAGER_AGENT_BOND_MAX);
  setIf(['protocolParameters', 'agentBondMinOverride'], process.env.AGIJOBMANAGER_AGENT_BOND_MIN_OVERRIDE);

  setIf(['ownership', 'finalOwner'], process.env.AGIJOBMANAGER_FINAL_OWNER);

  const paused = parseBoolean(process.env.AGIJOBMANAGER_PAUSED);
  if (paused !== null) out.operationalFlags.paused = paused;
  const settlementPaused = parseBoolean(process.env.AGIJOBMANAGER_SETTLEMENT_PAUSED);
  if (settlementPaused !== null) out.operationalFlags.settlementPaused = settlementPaused;

  return out;
}

function resolveRootNodes(authRoots, web3) {
  const roots = authRoots.roots || {};
  const derived = {
    clubRootNode: namehash(roots.clubName || roots.club || '', web3),
    agentRootNode: namehash(roots.agentName || roots.agent || '', web3),
    alphaClubRootNode: namehash(roots.alphaClubName || roots.alphaClub || '', web3),
    alphaAgentRootNode: namehash(roots.alphaAgentName || roots.alphaAgent || '', web3),
  };

  const explicit = authRoots.rootNodes;
  if (!explicit || !isObject(explicit)) {
    return derived;
  }

  return {
    clubRootNode: explicit.clubRootNode || derived.clubRootNode,
    agentRootNode: explicit.agentRootNode || derived.agentRootNode,
    alphaClubRootNode: explicit.alphaClubRootNode || derived.alphaClubRootNode,
    alphaAgentRootNode: explicit.alphaAgentRootNode || derived.alphaAgentRootNode,
  };
}

function normalizeDurations(parameters) {
  return {
    ...parameters,
    jobDurationLimit: parameters.jobDurationLimit === null || parameters.jobDurationLimit === undefined
      ? null
      : parseDurationSeconds(parameters.jobDurationLimit, 'protocolParameters.jobDurationLimit'),
    completionReviewPeriod: parameters.completionReviewPeriod === null || parameters.completionReviewPeriod === undefined
      ? null
      : parseDurationSeconds(parameters.completionReviewPeriod, 'protocolParameters.completionReviewPeriod'),
    disputeReviewPeriod: parameters.disputeReviewPeriod === null || parameters.disputeReviewPeriod === undefined
      ? null
      : parseDurationSeconds(parameters.disputeReviewPeriod, 'protocolParameters.disputeReviewPeriod'),
    challengePeriodAfterApproval: parameters.challengePeriodAfterApproval === null || parameters.challengePeriodAfterApproval === undefined
      ? null
      : parseDurationSeconds(parameters.challengePeriodAfterApproval, 'protocolParameters.challengePeriodAfterApproval'),
  };
}

function loadConfig({ network, chainId, web3 }) {
  const configPath = resolveConfigPath();
  const loaded = loadModuleFromFile(configPath);
  const defaults = loaded.module.defaults || {};
  const networkOverride = getNetworkOverride(loaded.module, network, chainId);
  const merged = deepMerge(defaults, networkOverride);
  const config = applyEnvOverrides(merged);

  config.protocolParameters = normalizeDurations(config.protocolParameters || {});
  config.authorizationRoots = config.authorizationRoots || {};

  const rootNodes = resolveRootNodes(config.authorizationRoots, web3);
  return {
    configPath: loaded.path,
    config,
    constructorArgs: {
      agiTokenAddress: config.identity.agiTokenAddress,
      baseIpfsUrl: config.identity.baseIpfsUrl,
      ensConfig: [config.identity.ensRegistry, config.identity.nameWrapper],
      rootNodes: [
        rootNodes.clubRootNode,
        rootNodes.agentRootNode,
        rootNodes.alphaClubRootNode,
        rootNodes.alphaAgentRootNode,
      ],
      merkleRoots: [config.merkleRoots.validatorMerkleRoot, config.merkleRoots.agentMerkleRoot],
      resolvedRootNodes: rootNodes,
    },
  };
}

module.exports = {
  loadConfig,
};
