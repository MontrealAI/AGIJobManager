import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

const primary = fs.readFileSync(path.resolve(__dirname, '../agijobmanager-usdc.html'), 'utf8');
const operator = fs.readFileSync(path.resolve(__dirname, '../../docs/ui/agijobmanager.html'), 'utf8');
const account = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';
const manager = '0x3333333333333333333333333333333333333333';
const section = (html: string, start: string, end: string) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
function primaryContext() {
  const wallet = { account, chainId: '0x1' };
  const provider = { request: vi.fn(async ({ method }: { method: string }) => method === 'eth_accounts' ? [wallet.account] : wallet.chainId) };
  const method = { call: vi.fn(async () => undefined), send: vi.fn(async () => ({ status: 1n, transactionHash: '0x123' })) };
  const element = { textContent: '', innerHTML: '', disabled: false, classList: { add() {}, remove() {} }, setAttribute() {} };
  const context: any = vm.createContext({
    web3: { currentProvider: provider }, window: { ethereum: provider }, userAccount: account,
    AGI_JOB_MANAGER: manager, APP_STATE: { writeEpoch: 0 }, hasAcceptedTerms: true, isMainnet: true,
    activeReviewedContext: null, trackedTransactionPending: false, pendingReviewedAction: null, pendingActionConfirmResolver: null,
    verifyUSDCDeployment: vi.fn(async () => undefined), activeJobIndexCache: { ids: [1], ts: 1 },
    addTxActivity: vi.fn(() => ({ id: 'activity-1' })), updateTxActivity: vi.fn(),
    el: () => element, escapeHtml: String, setToast: vi.fn(), console: { error() {} }
  });
  vm.runInContext(section(primary, '    function captureWriteContext(', '    function setMissionButtons('), context);
  return { context, wallet, method };
}

