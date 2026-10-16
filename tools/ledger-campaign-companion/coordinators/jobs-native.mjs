import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { keccak256 } from 'ethers';
import { need, same, ordinary, readJson, sha256, observeSource, runtime } from './common.mjs';

const freeze = value => {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
};
export const JOBS_NATIVE_SUPPORTED = freeze({
  id: 'jobs-native', repository: 'MontrealAI/AGIJobsv0',
  commit: '9a79f38ad9edc448dc0b8d8cfa6157ee0c6f2bc5',
  tree: '720312acac83eddeeb76644e1e22f53578e91784',
  nodeVersions: ['22.23.3'], profile: 'jobs-external-manual-v1',
  planSchema: 'jobs-external-plan-v1', packetSchema: 'jobs-external-envelope-v1',
  sourceManifestSchema: 'jobs-reviewed-source-v1',
  operationCount: 39, componentCount: 25,
  creatorProfile: 'empty-code-eoa-type2',
  route: { token: '$AGIALPHA', decimals: 18 },
  stagedEntrypoint: 'scripts/v2/deployDefaults.ts',
  commandEntrypoint: 'scripts/v2/externalManual.ts',
  commandModule: 'scripts/deploy/external-command.cjs',
  profileModule: 'scripts/deploy/external-profile.cjs',
  commands: ['inspect', 'handoff', 'retrieve', 'import-signed', 'authorize-relay', 'observe', 'repair-head', 'recover-command'],
  qualification: {
    runId: 38954500102, artifactId: 12072489816,
    archiveSha256: '1da8f5a17978b92bf355537076125063b064c287d71b5c3e40858a9fcc33d025',
    member: 'qualification.json',
    memberSha256: '26f188a32c1bf62464c2239d3fad7ea729d1179265d24d5391ac66f23826787d',
    completeFreshCliPassed: true, nativeOperations: 39, creations: 25,
    compilerInputSha256: 'a962576832d4540c4cd682f9251b6eed2a333c87a1ce5fa61ed5716e7091b891',
  },
  productionApproved: false, deviceQualified: false, bootstrapQualified: false,
  productionPlanAccepted: false, markerCreatorQualified: false,
  companionTransportQualified: false, activationReady: false, globalAuthorityComplete: false,
});

export function verifyJobsQualification(bytes) {
  need(Buffer.isBuffer(bytes) && sha256(bytes) === JOBS_NATIVE_SUPPORTED.qualification.memberSha256, 'JOBS_QUALIFICATION_BYTES_MISMATCH');
  let report; try { report = JSON.parse(bytes.toString('utf8')); } catch { need(false, 'JOBS_QUALIFICATION_INVALID'); }
  need(report.schema === 'jobs-external-manual-hosted-public-v1' && report.passed === true &&
    same(report.source, { sourceCommit: JOBS_NATIVE_SUPPORTED.commit, sourceTree: JOBS_NATIVE_SUPPORTED.tree }), 'JOBS_QUALIFICATION_SOURCE_MISMATCH');
  need(report.nodeVersion === 'v22.23.3' && report.stages.length === 9 &&
    report.stages.every(stage => stage.passed === true && stage.code === 0 && stage.signal === null && stage.processGroupEmpty === true && stage.unexpectedRemainingGroupMembers === false), 'JOBS_QUALIFICATION_INCOMPLETE');
  need(report.operations.length === 39 && report.operations.every((op, index) => op.index === index && op.status === 1 && op.nonce === index) &&
    report.fixture.completedOperations === 39 && report.fixture.signatures === 39 && report.fixture.manualRelayInvocations === 39 && report.fixture.creations === 25, 'JOBS_QUALIFICATION_OPERATION_MISMATCH');
  need(['productionApproved', 'activationReady', 'globalAuthorityComplete', 'independentSourceApproval', 'bootstrapQualified', 'deviceQualified'].every(key => report[key] === false), 'JOBS_QUALIFICATION_SCOPE_MISMATCH');
  need(report.cleanup.ownedNodeStopped && report.cleanup.allOwnedFixtureChildrenStopped && !report.cleanup.unexpectedRemainingChildren && report.cleanup.sourceIdentityUnchanged && report.cleanup.trackedSourceClean && report.cleanup.completedOperations === 39, 'JOBS_QUALIFICATION_CLEANUP_INCOMPLETE');
  return freeze({ source: report.source, stages: report.stages, operationCount: 39, componentCount: 25,
    completeFreshCliPassed: true, nodeVersion: report.nodeVersion, compiler: report.canonicalCompiler,
    productionApproved: false, deviceQualified: false, bootstrapQualified: false, markerCreatorQualified: false,
    productionPlanAccepted: false, globalAuthorityComplete: false, activationReady: false });
}

