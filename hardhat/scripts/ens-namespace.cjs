const ethers = require('ethers');

const DEFAULT_PARENT = 'alpha.jobs.agi.eth';
const FRESH_PREFIX = 'job-';
const HELPER_ABI = [
  'function jobManager() view returns(address)',
  'function jobsRootName() view returns(string)',
  'function jobsRootNode() view returns(bytes32)',
  'function jobLabelPrefix() view returns(string)',
  'function ens() view returns(address)',
];

function requireAddress(value, label) {
  if (!ethers.isAddress(value) || value.toLowerCase() === ethers.ZeroAddress) {
    throw new Error(`${label} must be a nonzero address.`);
  }
  return ethers.getAddress(value);
}

function deriveNamespace({ chainId, jobManager, parentName = DEFAULT_PARENT }) {
  if (!Number.isSafeInteger(chainId) || chainId < 1) throw new Error('Namespace chainId must be a positive safe integer.');
  const manager = requireAddress(jobManager, 'JOB_MANAGER');
  const parent = ethers.ensNormalize(parentName);
  if (!parent.includes('.')) throw new Error('JOBS_PARENT_NAME must be a reviewed ENS parent name, not a single label.');
  const rootLabel = `usdc-${chainId}-${manager.slice(2).toLowerCase()}`;
  const jobsRootName = `${rootLabel}.${parent}`;
  if (Buffer.byteLength(rootLabel) > 63 || Buffer.byteLength(jobsRootName) > 240) {
    throw new Error('Derived ENS namespace exceeds the helper label/root length limits.');
  }
  return { chainId, jobManager: manager, parentName: parent, parentNode: ethers.namehash(parent), rootLabel,
    jobsRootName, jobsRootNode: ethers.namehash(jobsRootName), jobLabelPrefix: FRESH_PREFIX,
    firstJobName: `${FRESH_PREFIX}0.${jobsRootName}` };
}

async function requireUnusedRoot(ens, node) {
  const [owner, resolver, ttl] = await Promise.all([ens.owner(node), ens.resolver(node), ens.ttl(node)]);
  if (owner !== ethers.ZeroAddress || resolver !== ethers.ZeroAddress || BigInt(ttl) !== 0n) {
    throw new Error('Fresh ENS jobs root already has ownership or records. Do not overwrite or adopt it; reconcile the existing deployment.');
  }
}

async function resolveNamespace({ chainId, jobManager, manager, ens, makeHelper, mode = 'fresh',
  parentName, requestedRootName, requestedPrefix, replaces }) {
  if (!['fresh', 'replacement'].includes(mode)) throw new Error('ENS_DEPLOYMENT_MODE must be fresh or replacement.');
  const currentHelper = await manager.ensJobPages();
  if (mode === 'fresh') {
    if (replaces) throw new Error('REPLACES_ENS_JOB_PAGES requires ENS_DEPLOYMENT_MODE=replacement.');
    if (currentHelper !== ethers.ZeroAddress || BigInt(await manager.nextJobId()) !== 0n) {
      throw new Error('Fresh ENS setup requires a manager with no configured helper and no allocated job IDs. Use the reviewed same-manager replacement path for an existing helper.');
    }
    if (chainId !== 1 && !parentName) throw new Error('JOBS_PARENT_NAME is required outside mainnet; supply the reviewed ENS parent for that network.');
    const plan = deriveNamespace({ chainId, jobManager, parentName: parentName || DEFAULT_PARENT });
    if (requestedRootName && ethers.ensNormalize(requestedRootName) !== plan.jobsRootName) {
      throw new Error(`JOBS_ROOT_NAME must match this deployment's derived namespace: ${plan.jobsRootName}. Legacy or arbitrary deployment roots cannot be reused.`);
    }
    if (requestedPrefix && requestedPrefix !== plan.jobLabelPrefix) throw new Error(`Fresh JOB_LABEL_PREFIX must be ${FRESH_PREFIX}.`);
    if (await ens.owner(plan.parentNode) === ethers.ZeroAddress) throw new Error('JOBS_PARENT_NAME is unowned on this ENS registry; establish and review the parent before deployment.');
    await requireUnusedRoot(ens, plan.jobsRootNode);
    return { mode, ...plan, replaces: null };
  }

  const oldAddress = requireAddress(replaces, 'REPLACES_ENS_JOB_PAGES');
  if (currentHelper.toLowerCase() !== oldAddress.toLowerCase()) {
    throw new Error('Replacement helper must be the target manager\'s current ensJobPages pointer.');
  }
  if (parentName) throw new Error('JOBS_PARENT_NAME applies only to fresh deployments; a replacement preserves its existing root.');
  const old = makeHelper(oldAddress, HELPER_ABI);
  const [boundManager, rootName, rootNode, prefix, registry] = await Promise.all([
    old.jobManager(), old.jobsRootName(), old.jobsRootNode(), old.jobLabelPrefix(), old.ens(),
  ]);
  if (boundManager.toLowerCase() !== jobManager.toLowerCase() || registry.toLowerCase() !== ens.target.toLowerCase()) {
    throw new Error('Replacement must preserve the same manager and ENS registry; cross-manager migration is forbidden.');
  }
  const normalized = ethers.ensNormalize(rootName);
  if (normalized !== rootName || ethers.namehash(normalized) !== rootNode || Buffer.byteLength(normalized) > 240) {
    throw new Error('Existing helper root name/node is inconsistent or unsupported; reconcile before replacement.');
  }
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(prefix) || /[0-9]$/.test(prefix)) {
    throw new Error('Existing helper prefix is unsupported; review exact historical labels before replacement.');
  }
  if ((requestedRootName && ethers.ensNormalize(requestedRootName) !== normalized)
    || (requestedPrefix && requestedPrefix !== prefix)) {
    throw new Error('Replacement preserves the current jobs root and prefix; do not rename existing jobs.');
  }
  if (await ens.owner(rootNode) === ethers.ZeroAddress) throw new Error('Replacement root is unowned; reconcile existing ENS authority before replacement.');
  return { mode, chainId, jobManager: ethers.getAddress(jobManager), jobsRootName: normalized,
    jobsRootNode: rootNode, jobLabelPrefix: prefix, replaces: oldAddress,
    firstJobName: null, note: 'Existing job labels must be read/imported exactly; the prefix is only a future-label default.' };
}

module.exports = { deriveNamespace, resolveNamespace, requireUnusedRoot, DEFAULT_PARENT, FRESH_PREFIX };