describe('primary console transaction safety', () => {
  it('simulates the pinned method and account before sending and accepts a successful receipt', async () => {
    const { context, method } = primaryContext();
    await context.runTrackedTx('Create job', () => method);
    expect(method.call).toHaveBeenCalledWith({ from: account, value: '0' });
    expect(method.send).toHaveBeenCalledWith({ from: account, value: '0' });
    expect(method.call.mock.invocationCallOrder[0]).toBeLessThan(method.send.mock.invocationCallOrder[0]);
    expect(context.updateTxActivity).toHaveBeenLastCalledWith('activity-1', expect.objectContaining({ state: 'success' }));
  });
  it.each(['account', 'chainId'])('blocks a silent wallet %s change without relying on emitted events', async field => {
    const { context, wallet, method } = primaryContext();
    wallet[field as keyof typeof wallet] = field === 'account' ? other : '0xaa36a7';
    await expect(context.runTrackedTx('Create job', () => method)).rejects.toThrow('changed');
    expect(method.send).not.toHaveBeenCalled();
  });
  it('blocks a deployment change while awaiting validation', async () => {
    const { context, method } = primaryContext();
    context.verifyUSDCDeployment = async () => { context.AGI_JOB_MANAGER = other; };
    await expect(context.runTrackedTx('Create job', () => method)).rejects.toThrow('changed');
    expect(method.send).not.toHaveBeenCalled();
  });
  it('blocks an account change during simulation', async () => {
    const { context, wallet, method } = primaryContext();
    method.call.mockImplementation(async () => { wallet.account = other; });
    await expect(context.runTrackedTx('Create job', () => method)).rejects.toThrow('changed');
    expect(method.send).not.toHaveBeenCalled();
  });
  it('rejects a reviewed context even if the account changes back', async () => {
    const { context, method } = primaryContext();
    context.activeReviewedContext = context.captureWriteContext();
    context.APP_STATE.writeEpoch++;
    await expect(context.runTrackedTx('Create job', () => method)).rejects.toThrow('changed');
    expect(method.send).not.toHaveBeenCalled();
  });
  it('stops before wallet submission if simulation reverts', async () => {
    const { context, method } = primaryContext();
    method.call.mockRejectedValue(new Error('SettlementPaused'));
    await expect(context.runTrackedTx('Finalize', () => method)).rejects.toThrow('SettlementPaused');
    expect(method.send).not.toHaveBeenCalled();
  });
  it.each([false, 0, 0n, '0x0', undefined])('never marks a failed or unknown receipt status (%s) as successful', async status => {
    const { context, method } = primaryContext();
    method.send.mockResolvedValue({ status, transactionHash: '0x123' } as any);
    await expect(context.runTrackedTx('Create job', () => method)).rejects.toThrow('could not be confirmed');
    expect(context.updateTxActivity).toHaveBeenLastCalledWith('activity-1', expect.objectContaining({ state: 'error' }));
    expect(context.trackedTransactionPending).toBe(false);
  });
  it('cancels a reviewed action when its deployment changes before confirmation', async () => {
    const { context } = primaryContext();
    const run = vi.fn();
    context.openActionReview({ title: 'Post job', run });
    context.AGI_JOB_MANAGER = other;
    await context.confirmReviewedAction();
    expect(run).not.toHaveBeenCalled();
    expect(context.setToast).toHaveBeenCalledWith(expect.stringContaining('changed'), 'bad');
  });
  it('prevents overlapping wallet requests while a transaction is awaiting simulation', async () => {
    const { context, method } = primaryContext();
    let release!: () => void;
    method.call.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
    const first = context.runTrackedTx('First', () => method);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await expect(context.runTrackedTx('Second', () => method)).rejects.toThrow('already in progress');
    release(); await first;
    expect(method.send).toHaveBeenCalledTimes(1);
  });
  it('requests exactly the needed USDC and never retries a failed approval automatically', async () => {
    const { context, method } = primaryContext();
    const approve = vi.fn(() => method);
    Object.assign(context, {
      formatUnitsToAmount: String, formatUnitsWithDecimals: String,
      getTokenBalanceAndAllowance: vi.fn(async () => ({ balance: 100000000n, allowance: 1n })),
      requestActionConfirmation: vi.fn(async () => true)
    });
    vm.runInContext(section(primary, '    async function ensureTokenApprovalExact(', '    async function ensureApproval('), context);
    method.call.mockRejectedValue(new Error('Token is paused'));
    await expect(context.ensureTokenApprovalExact({ methods: { approve } }, manager, 2500000n, 6, { approveMax: true })).rejects.toThrow('Token is paused');
    expect(approve).toHaveBeenCalledOnce();
    expect(approve).toHaveBeenCalledWith(manager, '2500000');
    expect(method.send).not.toHaveBeenCalled();
  });
});

function operatorContext() {
  const wallet = { account, chainId: '0x1' };
  const transact = vi.fn(async () => ({ hash: '0x123', wait: async () => ({ status: 1 }) }));
  const fn = Object.assign(transact, { staticCall: vi.fn(async () => undefined) });
  const state = { walletAddress: account, chainId: 1n, contractAddress: manager, signer: {}, contract: { getFunction: () => fn }, provider: { send: async (method: string) => method === 'eth_accounts' ? [wallet.account] : wallet.chainId }, writeEpoch: 0 };
  const context: any = vm.createContext({ state, ensureToken: vi.fn(async () => undefined), logEvent: vi.fn(), AGIJMErrorDecoder: null });
  vm.runInContext(section(operator, '    function captureTransactionContext(', '    async function ensureToken('), context);
  vm.runInContext(section(operator, '    async function preflight(', '    async function sendAdminTx('), context);
  return { context, wallet, transact, fn };
}

