const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../ui/agijobmanager-usdc.html'), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert(a >= 0 && b > a); return html.slice(a, b);
}
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
function harness(holdPrivacyReview = false) {
  const account = '0x1111111111111111111111111111111111111111';
  const managerA = '0x2222222222222222222222222222222222222222';
  const managerB = '0x3333333333333333333333333333333333333333';
  const calls = [], inspection = deferred(), confirmation = deferred();
  const inspectionStarted = deferred(), confirmationStarted = deferred();
  const normalized = { valid: true, canonical: 'ipfs://original-delivery', uriBytes: 24 };
  const provider = { request: async ({ method }) => method === 'eth_accounts' ? [account] : '0x1' };
  const contract = manager => ({ methods: { requestJobCompletion: (jobId, uri) => ({
    call: async () => calls.push({ step: 'simulate', manager, jobId, uri }),
    send: async () => { calls.push({ step: 'send', manager, jobId, uri }); return { status: 1n }; }
  }) } });
  let context;
  context = vm.createContext({
    web3: { currentProvider: provider }, window: { ethereum: provider }, userAccount: account,
    AGI_JOB_MANAGER: managerA, agiJobManager: contract(managerA), APP_STATE: { writeEpoch: 0 },
    hasAcceptedTerms: true, isMainnet: true, activeReviewedContext: null, trackedTransactionPending: false,
    requireConnected: () => true, mustBeReadyToWrite: () => true,
    normalizeCompletionUriField: () => ({ ...normalized }),
    inspectCompletionUri: async () => { calls.push({ step: 'inspect' }); inspectionStarted.resolve(); return inspection.promise; },
    requestActionConfirmation: async config => { calls.push({ step: 'confirm', config }); if(config.publicContent && !holdPrivacyReview) return true; confirmationStarted.resolve(); return confirmation.promise; },
    verifyUSDCDeployment: async () => {}, activeJobIndexCache: { ids: [], ts: 0 },
    addTxActivity: () => ({ id: 'activity' }), updateTxActivity: () => {},
    saveCompletionDraft: jobId => calls.push({ step: 'save', jobId }), setToast: () => {},
    closeCompletionAssistant: () => { calls.push({ step: 'close' }); context.completionAssistantState = { jobId: null }; },
    refreshAll: async () => {}
  });
  for (const [start, end] of [
    ['function captureWriteContext(', 'function openActionReview('],
    ['async function runTrackedTx(', 'function setMissionButtons('],
    ['async function submitCompletionFromAssistant(', 'async function loadNFTs(']
  ]) vm.runInContext(section(start, end), context);
  context.completionAssistantState = { jobId: 7, inspected: null, writeContext: context.captureWriteContext() };
  const original = context.completionAssistantState;
  const replaceAssistant = (changeManager = false) => {
    if (changeManager) {
      context.APP_STATE.writeEpoch++; context.AGI_JOB_MANAGER = managerB; context.agiJobManager = contract(managerB);
    }
    context.completionAssistantState = { jobId: 8, inspected: null, writeContext: context.captureWriteContext() };
  };
  return { context, calls, original, normalized, inspection, inspectionStarted: inspectionStarted.promise,
    confirmation, confirmationStarted: confirmationStarted.promise, replaceAssistant, managerA };
}

describe('USDC completion assistant asynchronous context', () => {
  it('cancels before contacting metadata providers or sending a transaction when public-content review is declined', async () => {
    const h = harness(true), pending = h.context.submitCompletionFromAssistant();
    await h.confirmationStarted;
    assert.equal(h.calls[0].config.publicContent, true);
    h.confirmation.resolve(false); await pending;
    assert.equal(h.calls.some(call => call.step === 'inspect' || call.step === 'simulate' || call.step === 'send' || call.step === 'save'), false);
    assert.equal(h.original.inspected, null);
  });

  it('invalidates a public-content confirmation when the active assistant changes', async () => {
    const h = harness(true), pending = h.context.submitCompletionFromAssistant();
    await h.confirmationStarted; h.replaceAssistant(true); h.confirmation.resolve(true);
    await assert.rejects(pending, /Completion assistant changed/);
    assert.equal(h.calls.some(call => call.step === 'send' || call.step === 'save'), false);
  });

  it('rejects a completion URI changed during review before any metadata request', async () => {
    const h = harness(true), pending = h.context.submitCompletionFromAssistant();
    await h.confirmationStarted; h.normalized.canonical = 'https://unreviewed.example/private'; h.confirmation.resolve(true);
    await assert.rejects(pending, /Completion URI changed/);
    assert.equal(h.calls.some(call => ['inspect', 'simulate', 'send', 'save'].includes(call.step)), false);
  });

  it('submits the originally reviewed job and URI after an unchanged metadata inspection', async () => {
    const h = harness(), pending = h.context.submitCompletionFromAssistant();
    await h.inspectionStarted; h.inspection.resolve({ posture: 'Metadata JSON' }); await pending;
    assert.deepEqual(h.calls.filter(call => call.step === 'send'), [{ step: 'send', manager: h.managerA, jobId: '7', uri: 'ipfs://original-delivery' }]);
    assert.equal(h.calls.filter(call => call.step === 'close').length, 1);
  });

  it('never borrows a replacement assistant context to send an old job to a new manager', async () => {
    const h = harness(), pending = h.context.submitCompletionFromAssistant();
    await h.inspectionStarted; h.replaceAssistant(true); h.inspection.resolve({ posture: 'Metadata JSON' });
    await assert.rejects(pending, /Completion assistant changed/);
    assert.equal(h.calls.some(call => call.step === 'simulate' || call.step === 'send' || call.step === 'save'), false);
    assert.equal(h.context.completionAssistantState.jobId, 8);
  });

  it('cancels an old inspection when a different job is opened in the same wallet and manager', async () => {
    const h = harness(), pending = h.context.submitCompletionFromAssistant();
    await h.inspectionStarted; h.replaceAssistant(); h.inspection.resolve({ posture: 'Metadata JSON' });
    await assert.rejects(pending, /Completion assistant changed/);
    assert.equal(h.calls.some(call => call.step === 'send'), false);
  });

  it('blocks an account or chain reset even when the same assistant object remains open', async () => {
    const h = harness(), pending = h.context.submitCompletionFromAssistant();
    await h.inspectionStarted; h.context.APP_STATE.writeEpoch++; h.inspection.resolve({ posture: 'Metadata JSON' });
    await assert.rejects(pending, /changed/);
    assert.equal(h.calls.some(call => call.step === 'send'), false);
  });

  it('pins the direct-image confirmation and rechecks assistant identity after it resolves', async () => {
    const h = harness(); h.original.inspected = { normalized: h.normalized, posture: 'Direct image' };
    const pending = h.context.submitCompletionFromAssistant();
    await h.confirmationStarted;
    assert.equal(h.calls.find(call => call.step === 'confirm').config.writeContext, h.original.writeContext);
    h.replaceAssistant(true); h.confirmation.resolve(true);
    await assert.rejects(pending, /Completion assistant changed/);
    assert.equal(h.calls.some(call => call.step === 'send'), false);
  });
});
