import { Transaction } from 'ethers';
import { validateIntent, attachAndValidateSignature } from '../src/envelope.mjs';
import { coordinatorImport } from '../src/coordinator-import.mjs';
import { BridgeError, exactFields, reject } from './errors.mjs';
import { canonical, sha256, openPrivateStore } from './private-store.mjs';

const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/;
const hashPattern = /^0x[0-9a-f]{64}$/;
const copy = value => JSON.parse(JSON.stringify(value));
const deepFreeze = value => { if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; };
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
const fields = (value, allowed) => Object.fromEntries(allowed.filter(key => value?.[key] !== undefined).map(key => [key, copy(value[key])]));
const stateNames = new Set(['awaiting-owner-approval', 'signing-requested', 'signed', 'submitted', 'pending', 'finalized', 'verified', 'blocked', 'recovery-required']);

function checkedDisplay(campaign, inspection) {
  const sameAddress = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
  for (const role of ['creator', 'governor']) if (inspection?.[role] !== undefined && !sameAddress(inspection[role], campaign.actors?.[role])) reject('CAMPAIGN_METADATA_MISMATCH');
  if (['manager', 'alpha'].includes(campaign.adapter) && (!inspection?.creator || !inspection?.governor || !inspection?.route)) reject('COORDINATOR_METADATA_REQUIRED');
  if (inspection?.route && (!sameAddress(inspection.route.address, campaign.route?.token) || inspection.route.decimals !== campaign.route?.decimals || inspection.route.token.replace(/^\$/, '') !== campaign.route?.symbol?.replace(/^\$/, ''))) reject('CAMPAIGN_METADATA_MISMATCH');
  if (inspection?.feeWallets) {
    if (!Array.isArray(inspection.feeWallets) || !Array.isArray(campaign.actors?.feeRecipients) || inspection.feeWallets.length !== campaign.actors.feeRecipients.length || inspection.feeWallets.some((address, index) => !sameAddress(address, campaign.actors.feeRecipients[index].address))) reject('CAMPAIGN_METADATA_MISMATCH');
  } else if (['manager', 'alpha'].includes(campaign.adapter) && campaign.actors?.feeRecipients?.length) reject('UNSUPPORTED_FEE_METADATA');
  if (['manager', 'alpha'].includes(campaign.adapter) && campaign.actors?.treasuries?.length) reject('UNSUPPORTED_TREASURY_METADATA');
  if (inspection?.maximumTotalFeeWei !== undefined && String(inspection.maximumTotalFeeWei) !== campaign.maxTotalFeeWei) reject('CAMPAIGN_METADATA_MISMATCH');
  const display = fields(campaign, ['campaignId', 'network', 'route', 'actors', 'qualification', 'maxTotalFeeWei', 'expiresAt']);
  display.network = { chainId: '1', name: 'Ethereum Mainnet' };
  if (inspection?.route) display.route = { name: `${inspection.route.token} route`, token: inspection.route.address, symbol: inspection.route.token.replace(/^\$/, ''), decimals: inspection.route.decimals };
  if (inspection?.feeWallets) display.actors.feeRecipients = inspection.feeWallets.map((address, index) => ({ role: `settlementWallets[${index}]`, address }));
  display.coordinatorDetails = fields(inspection, ['configurationScope', 'graph', 'parameters', 'governanceBindings', 'ensDependencies', 'nativePlanExpiry', 'expiresAfterBlock', 'wallClockExpiryScope']);
  display.qualification = { source: inspection?.candidateQualification ?? 'REVIEW_CANDIDATE_NOT_MAINNET_QUALIFIED', browser: 'BROWSER_ACCEPTANCE_PENDING_DOM_FIXTURES_ONLY', coordinator: 'SUPPORTED_SCOPE_REQUIRES_EXACT_LOCAL_ACCEPTANCE', physical: 'PENDING_OWNER_DEVICE_ACCEPTANCE', provider: 'PENDING_OWNER_ENDPOINT_ACCEPTANCE', configuration: 'SUPPORTED_SCOPE_ONLY_NOT_COMPLETE', explorer: 'PENDING_EXACT_BUILD_VERIFICATION', authority: 'BOUNDED_ONLY_FULL_AUTHORITY_FALSE' };
  return display;
}