describe('operator console transaction safety', () => {
  it('sends the pinned contract only after successful simulation and live account checks', async () => {
    const { context, transact, fn } = operatorContext();
    await context.sendTx('pauseIntake', [], 'Pause intake');
    expect(fn.staticCall).toHaveBeenCalledOnce();
    expect(transact).toHaveBeenCalledOnce();
  });
  it('blocks account drift during simulation', async () => {
    const { context, wallet, transact, fn } = operatorContext();
    fn.staticCall.mockImplementation(async () => { wallet.account = other; });
    await expect(context.sendTx('pauseIntake', [], 'Pause intake')).rejects.toThrow('changed');
    expect(transact).not.toHaveBeenCalled();
  });
  it('blocks contract changes while checking the token', async () => {
    const { context, transact } = operatorContext();
    context.ensureToken = async () => { context.state.contractAddress = other; };
    await expect(context.sendTx('pauseIntake', [], 'Pause intake')).rejects.toThrow('changed');
    expect(transact).not.toHaveBeenCalled();
  });
  it('does not report an unconfirmed receipt as successful', async () => {
    const { context, transact } = operatorContext();
    transact.mockResolvedValue({ hash: '0x123', wait: async () => null } as any);
    await expect(context.sendTx('pauseIntake', [], 'Pause intake')).rejects.toThrow('could not be confirmed');
    expect(context.logEvent).not.toHaveBeenCalledWith(expect.stringContaining('✅'));
  });
});

function postingContext() {
  const { context, method } = primaryContext();
  const terms: Record<string, string | boolean> = {
    validationRewardPercentage: '8', wallet30: manager, wallet10: other,
    maxJobPayout: '1000000000', jobDurationLimit: '31536000', paused: false, agentNftRequired: true, completionReviewPeriod: '604800', challengePeriodAfterApproval: '86400', disputeReviewPeriod: '1209600', voteQuorum: '3'
  };
  const inputs: Record<string, {value: string}> = {
    jobSpecURI: { value: 'ipfs://example' }, jobDetails: { value: 'Deliver the agreed result' },
    jobPayout: { value: '100' }, jobDuration: { value: '86400' }
  };
  const fallbackElement = context.el;
  Object.assign(context, {
    agiJobManager: { methods: { ...Object.fromEntries(Object.keys(terms).map(name => [name, () => ({ call: async () => terms[name] })])), createJob: () => method } },
    el: (id: string) => inputs[id] || fallbackElement(id), tokenDecimals: 6, secondsToHuman: String,
    requireConnected: () => true, mustBeReadyToWrite: () => true, saveBuilderDraft() {},
    normalizeIpfsLikeUri: (uri: string) => ({ valid: true, canonical: uri }), isValidUriLoose: () => true,
    ensureApproval: vi.fn(async () => ({ ok: true })), getTokenBalanceAndAllowance: async () => ({ balance: 100000000n, allowance: 100000000n }), refreshAll: async () => undefined
  });
  vm.runInContext(section(primary, '    function parseAmountToUnits(', '    function secondsToHuman('), context);
  vm.runInContext(section(primary, '    function assertSnapshotMatch(', '    async function fetchAgentBondSnapshot('), context);
  vm.runInContext(section(primary, '    function nftRequirementLabel(', '    async function applyForJob('), context);
  return { context, terms, method };
}

describe('posting review economics', () => {
  it('shows the current 8 / 30 / 10 / 52 USDC split for a 100 USDC job before approval', async () => {
    const { context } = postingContext();
    await context.createJob();
    const values = context.pendingReviewedAction.facts.map((fact: any) => fact.value);
    expect(values).toContain('8 USDC');
    expect(values).toContain(`30 USDC → ${manager}`);
    expect(values).toContain(`10 USDC → ${other}`);
    expect(values.some((value: string) => value.startsWith('52 USDC;'))).toBe(true);
    expect(context.ensureApproval).not.toHaveBeenCalled();
  });
  it.each(['validationRewardPercentage', 'wallet30', 'jobDurationLimit', 'paused', 'agentNftRequired'])('blocks a changed %s before approval', async term => {
    const { context, terms, method } = postingContext();
    await context.createJob();
    terms[term] = term === 'agentNftRequired' ? false : term === 'paused' ? true : term === 'wallet30' ? account : '12';
    await context.confirmReviewedAction();
    expect(context.ensureApproval).not.toHaveBeenCalled();
    expect(method.send).not.toHaveBeenCalled();
    expect(context.setToast).toHaveBeenCalledWith(expect.stringContaining('Calculation mismatch'), 'bad');
  });
  it('blocks economic drift after the approval transaction', async () => {
    const { context, terms, method } = postingContext();
    await context.createJob();
    context.ensureApproval.mockImplementation(async () => { terms.validationRewardPercentage = '60'; return { ok: true }; });
    await context.confirmReviewedAction();
    expect(context.ensureApproval).toHaveBeenCalledOnce();
    expect(method.send).not.toHaveBeenCalled();
    expect(context.setToast).toHaveBeenCalledWith(expect.stringContaining('Calculation mismatch'), 'bad');
  });
  it('does not ask for approval while new job intake is paused', async () => {
    const { context, terms } = postingContext();
    terms.paused = true;
    await context.createJob();
    expect(context.pendingReviewedAction).toBeNull();
    expect(context.ensureApproval).not.toHaveBeenCalled();
    expect(context.setToast).toHaveBeenCalledWith(expect.stringContaining('intake is paused'), 'bad');
  });
});

