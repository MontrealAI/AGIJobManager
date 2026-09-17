import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const html = fs.readFileSync(path.resolve(__dirname, '../agijobmanager-usdc.html'), 'utf8');
const owner = '0x1111111111111111111111111111111111111111';
const pending = '0x2222222222222222222222222222222222222222';
const source = html.slice(html.indexOf('    function postureBadge('), html.indexOf('    function bind(){', html.indexOf('    function postureBadge(')));

function consoleContext() {
  const nodes = new Map<string, any>();
  const call = vi.fn(async () => undefined);
  const send = vi.fn(async () => ({ status: true }));
  const manager: any = { methods: {
    owner: () => ({ call: async () => owner }),
    pendingOwner: () => ({ call: async () => pending }),
    moderators: () => ({ call: async () => false }),
    acceptOwnership: () => ({ call, send }),
    pauseIntake: () => ({ call, send }),
    setSettlementWallets: () => ({ call, send }),
    paused: () => ({ call: async () => true }),
    ...Object.fromEntries(['lockedEscrow','lockedAgentBonds','lockedValidatorBonds','lockedDisputeBonds'].map(name => [name, () => ({ call: async () => '0' })]))
  }};
  const context: any = vm.createContext({
    agiJobManager: manager, ensJobPages: null, userAccount: owner,
    AGI_JOB_MANAGER: '0x3333333333333333333333333333333333333333',
    USDC_ADDRESS: '0x4444444444444444444444444444444444444444',
    resolvedEnsJobPagesAddress: '', APP_STATE: { admin: {} }, window: {},
    resolveEnsJobPagesContract: vi.fn(async () => null),
    runSafeReadStep: async (_name: string, read: () => any) => read(),
    escapeHtml: String, el: (id: string) => {
      if (!nodes.has(id)) nodes.set(id, { textContent: '', innerHTML: '' });
      return nodes.get(id);
    },
    requireConnected: () => true, mustBeReadyToWrite: () => true,
    requestActionConfirmation: vi.fn(async () => true),
    runTrackedTx: vi.fn(async (_name: string, action: () => any) => action().send()),
    refreshAll: vi.fn(async () => undefined), setToast: vi.fn()
  });
  vm.runInContext(source, context);
  context.collectAdminArgs = async () => [];
  return { context, nodes, manager, call, send };
}

describe('v0.8.0 owner console', () => {
  it('keeps manager controls available without an ENS job-pages deployment', async () => {
    const { context, nodes } = consoleContext();
    await context.refreshAdminPanels();
    expect(context.APP_STATE.admin.managerOwner).toBe(owner);
    expect(nodes.get('managerPendingOwnerAddress').textContent).toBe(pending);
    expect(nodes.get('managerDangerControls').innerHTML).toContain('Update payout wallets');
    expect(nodes.get('managerDangerControls').innerHTML).toContain('Accept ownership');
  });
  it('allows the proposed owner to accept without granting other owner controls', async () => {
    const { context, send, call } = consoleContext();
    await context.refreshAdminPanels();
    context.userAccount = pending;
    await context.executeAdminControl('manager', 'pauseIntake');
    expect(send).not.toHaveBeenCalled();
    await context.executeAdminControl('manager', 'acceptOwnership');
    expect(call).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('blocks ownership acceptance by the current owner', async () => {
    const { context, send } = consoleContext();
    await context.refreshAdminPanels();
    await context.executeAdminControl('manager', 'acceptOwnership');
    expect(send).not.toHaveBeenCalled();
    expect(context.setToast).toHaveBeenCalledWith(expect.stringContaining('proposed new owner'), 'bad');
  });
  it('blocks sending when the wallet changes during transaction review', async () => {
    const { context, send } = consoleContext();
    await context.refreshAdminPanels();
    context.requestActionConfirmation = async () => { context.userAccount = pending; return true; };
    await expect(context.executeAdminControl('manager', 'pauseIntake')).rejects.toThrow('changed');
    expect(send).not.toHaveBeenCalled();
  });
  it('explains outstanding reserves before asking the wallet to rotate recipients', async () => {
    const { context, manager, send } = consoleContext();
    await context.refreshAdminPanels();
    context.collectAdminArgs = async () => [owner, pending];
    manager.methods.lockedEscrow = () => ({ call: async () => '1' });
    await expect(context.executeAdminControl('manager', 'setSettlementWallets')).rejects.toThrow('settle or refund');
    expect(send).not.toHaveBeenCalled();
  });
});