function validateCampaign(campaign, adapter, now) {
  if (!campaign || typeof campaign !== 'object' || Array.isArray(campaign) || canonical(campaign).length > 2 * 1024 * 1024 || campaign.format !== 'manual-ledger-campaign-v1' || !idPattern.test(campaign.campaignId ?? '') || campaign.adapter !== adapter.id) reject('INVALID_CAMPAIGN');
  const manifest = campaign.reviewedManifest;
  if (!manifest || !manifest.source || manifest.source.repository !== adapter.supported.repository || manifest.source.commit !== adapter.supported.commit || !/^[0-9a-f]{40}$/.test(manifest.source.tree ?? '') || (adapter.supported.tree && manifest.source.tree !== adapter.supported.tree) || campaign.packetSchema !== adapter.supported.packetSchema || !/^[0-9a-f]{64}$/.test(manifest.planSha256 ?? '') || !hashPattern.test(manifest.sourceSha256 ?? '')) reject('UNSUPPORTED_COORDINATOR');
  if (!timestamp(campaign.expiresAt) || campaign.network?.chainId !== '1' || !Array.isArray(manifest.operations) || manifest.operations.length > 128 || !Array.isArray(campaign.operations) || campaign.operations.length !== manifest.operations.length || !/^(0|[1-9][0-9]{0,77})$/.test(campaign.maxTotalFeeWei ?? '')) reject('INVALID_CAMPAIGN');
  let totalFee = 0n;
  for (const [index, operation] of manifest.operations.entries()) {
    exactFields(operation, ['operationId', 'unsignedHex', 'expectedUnsignedHash', 'expectedPolicyHash', 'review']);
    const prepared = validateIntent(operation.unsignedHex, operation.expectedUnsignedHash, operation.review, operation.expectedPolicyHash, now, { allowExpired: true });
    const tx = Transaction.from(prepared.unsignedHex), destination = tx.to ?? 'CREATE';
    if (operation.operationId !== prepared.review.operationId || prepared.review.sourceSha256.toLowerCase() !== manifest.sourceSha256 || prepared.review.expiresAt !== campaign.expiresAt || campaign.operations[index].index !== index || !['creator', 'governor'].includes(campaign.operations[index].account) || prepared.sender.toLowerCase() !== campaign.actors?.[campaign.operations[index].account]?.toLowerCase() || campaign.operations[index].destination !== destination) reject('INVALID_CAMPAIGN');
    const dependencies = campaign.operations[index].dependsOn;
    if (!Array.isArray(dependencies) || dependencies.some(value => !Number.isSafeInteger(value) || value < 0 || value >= index)) reject('INVALID_CAMPAIGN');
    totalFee += BigInt(prepared.summary.maximumGasCostWei);
  }
  if (totalFee > BigInt(campaign.maxTotalFeeWei)) reject('CAMPAIGN_FEE_BUDGET_EXCEEDED');
  if (new Set(manifest.operations.map(operation => operation.operationId)).size !== manifest.operations.length) reject('INVALID_CAMPAIGN');
}