describe('review preparation and confirmation ownership', () => {
  it('does not replace an unresolved confirmation or its promise', async () => {
    const { context } = primaryContext();
    const first = context.requestActionConfirmation({ title: 'First approval' });
    await expect(context.requestActionConfirmation({ title: 'Second approval' })).rejects.toThrow('current review');
    expect(context.pendingReviewedAction.title).toBe('First approval');
    await context.confirmReviewedAction();
    await expect(first).resolves.toBe(true);
  });
  it('resolves the original confirmation as cancelled after a rejected replacement', async () => {
    const { context } = primaryContext();
    const first = context.requestActionConfirmation({ title: 'First approval' });
    await expect(context.requestActionConfirmation({ title: 'Second approval' })).rejects.toThrow();
    context.closeActionReview();
    await expect(first).resolves.toBe(false);
  });
  it('reserves the reviewed action before waiting for live wallet checks', async () => {
    const { context } = primaryContext();
    let release!: (accounts: string[]) => void;
    context.web3.currentProvider.request.mockImplementation(({ method }: { method: string }) => method === 'eth_accounts' ? new Promise<string[]>(resolve => { release = resolve; }) : Promise.resolve('0x1'));
    const run = vi.fn(async () => undefined);
    context.openActionReview({ title: 'First action', run });
    const confirmation = context.confirmReviewedAction();
    expect(() => context.openActionReview({ title: 'Racing action', run })).toThrow('current transaction');
    release([account]); await confirmation;
    expect(run).toHaveBeenCalledOnce();
  });
  it('requires explicit nesting for a confirmation inside an active action', async () => {
    const { context } = primaryContext();
    context.activeReviewedContext = context.captureWriteContext();
    await expect(context.requestActionConfirmation({ title: 'Unrelated admin call' })).rejects.toThrow('current transaction');
    const approval = context.requestActionConfirmation({ title: 'Nested exact approval', allowDuringAction: true });
    await context.confirmReviewedAction();
    await expect(approval).resolves.toBe(true);
  });
  it('does not execute a review blocked by an integrity check', async () => {
    const { context } = primaryContext();
    const run = vi.fn();
    context.openActionReview({ title: 'Blocked bond', confirmDisabled: true, run });
    await context.confirmReviewedAction();
    expect(run).not.toHaveBeenCalled();
    expect(context.pendingReviewedAction.title).toBe('Blocked bond');
  });
  it('rejects a caller context changed during async preparation before the review opens', () => {
    const { context } = primaryContext();
    const writeContext = context.captureWriteContext();
    context.AGI_JOB_MANAGER = other;
    expect(() => context.openActionReview({ writeContext, title: 'Old deployment action', run: vi.fn() })).toThrow('changed');
    expect(context.pendingReviewedAction).toBeNull();
  });
  it('refreshes terminal-action facts and rejects deployment drift during the read', async () => {
    const { context, method } = primaryContext();
    Object.assign(context, {
      requireConnected: () => true, mustBeReadyToWrite: () => true,
      jobCache: new Map([['9', { payout: 1n }]]),
      fetchJobSnapshot: vi.fn(async () => { context.AGI_JOB_MANAGER = other; return { payout: 100n }; }),
      simulateJobSettlement: () => ({ headline: 'Fresh settlement', approvals: 2, disapprovals: 0 }), classifyJobStatus: () => 'Fresh review'
    });
    vm.runInContext(section(primary, '    async function finalizeJob(', '    async function disputeJob('), context);
    await context.finalizeJob(9);
    expect(context.fetchJobSnapshot).toHaveBeenCalledWith(9, { forceRefresh: true });
    expect(context.pendingReviewedAction).toBeNull();
    expect(context.setToast).toHaveBeenCalledWith(expect.stringContaining('changed'), 'bad');
    expect(method.send).not.toHaveBeenCalled();
  });
  it('submits the validator label that was reviewed even if another label is verified later', async () => {
    const { context, method } = primaryContext();
    const trace = Object.fromEntries(['payoutRaw', 'bpsRaw', 'minBondRaw', 'maxBondRaw', 'baseBondRaw', 'afterMinClampRaw', 'afterMaxClampRaw', 'afterPayoutClampRaw', 'finalBondRaw'].map(key => [key, 1n]));
    const validateJob = vi.fn(() => method);
    Object.assign(context, {
      requireConnected: () => true, mustBeReadyToWrite: () => true, verified: { club: 'reviewed-validator', clubAlpha: false }, SUFFIX: { club: 'club.agi.eth' },
      fetchJobSnapshot: async () => ({ approvals: 1, disapprovals: 0 }), fetchValidatorBondSnapshot: async () => ({ ...trace, trace }),
      buildTraceAuditHtml: () => '', formatRawAmountTrace: String, agiJobManager: { methods: { validateJob } },
      ensureApproval: async () => ({ ok: true }), getTokenBalanceAndAllowance: async () => ({ balance: 10n, allowance: 10n }), refreshAll: async () => undefined
    });
    vm.runInContext(section(primary, '    function assertSnapshotMatch(', '    async function fetchAgentBondSnapshot('), context);
    vm.runInContext(section(primary, '    async function validateJob(', '    async function disapproveJob('), context);
    await context.validateJob(9);
    context.verified.club = 'different-validator';
    await context.confirmReviewedAction();
    expect(validateJob).toHaveBeenCalledWith('9', 'reviewed-validator', []);
    expect(method.send).toHaveBeenCalledOnce();
  });
});