// This profile check never replaces the native provider's current-code checks.
export function assertJobsNativePlanProfile(plan) {
  need(plan && plan.schema === JOBS_NATIVE_SUPPORTED.planSchema &&
    plan.sourceCommit === JOBS_NATIVE_SUPPORTED.commit && plan.sourceTree === JOBS_NATIVE_SUPPORTED.tree, 'JOBS_NATIVE_PLAN_SOURCE_MISMATCH');
  need(plan.creatorCodeHash === keccak256('0x'), 'JOBS_EMPTY_CODE_CREATOR_REQUIRED');
  need(plan.chainId === 1 && typeof plan.creator === 'string' && typeof plan.governor === 'string' &&
    plan.creator.toLowerCase() !== plan.governor.toLowerCase(), 'JOBS_EXPLICIT_PRODUCTION_ACTORS_REQUIRED');
  return true;
}

// Trusted local API only. Preparation remains the exact source's staged writer.
// The provider is independently selected by the operator; it is never taken from
// a browser request. Original native methods own every intent, lock and journal.
export function createJobsNativeDriver(configuration) {
  const config = Object.freeze({ ...configuration });
  need(config && typeof config.expectedProfileSha256 === 'string' && /^[a-f0-9]{64}$/.test(config.expectedProfileSha256), 'JOBS_INDEPENDENT_PROFILE_REVIEW_REQUIRED');
  observeSource(config, JOBS_NATIVE_SUPPORTED); runtime(config, JOBS_NATIVE_SUPPORTED);
  need(fs.realpathSync(process.execPath) === config.nodePath && process.versions.node === config.nodeVersion, 'JOBS_DRIVER_MUST_USE_REVIEWED_NODE');
  const initialProfile = ordinary(config.profilePath), profile = readJson(config.profilePath);
  need(sha256(initialProfile) === config.expectedProfileSha256 && profile.profile === JOBS_NATIVE_SUPPORTED.profile, 'JOBS_PROFILE_REVIEW_MISMATCH');
  const plan = readJson(profile.planFile); assertJobsNativePlanProfile(plan);
  const require = createRequire(path.join(config.checkout, 'package.json'));
  const { loadExternalProfile } = require(path.join(config.checkout, JOBS_NATIVE_SUPPORTED.profileModule));
  const { runCommand } = require(path.join(config.checkout, JOBS_NATIVE_SUPPORTED.commandModule));
  const native = loadExternalProfile(config.profilePath, { provider: config.provider, root: config.checkout,
    configPath: config.configPath, configBytes: ordinary(config.configPath).toString('utf8') });
  need(same(native.plan, plan), 'JOBS_NATIVE_PROFILE_PLAN_MISMATCH');
  const unchanged = () => {
    observeSource(config, JOBS_NATIVE_SUPPORTED); runtime(config, JOBS_NATIVE_SUPPORTED);
    need(sha256(ordinary(config.profilePath)) === config.expectedProfileSha256, 'JOBS_PROFILE_REVIEW_MISMATCH');
    native.revalidateSource();
  };
  unchanged();
  let tail = Promise.resolve();
  return Object.freeze({
    supported: JOBS_NATIVE_SUPPORTED,
    preparationEntrypoint: JOBS_NATIVE_SUPPORTED.stagedEntrypoint,
    command(request) {
      const pending = tail.then(async () => {
        unchanged();
        need(request && Object.getPrototypeOf(request) === Object.prototype && !Object.hasOwn(request, 'session') &&
          Reflect.ownKeys(request).every(key => typeof key === 'string' && Object.hasOwn(Object.getOwnPropertyDescriptor(request, key), 'value')) &&
          JOBS_NATIVE_SUPPORTED.commands.includes(request.command), 'JOBS_NATIVE_COMMAND_REJECTED');
        const result = await runCommand({ ...request, session: native.session });
        unchanged();
        return result;
      });
      tail = pending.catch(() => {});
      return pending;
    },
    productionApproved: false, activationReady: false, globalAuthorityComplete: false,
  });
}
