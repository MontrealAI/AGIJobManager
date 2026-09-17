import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
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
    maxJobPayout: '1000000000', jobDurationLimit: '31536000', paused: false
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
  vm.runInContext(section(primary, '    async function fetchPostingTerms(', '    async function applyForJob('), context);
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
  it.each(['validationRewardPercentage', 'wallet30', 'jobDurationLimit', 'paused'])('blocks a changed %s before approval', async term => {
    const { context, terms, method } = postingContext();
    await context.createJob();
    terms[term] = term === 'paused' ? true : term === 'wallet30' ? account : '12';
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