describe('transaction review keyboard access', () => {
  it('labels the dialog, focuses Cancel, keeps Tab within the review, and restores the opener', () => {
    const { context } = primaryContext();
    const dom = new JSDOM(primary, { url: 'https://example.test/usdc.html' });
    try {
      const document = dom.window.document;
      context.document = document;
      context.el = (id: string) => document.getElementById(id);
      const opener = document.createElement('button'); document.body.append(opener); opener.focus();
      context.openActionReview({ title: 'Review refund', run: vi.fn() });
      const modal = document.getElementById('actionReviewModal')!;
      expect(modal.getAttribute('role')).toBe('dialog');
      expect(modal.getAttribute('aria-labelledby')).toBe('actionReviewTitle');
      expect(document.activeElement?.id).toBe('cancelActionReviewBtn');
      document.getElementById('confirmActionReviewBtn')!.focus();
      context.handleActionReviewKeydown(new dom.window.KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
      expect(document.activeElement?.id).toBe('closeActionReviewModal');
      context.handleActionReviewKeydown(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }));
      expect(document.activeElement?.id).toBe('confirmActionReviewBtn');
      context.handleActionReviewKeydown(new dom.window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      expect(context.pendingReviewedAction).toBeNull();
      expect(document.activeElement).toBe(opener);
      expect(modal.getAttribute('aria-hidden')).toBe('true');
    } finally { dom.window.close(); }
  });
});