function checkedCapability(prepared, capability, now) {
  exactFields(capability, ['format', 'status', 'signedAt', 'transactionHash', 'unsignedTransaction', 'expectedUnsignedHash', 'expectedPolicyHash', 'review', 'signedTransaction']);
  if (!timestamp(capability.signedAt) || Date.parse(capability.signedAt) > now || typeof capability.signedTransaction !== 'string' || !/^0x(?:[0-9a-f]{2})+$/.test(capability.signedTransaction) || capability.signedTransaction.length > 262338 || !['SIGNED_NOT_SUBMITTED', 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY'].includes(capability.status)) reject('INVALID_SIGNED_CAPABILITY');
  let signed;
  try { signed = Transaction.from(capability.signedTransaction); } catch { reject('INVALID_SIGNED_CAPABILITY'); }
  if (!signed.signature || signed.serialized !== capability.signedTransaction) reject('INVALID_SIGNED_CAPABILITY');
  let rebuilt;
  try { rebuilt = attachAndValidateSignature(prepared, signed.signature, Date.parse(capability.signedAt)); } catch { reject('SIGNED_ENVELOPE_MISMATCH'); }
  const comparable = { ...capability, status: rebuilt.status };
  if (canonical(comparable) !== canonical(rebuilt)) reject('SIGNED_ENVELOPE_MISMATCH');
  const current = validateIntent(prepared.unsignedHex, prepared.expectedUnsignedHash, prepared.review, prepared.expectedPolicyHash, now, { allowExpired: true });
  return { transactionHash: rebuilt.transactionHash, expired: current.expired || capability.status === 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY' || rebuilt.status === 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY' };
}

export async function createCampaignEngine({ campaign: suppliedCampaign, adapter, privateDirectory, forbiddenRoots = [], relayEnabled = false, now = Date.now, afterVerified, recoverDeadOwner = false }) {
  const campaign = deepFreeze(copy(suppliedCampaign));
  if (!adapter || !Object.isFrozen(adapter) || !['inspectCampaign', 'prepare', 'importSigned', 'observe', 'relayOne'].every(method => typeof adapter[method] === 'function')) reject('UNSUPPORTED_COORDINATOR');
  validateCampaign(campaign, adapter, now());
  if (typeof relayEnabled !== 'boolean' || (relayEnabled && (campaign.relayPolicy?.enabled !== true || campaign.relayPolicy?.acknowledgementMode !== 'EXACT_COORDINATOR_PER_STEP'))) reject('RELAY_NOT_REVIEW_ENABLED');
  if (campaign.relayPolicy !== undefined) exactFields(campaign.relayPolicy, ['enabled', 'acknowledgementMode']);
  let inspection, sourceBlocked = false;
  try { inspection = await adapter.inspectCampaign(campaign); } catch { sourceBlocked = true; }
  const display = sourceBlocked ? { ...fields(campaign, ['campaignId', 'network', 'route', 'actors', 'maxTotalFeeWei', 'expiresAt']), coordinatorDetails: { configurationScope: 'SOURCE_INSPECTION_BLOCKED_READ_ONLY_RECOVERY' }, qualification: Object.fromEntries(['source','browser','coordinator','physical','provider','configuration','explorer','authority'].map(key => [key, 'SOURCE_INSPECTION_BLOCKED_READ_ONLY_RECOVERY'])) } : checkedDisplay(campaign, inspection);
  const store = await openPrivateStore({ directory: privateDirectory, campaign, forbiddenRoots: [...forbiddenRoots, campaign.coordinator?.checkout].filter(Boolean), recoverDeadOwner });
  let state = store.snapshot ?? { steps: campaign.reviewedManifest.operations.map((_operation, index) => sourceBlocked || inspection?.canPrepare === false || inspection?.state === 'blocked' ? { index, state: 'blocked', blocker: sourceBlocked ? 'SOURCE_INSPECTION_BLOCKED' : 'COORDINATOR_UNSUPPORTED' } : { index, state: 'awaiting-owner-approval' }), verificationTasks: {} };
  if (!store.snapshot) await store.append(state);
  if (store.recoveredOwner) { state.bridgeRecoveryRequired = true; await store.append(state); }
  for (const retained of await store.readCapabilities()) {
    const step = state.steps[retained.step];
    if (!step?.prepared || !step.signingRequestedAt) reject('PRIVATE_STATE_REJECTED');
    const checked = checkedCapability(step.prepared, retained.value, now());
    if (step.transactionHash && step.transactionHash !== checked.transactionHash) reject('PRIVATE_STATE_REJECTED');
    if (!step.transactionHash) { step.transactionHash = checked.transactionHash; step.capabilityFile = retained.name; step.state = 'recovery-required'; step.blocker = checked.expired ? 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY' : 'DURABLE_CAPABILITY_IMPORT_OUTCOME_UNKNOWN'; await store.append(state); }
  }
  let tail = Promise.resolve(), closed = false;
  const serial = fn => {
    const result = tail.then(async () => { if (closed) reject('ENGINE_CLOSED'); return fn(); });
    tail = result.catch(() => {}); return result;
  };
  const append = async () => store.append(copy(state));
  const stepAt = (index, operationId) => {
    if (!Number.isSafeInteger(index) || index < 0 || index >= state.steps.length) reject('INVALID_STEP');
    const step = state.steps[index];
    if (operationId !== undefined && operationId !== campaign.reviewedManifest.operations[index].operationId) reject('OPERATION_ID_MISMATCH');
    return step;
  };
  const freshness = () => { if (now() >= Date.parse(campaign.expiresAt)) reject('CAMPAIGN_EXPIRED'); };
  const nextOnly = index => {
    if (state.steps.some((step, earlier) => earlier < index && step.state !== 'verified') || campaign.operations[index].dependsOn.some(dependency => state.steps[dependency].state !== 'verified')) reject('DEPENDENCY_NOT_VERIFIED');
  };
  const publicStep = step => ({ ...fields(step, ['index', 'state', 'operationId', 'transactionHash', 'blocker', 'signingRequestedAt', 'verification', 'relayAttempted']), ...(relayEnabled && !sourceBlocked && step.state === 'signed' && !step.relayAttempted && step.acknowledgement ? { acknowledgement: step.acknowledgement } : {}) });
  const status = () => ({ format: 'manual-ledger-campaign-status-v1', campaign: {
    ...copy(display),
    operations: campaign.operations.map((operation, index) => {
      const actual = inspection?.graph?.[index], governance = inspection?.governanceBindings?.[index - (inspection?.graph?.length ?? 0)];
      return { ...copy(operation), ...(actual ? { purpose: `${actual.name} — CREATE`, decodedArguments: copy(actual.constructorArguments), expectedPostState: copy(actual.expectedPostState ?? { status: 'NOT_SUPPLIED_BY_SUPPORTED_COORDINATOR' }), displayScope: actual.displayScope ?? 'HOST_DECODED_NOT_DEVICE_CONFIRMED', deviceSemanticsConfirmed: false } : governance ? { purpose: `${governance.name} — ${governance.method}`, decodedArguments: fields(governance, ['method', 'arguments', 'argument', 'from', 'to', 'data', 'value']), expectedPostState: copy(governance.expectedPostState ?? { status: 'NOT_SUPPLIED_BY_SUPPORTED_COORDINATOR' }), displayScope: governance.displayScope ?? 'HOST_DECODED_NOT_DEVICE_CONFIRMED', deviceSemanticsConfirmed: false } : {}), envelope: copy(validateIntent(campaign.reviewedManifest.operations[index].unsignedHex, campaign.reviewedManifest.operations[index].expectedUnsignedHash, campaign.reviewedManifest.operations[index].review, campaign.reviewedManifest.operations[index].expectedPolicyHash, now(), { allowExpired: true }).summary) };
    }),
    identity: { ...campaign.reviewedManifest.source, packetSchema: campaign.packetSchema, sourceSha256: campaign.reviewedManifest.sourceSha256, planSha256: campaign.reviewedManifest.planSha256, ...(campaign.coordinator?.buildId ? { buildId: campaign.coordinator.buildId } : {}) }
  }, steps: state.steps.map(publicStep), relayEnabled: relayEnabled && !sourceBlocked && !state.bridgeRecoveryRequired, sourceBlocked, bridgeRecoveryRequired: state.bridgeRecoveryRequired === true, readiness: { authorityComplete: false, activationReady: false, physicalQualified: false } });
  const readOnlyObserve = async (index, operationId) => {
    const step = stepAt(index, operationId);
    let result;
    try {
      result = await adapter.observe({ campaign, step: index, operationId: campaign.reviewedManifest.operations[index].operationId, privateDir: store.root });
      if (!result || !stateNames.has(result.state)) reject('COORDINATOR_RESULT_REJECTED');
      if (result.transactionHash !== undefined && (!hashPattern.test(result.transactionHash) || (step.transactionHash && step.transactionHash !== result.transactionHash))) reject('CANONICAL_RESULT_CHANGED');
      if (result.state === 'verified' && (result.verified !== true || result.finalized !== true || !step.transactionHash)) reject('COORDINATOR_RESULT_REJECTED');
    } catch (error) { step.state = 'recovery-required'; step.blocker = 'CANONICAL_OBSERVATION_UNAVAILABLE'; await append(); throw error; }
    if (result.state === 'verified') { step.state = 'verified'; delete step.blocker; }
    else { step.state = result.state; step.blocker = result.blocker && /^[A-Z_]{1,96}$/.test(result.blocker) ? result.blocker : 'CANONICAL_RESULT_NOT_VERIFIED'; }
    if (result.transactionHash) step.transactionHash = result.transactionHash;
    if (state.bridgeRecoveryRequired && ['blocked', 'signed', 'verified'].includes(result.state)) state.bridgeRecoveryRequired = false;
    await append();
    if (step.state === 'verified' && typeof afterVerified === 'function') {
      let hookActive = true, verificationTail = Promise.resolve();
      try {
        const readVerificationState = taskId => {
          if (!hookActive) reject('VERIFICATION_CONTEXT_CLOSED');
          if (typeof taskId !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/.test(taskId)) reject('INVALID_VERIFICATION_STATE');
          return state.verificationTasks?.[taskId] ? copy(state.verificationTasks[taskId]) : null;
        };
        const transitionVerificationState = (next, { taskId, expectedPreviousDigest } = {}) => {
          const result = verificationTail.then(async () => {
          if (!hookActive) reject('VERIFICATION_CONTEXT_CLOSED');
          const previous = readVerificationState(taskId);
          if (expectedPreviousDigest !== (previous === null ? null : sha256(previous))) reject('VERIFICATION_STATE_COMPARE_AND_SWAP_FAILED');
          if (!next || next.schema !== 'manual-ledger-explorer-state-v1' || next.taskId !== taskId || !['prepared', 'submission-attempted', 'pending', 'submission-uncertain', 'verified', 'blocked', 'failed'].includes(next.state) || typeof next.submissionAttempted !== 'boolean' || !timestamp(next.updatedAt) || canonical(next).length > 8192 || Object.keys(next).some(key => !['schema', 'taskId', 'state', 'submissionAttempted', 'updatedAt', 'guid', 'reason'].includes(key)) || [next.guid, next.reason].some(value => value !== undefined && (typeof value !== 'string' || value.length > 256 || /[\x00-\x1f]/.test(value)))) reject('INVALID_VERIFICATION_STATE');
          if (previous?.submissionAttempted === true && next.submissionAttempted !== true) reject('VERIFICATION_SUBMISSION_MARKER_IMMUTABLE');
          state.verificationTasks ??= {}; state.verificationTasks[taskId] = copy(next); await append(); return copy(next);
          });
          verificationTail = result.catch(() => {}); return result;
        };
        const verification = await afterVerified({ campaign, step: index, operationId: campaign.reviewedManifest.operations[index].operationId, transactionHash: step.transactionHash, adapter, privateDirectory: store.root, readVerificationState, transitionVerificationState });
        if (!verification || !['pending', 'exported', 'verified', 'blocked', 'unsupported'].includes(verification.state)) reject('VERIFICATION_RESULT_REJECTED');
        const record = fields(verification, ['state', 'packageSha256', 'explorerStatus', 'blocker']);
        if ((record.packageSha256 !== undefined && !/^[0-9a-f]{64}$/.test(record.packageSha256)) || [record.explorerStatus, record.blocker].some(value => value !== undefined && !/^[A-Z_]{1,96}$/.test(value))) reject('VERIFICATION_RESULT_REJECTED');
        step.verification = record;
      } catch { step.verification = { state: 'blocked', blocker: 'VERIFICATION_AUTOMATION_BLOCKED' }; }
      finally { hookActive = false; await verificationTail; }
      await append();
    }
    return { ...publicStep(step), verified: step.state === 'verified' };
  };
  return Object.freeze({
    status: () => serial(async () => status()),
    prepare: request => serial(async () => {
      exactFields(request, ['step']); if (sourceBlocked) reject('SOURCE_INSPECTION_BLOCKED'); if (state.bridgeRecoveryRequired) reject('BRIDGE_OWNER_READ_ONLY_RECOVERY_REQUIRED'); freshness(); const step = stepAt(request.step);
      checkedDisplay(campaign, await adapter.inspectCampaign(campaign));
      for (let earlier = 0; earlier < request.step; earlier += 1) if (state.steps[earlier].state === 'verified') await readOnlyObserve(earlier, campaign.reviewedManifest.operations[earlier].operationId);
      nextOnly(request.step);
      if (step.signingRequestedAt || step.transactionHash || ['signed', 'submitted', 'pending', 'finalized', 'verified', 'recovery-required'].includes(step.state)) reject('READ_ONLY_RECOVERY_REQUIRED');
      if (step.prepared) reject('READ_ONLY_RECOVERY_REQUIRED');
      step.state = 'recovery-required'; step.blocker = 'PREPARE_OUTCOME_UNKNOWN'; await append();
      try {
        const result = await adapter.prepare({ campaign, step: request.step, privateDir: store.root });
        const pinned = campaign.reviewedManifest.operations[request.step];
        const prepared = fields(result?.prepared, ['unsignedHex', 'expectedUnsignedHash', 'expectedPolicyHash', 'review']);
        if (result?.operationId !== pinned.operationId || canonical(prepared) !== canonical(fields(pinned, ['unsignedHex', 'expectedUnsignedHash', 'expectedPolicyHash', 'review']))) reject('COORDINATOR_PACKET_MISMATCH');
        validateIntent(prepared.unsignedHex, prepared.expectedUnsignedHash, prepared.review, prepared.expectedPolicyHash, now()); freshness();
        step.prepared = prepared; step.operationId = result.operationId; step.state = 'signing-requested'; step.signingRequestedAt = new Date(now()).toISOString(); delete step.blocker; await append();
        return { step: request.step, operationId: step.operationId, state: step.state, prepared: copy(step.prepared) };
      } catch (error) { step.state = 'recovery-required'; step.blocker = 'PREPARE_OUTCOME_UNKNOWN'; await append(); throw error; }
    }),
    importSigned: request => serial(async () => {
      exactFields(request, ['step', 'operationId', 'capability']); const step = stepAt(request.step, request.operationId);
      if (!step.prepared || !step.signingRequestedAt || step.transactionHash || !['signing-requested', 'recovery-required'].includes(step.state)) reject('READ_ONLY_RECOVERY_REQUIRED');
      const checked = checkedCapability(step.prepared, request.capability, now());
      const capabilityFile = await store.capability(request.step, request.capability);
      step.capabilityFile = capabilityFile; step.transactionHash = checked.transactionHash; step.state = 'signed'; step.blocker = 'SIGNED_NOT_SUBMITTED'; await append();
      if (checked.expired || now() >= Date.parse(campaign.expiresAt) || sourceBlocked) {
        step.state = 'recovery-required'; step.blocker = sourceBlocked ? 'SOURCE_INSPECTION_BLOCKED_DO_NOT_RELAY' : 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY'; await append(); return { ...publicStep(step), durable: true };
      }
      let raw;
      try { raw = coordinatorImport(step.prepared, request.capability, now()).raw; } catch { reject('SIGNED_ENVELOPE_MISMATCH'); }
      step.state = 'recovery-required'; step.blocker = 'IMPORT_OUTCOME_UNKNOWN'; await append();
      try {
        const result = await adapter.importSigned({ campaign, step: request.step, operationId: request.operationId, raw, privateDir: store.root });
        if (!result || result.transactionHash !== checked.transactionHash || !['signed', 'recovery-required'].includes(result.state)) reject('COORDINATOR_RESULT_REJECTED');
        step.state = result.state; step.blocker = result.state === 'signed' ? 'RELAY_DISABLED' : 'COORDINATOR_RECOVERY_REQUIRED';
        if (typeof result.acknowledgement === 'string' && /^[\x20-\x7e]{1,256}$/.test(result.acknowledgement)) step.acknowledgement = result.acknowledgement;
        await append(); return { ...publicStep(step), durable: true };
      } catch (error) { step.state = 'recovery-required'; step.blocker = 'IMPORT_OUTCOME_UNKNOWN'; await append(); if (error instanceof BridgeError) throw error; reject('COORDINATOR_IMPORT_BLOCKED'); }
    }),
    observe: request => serial(async () => { exactFields(request, ['step', 'operationId']); return readOnlyObserve(request.step, request.operationId); }),
    relayOne: request => serial(async () => {
      exactFields(request, ['step', 'operationId', 'acknowledgement']); const step = stepAt(request.step, request.operationId);
      if (!relayEnabled) reject('RELAY_DISABLED_PENDING_REVIEW'); if (sourceBlocked) reject('SOURCE_INSPECTION_BLOCKED'); if (state.bridgeRecoveryRequired) reject('BRIDGE_OWNER_READ_ONLY_RECOVERY_REQUIRED'); freshness(); nextOnly(request.step);
      if (step.state !== 'signed' || !step.transactionHash || step.relayAttempted || !step.acknowledgement || request.acknowledgement !== step.acknowledgement) reject('EXACT_COORDINATOR_ACK_REQUIRED');
      checkedDisplay(campaign, await adapter.inspectCampaign(campaign));
      validateIntent(step.prepared.unsignedHex, step.prepared.expectedUnsignedHash, step.prepared.review, step.prepared.expectedPolicyHash, now());
      for (let earlier = 0; earlier < request.step; earlier += 1) await readOnlyObserve(earlier, campaign.reviewedManifest.operations[earlier].operationId);
      nextOnly(request.step); freshness();
      step.relayAttempted = true; step.state = 'recovery-required'; step.blocker = 'RELAY_OUTCOME_UNKNOWN'; await append();
      try {
        const result = await adapter.relayOne({ campaign, step: request.step, operationId: request.operationId, acknowledgement: request.acknowledgement, privateDir: store.root });
        if (!result || result.transactionHash !== step.transactionHash || !['submitted', 'pending'].includes(result.state)) reject('COORDINATOR_RESULT_REJECTED');
        step.state = result.state; step.blocker = 'CANONICAL_FINALITY_PENDING'; await append(); return publicStep(step);
      } catch { step.state = 'recovery-required'; step.blocker = 'RELAY_OUTCOME_UNKNOWN'; await append(); reject('RELAY_OUTCOME_UNKNOWN_NO_RETRY'); }
    }),
    report: () => serial(async () => ({ ...status(), format: 'manual-ledger-campaign-report-v1', manifestSha256: store.manifestDigest, generatedAt: new Date(now()).toISOString(), signing: 'MANUAL_LEDGER_REQUIRED', audit: 'OWNER_ACCEPTED_OMISSION', sepolia: 'OWNER_ACCEPTED_OMISSION', authorityScope: 'BOUNDED_OBSERVATIONS_ONLY' })),
    close: async () => { await tail; closed = true; await store.close(); }
  });
}
