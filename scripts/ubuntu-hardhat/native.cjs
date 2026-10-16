'use strict';
const path = require('node:path'), fs = require('node:fs'), { createRequire } = require('node:module');
const { GOVERNOR, SOURCES, need, canonical, pin, sourceGuard } = require('./safety.cjs');

async function loadNative(c, runtime) {
  const guard = sourceGuard(c.checkout, c.project), requireNative = createRequire(path.join(c.checkout, 'package.json'));
  const pins = [], read = file => { const p = pin(file); pins.push(p); return JSON.parse(p.bytes); };
  const unchanged = () => { guard.assert(); for (const p of pins) p.assert(); return true; };
  const native = relative => requireNative(path.join(c.checkout, relative));
  let plan, creator, planHash, prepare, current, fresh, checkSigned, reconcile, session;
  if (c.project === 'manager') {
    const P = native('hardhat/scripts/core-creation-plan.cjs'), S = native('hardhat/scripts/deployment-session.cjs'), V = native('hardhat/scripts/core-creation-verifier.cjs'), T = native('hardhat/scripts/transaction-envelope.cjs');
    const source = P.observedRevision(c.checkout);
    const qualified = native('hardhat/scripts/qualified-build-catalog.cjs').loadQualifiedBuild(c.catalogPath, { expectedCatalogSha256: c.catalogSha256, buildId: c.buildId, expectedRevision: source });
    plan = read(c.planFile); creator = plan.creator; planHash = plan.payloadSha256;
    need(plan.config.governor === GOVERNOR && plan.source.commit === SOURCES.manager[0], 'GOVERNOR_OR_SOURCE_MISMATCH');
    P.checkPlan(plan, qualified, source);
    const context = { directory: c.sessionPath, qualified, source, revalidateSource: unchanged, rpc: runtime.rpc };
    const state = () => { const s = S.readSession(c.sessionPath); need(canonical(s.plan) === canonical(plan), 'NATIVE_SESSION_PLAN_MISMATCH'); return s; };
    const prefix = () => state().state.filter(x => x.status === 'finalized').map(x => x.transactionHash);
    current = () => {
      const packet = S.retrieveHandoff(context); need(packet.status === 'handed-off' && !packet.transactionHash && !packet.relayAlreadyAttempted, 'NATIVE_OPERATION_ALREADY_SIGNED_OR_SENT');
      return { index: packet.index, operation: plan.operations[packet.index].name, envelope: packet.envelope, packet };
    };
    prepare = async () => { if (state().state.find(x => x.status !== 'finalized')?.status === 'planned') await S.handoff(context); return current(); };
    fresh = async () => { await V.preflight(plan, qualified, source, runtime.rpc, prefix()); qualified.assertUnchanged(); };
    checkSigned = (raw, p) => T.decodeSigned(raw, p.envelope);
    reconcile = () => S.reconcile(context);
    session = c.sessionPath;
  } else if (c.project === 'alpha') {
    const base = 'tests/contracts/scripts/', P = native(base + 'mainnet-authority.js'), S = native(base + 'authority-session.js');
    const revision = native(base + 'authority-revision.js').reviewedRevision(c.checkout);
    plan = read(c.planFile); creator = plan.config.deployer; planHash = plan.payloadSha256;
    need(plan.config.governor.address === GOVERNOR && plan.revision.commit === SOURCES.alpha[0], 'GOVERNOR_OR_SOURCE_MISMATCH');
    await P.checkPlan(plan, undefined, revision);
    const context = { plan, revision, filename: c.sessionPath, rpc: runtime.rpc, assertInputs: unchanged };
    const state = () => S.loadSession(c.sessionPath, plan, revision);
    current = async () => {
      const { packet } = await S.retrieveHandoff(context);
      need(packet.index < 5 && packet.envelope.from.toLowerCase() === creator.toLowerCase() && packet.envelope.to === null, 'GOVERNOR_CALL_IS_SEPARATE');
      return { index: packet.index, operation: P.NAMES[packet.index], envelope: packet.envelope, packet };
    };
    prepare = async () => {
      const s = state(); need(s.operations.length < 5 || s.operations.at(-1)?.status === 'handed-off', 'FIVE_CREATIONS_COMPLETE_GOVERNOR_BINDINGS_SEPARATE');
      if (s.operations.every(x => x.status === 'finalized')) await S.prepare(context);
      return current();
    };
    fresh = async () => {
      const s = state(), hashes = s.operations.filter(x => x.status === 'finalized').map(x => x.txHash);
      await P.preflight(plan, runtime.rpc, revision, hashes, plan.journal, []);
    };
    checkSigned = (raw, p) => S.validateSigned(raw, p.packet ? { ...state().operations[p.index].intent } : null);
    reconcile = () => S.reconcile(context);
    session = c.sessionPath;
  } else if (c.project === 'jobs') {
    const profilePin = pin(c.profilePath); pins.push(profilePin);
    need(profilePin.digest === c.profileSha256, 'REVIEWED_NATIVE_PROFILE_REQUIRED');
    const configPin = pin(c.deploymentConfigPath); pins.push(configPin);
    const P = native('scripts/deploy/external-profile.cjs'), E = native('scripts/deploy/external-envelope.cjs');
    const profile = P.loadExternalProfile(c.profilePath, { provider: runtime.provider, root: c.checkout, configBytes: configPin.bytes.toString('utf8'), configPath: c.deploymentConfigPath });
    plan = profile.plan; creator = plan.creator; planHash = profile.session.planHash; session = profile.sessionDirectory;
    need(plan.governor === GOVERNOR && plan.sourceCommit === SOURCES.jobs[0] && plan.sourceTree === SOURCES.jobs[1] && plan.chainId === 1 && plan.creatorCodeHash === runtime.E.keccak256('0x'), 'JOBS_EMPTY_CODE_NATIVE_PROFILE_REQUIRED');
    const state = () => profile.session.inspect();
    current = async () => {
      const packet = await profile.session.retrieve(); need(packet.status === 'signing-requested' && !packet.transactionHash, 'NATIVE_OPERATION_ALREADY_SIGNED_OR_SENT');
      return { index: packet.envelope.context.operationIndex, operation: packet.envelope.context.operationKey, envelope: { ...packet.envelope.transaction, from: creator }, packet };
    };
    prepare = async () => {
      const s = await state(), op = s.operations.at(-1); need(op, 'RUN_NATIVE_HARDHAT_STAGED_PREPARATION_FIRST');
      if (op.state === 'prepared') await profile.session.handoff({ planHash, unsignedHash: op.unsignedHash, policyHash: op.policyHash });
      return current();
    };
    fresh = async () => {
      profile.revalidateSource(); const s = await state();
      for (const op of s.operations.filter(x => ['observed', 'accepted'].includes(x.state)))
        await profile.session.requireObserved(op.key, await runtime.provider.getTransaction(op.transactionHash));
      profile.revalidateSource();
    };
    checkSigned = (raw, p) => E.importSignedEnvelope(p.packet.envelope, raw);
    reconcile = () => profile.session.observe();
  } else throw Error('UNSUPPORTED_PROJECT');
  need(creator && creator.toLowerCase() !== GOVERNOR.toLowerCase() && /^[0-9a-fx]{64,66}$/.test(planHash), 'DISTINCT_CREATOR_AND_NATIVE_PLAN_REQUIRED');
  const binding = { project: c.project, sourceCommit: guard.commit, sourceTree: guard.tree, planHash, creator, governor: GOVERNOR, session };
  return { binding, plan, prepare, current, fresh: async p => { unchanged(); await fresh(p); unchanged(); }, checkSigned, reconcile, assert: unchanged };
}
module.exports = { loadNative };