function identityReviewContext() {
  const { context, method } = primaryContext();
  const fields: Record<string, any> = { mintAlphaLabel: { value: 'reviewed-agent' }, mintAlphaRecipient: { value: account } };
  const fallback = context.el;
  const register = vi.fn(() => method);
  const registerSimple = vi.fn(() => method);
  Object.assign(context, {
    requireConnected: () => true, mustBeReadyToWrite: () => true,
    el: (id: string) => fields[id] || { ...fallback(id), dataset: {} },
    validateAlphaLabelLocal: (label: string) => ({ ok: true, label }),
    FREE_TRIAL_REGISTRAR_IDENTITY: manager, FREE_TRIAL_REGISTRAR: manager,
    ALPHA_AGENT_PARENT: 'alpha.agent.agi.eth', ALPHA_AGENT_PARENT_NODE: '0xroot', namehash: String,
    freeTrialRegistrarIdentity: { methods: { register } },
    freeTrialRegistrar: { methods: { registerSimple, available: () => ({ call: async () => true }) } },
    verifySubdomain: async () => undefined, refreshFreeTrialRegistrarState: async () => undefined,
    refreshIdentityState: async () => undefined, saveRecentAlphaAgentName() {}, updateMissionControl: async () => undefined
  });
  context.web3.utils = { isAddress: () => true };
  context.APP_STATE.identity = { preview: null };
  vm.runInContext(section(primary, '    let alphaIdentityReviewState', '    function renderIdentityAdminControls('), context);
  vm.runInContext(section(primary, '    let alphaMintReviewState', '    function renderRegistrarAdminControls('), context);
  return { context, method, fields, register, registerSimple };
}

describe('identity review intent', () => {
  it('keeps the reviewed identity label when the form changes before confirmation', async () => {
    const { context, fields, register, method } = identityReviewContext();
    context.openAlphaIdentityReview('register');
    fields.mintAlphaLabel.value = 'different-agent';
    await context.runAlphaIdentityAction('register');
    expect(register).toHaveBeenCalledWith('reviewed-agent');
    expect(method.send).toHaveBeenCalledOnce();
  });
  it('blocks a reviewed identity action after the deployment changes', async () => {
    const { context, method } = identityReviewContext();
    context.openAlphaIdentityReview('register');
    context.AGI_JOB_MANAGER = other;
    await expect(context.runAlphaIdentityAction('register')).rejects.toThrow('changed');
    expect(method.send).not.toHaveBeenCalled();
  });
  it('keeps the reviewed ENS recipient and label when fields change before confirmation', async () => {
    const { context, fields, registerSimple, method } = identityReviewContext();
    context.openAlphaMintReview();
    fields.mintAlphaLabel.value = 'different-agent'; fields.mintAlphaRecipient.value = other;
    await context.mintAlphaAgentName();
    expect(registerSimple).toHaveBeenCalledWith('0xroot', 'reviewed-agent', account);
    expect(method.send).toHaveBeenCalledOnce();
  });
});

describe('admin argument dialog lifecycle', () => {
  it('prevents replacing an unresolved admin form and supports cancelling with Escape', async () => {
    const { context } = primaryContext();
    const dom = new JSDOM(primary, { url: 'https://example.test/usdc.html' });
    try {
      const document = dom.window.document;
      context.document = document; context.el = (id: string) => document.getElementById(id);
      context.ADMIN_METHOD_SCHEMAS = { pauseIntake: [] };
      const opener = document.createElement('button'); document.body.append(opener); opener.focus();
      vm.runInContext(section(primary, '    async function collectAdminArgs(', '    async function executeAdminControl('), context);
      const first = context.collectAdminArgs('manager', 'pauseIntake', false);
      expect(document.activeElement?.id).toBe('cancelAdminArgsBtn');
      await expect(context.collectAdminArgs('manager', 'pauseIntake', false)).rejects.toThrow('current admin form');
      document.getElementById('adminArgsModal')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await expect(first).resolves.toBeNull();
      expect(document.activeElement).toBe(opener);
    } finally { dom.window.close(); }
  });
});
