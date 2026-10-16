import { createHash } from 'node:crypto';
import { canonicalJson, createExplorerVerifier, prepareVerificationTask } from './explorer.mjs';

const digest = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const copy = value => JSON.parse(canonicalJson(value));
const stop = () => { throw new Error('VERIFICATION_AUTOMATION_BLOCKED'); };
const safeReport = (state, explorerStatus, packageSha256) => Object.freeze({ state, explorerStatus, ...(packageSha256 ? { packageSha256 } : {}), ...(state === 'blocked' ? { blocker: explorerStatus } : {}), authorityComplete: false, activationReady: false, productionApproved: false });

// A server-owned hook. No API key is read from process.env implicitly. The
// operator launch module may inject its secure environment value only when the
// exact immutable campaign authorizes this named service/source publication.
export function createVerificationAutomation({ apiKey, serviceAuthorization, fetch, sleep, clock, limits } = {}) {
  const authorization = serviceAuthorization ? copy(serviceAuthorization) : null;
  let serial = Promise.resolve();
  const hook = async ({ campaign, step, operationId, transactionHash, adapter, privateDirectory, readVerificationState, transitionVerificationState }) => {
    try {
      const graph = campaign?.reviewedManifest?.operations;
      if (!Array.isArray(graph) || !Number.isSafeInteger(step) || step < 0 || step >= graph.length || graph[step]?.operationId !== operationId) stop();
      const counts = adapter?.id === 'manager' ? { steps: 9, creations: 9 } : adapter?.id === 'alpha' ? { steps: 7, creations: 5 } : null;
      if (!counts || typeof adapter?.exportVerification !== 'function') return safeReport('unsupported', 'EXTERNAL_VERIFICATION_ADAPTER_UNSUPPORTED');
      if (graph.length !== counts.steps || !Object.isFrozen(adapter) || campaign.reviewedManifest.source?.repository !== adapter.supported?.repository || campaign.reviewedManifest.source?.commit !== adapter.supported?.commit || campaign.reviewedManifest.source?.tree !== adapter.supported?.tree) stop();
      if (step !== counts.steps - 1) return safeReport('pending', 'AWAITING_COMPLETE_CREATION_GRAPH');
      const context = { campaign, step, operationId, privateDir: privateDirectory };
      const observe = async () => {
        const observed = await adapter.observe(context);
        if (observed?.state !== 'verified' || observed.verified !== true || observed.finalized !== true || observed.transactionHash !== transactionHash) stop();
      };
      const exports = async () => {
        await observe();
        const output = await adapter.exportVerification(context);
        if (!Array.isArray(output?.tasks) || output.tasks.length !== counts.creations || new Set(output.tasks.map(task => task.address?.toLowerCase())).size !== counts.creations || new Set(output.tasks.map(task => task.creation?.transactionHash?.toLowerCase())).size !== counts.creations || output.activationAllowed !== false || output.explorerAcceptance !== 'NOT_OBSERVED') stop();
        const packages = output.tasks.map(prepareVerificationTask);
        if (new Set(packages.map(item => item.taskId)).size !== counts.creations) stop();
        return packages;
      };
      const packages = await exports();
      const packageSha256 = digest(packages.map(item => item.taskId));
      const expected = { service: 'etherscan-v2', submitSource: true, campaignId: campaign.campaignId, planSha256: campaign.reviewedManifest.planSha256 };
      const declared = campaign.verification?.serviceAuthorization;
      const authorized = authorization && declared && canonicalJson(authorization) === canonicalJson(expected) && canonicalJson(declared) === canonicalJson(expected);
      if (!authorized) return safeReport('exported', 'SOURCE_PACKAGES_EXPORTED', packageSha256);
      if (typeof apiKey !== 'string' || !apiKey || typeof readVerificationState !== 'function' || typeof transitionVerificationState !== 'function') return safeReport('blocked', 'EXPLORER_SECURE_SETUP_REQUIRED', packageSha256);
      const approvedTasks = new Set(packages.map(item => item.taskId));
      const verifier = createExplorerVerifier({
        apiKey, fetch, sleep, clock, limits,
        readState: readVerificationState,
        transition: transitionVerificationState,
        authorizeService: async info => ({ service: 'etherscan-v2', taskId: info.taskId, submitSource: approvedTasks.has(info.taskId) }),
        validateCanonical: async task => {
          const wanted = prepareVerificationTask(task);
          if (!approvedTasks.has(wanted.taskId)) stop();
          // Re-export through the genuine coordinator so receipt block identity,
          // runtime, full source/config and creation provenance are fresh. An
          // explorer result or task's own assertion cannot replace this check.
          const current = (await exports()).find(item => item.taskId === wanted.taskId);
          if (!current) stop();
          return { chainId: 1, address: current.task.address, ...current.task.creation, newTarget: true };
        },
      });
      const results = [];
      for (const item of packages) results.push(await verifier.verify(item.task));
      if (results.every(result => result.state === 'verified')) return safeReport('verified', 'ALL_EXACT_SOURCES_VERIFIED', packageSha256);
      if (results.some(result => ['blocked', 'recovery-required'].includes(result.state))) return safeReport('blocked', 'EXPLORER_VERIFICATION_INCOMPLETE', packageSha256);
      return safeReport('pending', 'EXPLORER_PENDING', packageSha256);
    } catch { return safeReport('blocked', 'VERIFICATION_AUTOMATION_BLOCKED'); }
  };
  return Object.freeze(context => {
    const result = serial.then(() => hook(context)); serial = result.catch(() => {}); return result;
  });
}
