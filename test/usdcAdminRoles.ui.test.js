const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../ui/agijobmanager-usdc.html'), 'utf8');
const start = html.indexOf('async function executeAdminControl(');
const end = html.indexOf('async function refreshAdminPanels(', start);

function harness(account, isModerator = false, rejectSimulation = false) {
  const events = [];
  const methods = Object.fromEntries(['resolveStaleDispute', 'resolveDisputeWithCode', 'acceptOwnership'].map(name => [name, (...args) => ({ call: async () => {
    events.push({ kind: 'simulation', name, args });
    if (rejectSimulation) throw new Error('InvalidState: deadline or resolver conflict');
  } })]));
  const ctx = vm.createContext({
    userAccount: account, agiJobManager: { methods }, ensJobPages: null,
    APP_STATE: { admin: { managerOwner: 'owner', pendingOwner: 'successor', ensOwner: '', isModerator } },
    requireConnected: () => true, mustBeReadyToWrite: () => true,
    captureWriteContext: () => ({}), assertWriteContext: () => {},
    collectAdminArgs: async (_target, method) => { events.push({ kind: 'arguments' }); return method === 'acceptOwnership' ? [] : [7, true]; },
    setToast: (message) => events.push({ kind: 'blocked', message }),
    requestActionConfirmation: async review => { events.push({ kind: 'review', review }); return true; },
    runTrackedTx: async () => events.push({ kind: 'sent' }), refreshAll: async () => {},
  });
  vm.runInContext(html.slice(html.indexOf('const ADMIN_METHOD_SCHEMAS ='), html.indexOf('function parseAdminArg(')), ctx);
  vm.runInContext(html.slice(start, end), ctx);
  return { ctx, events };
}

describe('USDC console administrative roles', () => {
  it('does not send public text to an RPC before content review is accepted', async () => {
    const {ctx,events}=harness('owner');
    ctx.APP_STATE.admin.ensOwner='owner';
    ctx.ensJobPages={methods:{setJobLabelPrefix:()=>({call:async()=>events.push({kind:'simulation'})})}};
    ctx.collectAdminArgs=async()=>['public-job-'];
    ctx.requestActionConfirmation=async review=>{ events.push({kind:'review',review}); return false; };
    await ctx.executeAdminControl('ens','setJobLabelPrefix');
    assert.equal(events.length,1); assert.equal(events[0].kind,'review'); assert.equal(events[0].review.publicContent,true);
  });
  it('lets the owner use the overdue-dispute backstop without moderator membership', async () => {
    const { ctx, events } = harness('owner');
    await ctx.executeAdminControl('manager', 'resolveStaleDispute', true);
    assert.equal(events.filter(e => e.kind === 'simulation').length, 2);
    assert.equal(events.filter(e => e.kind === 'sent').length, 1);
    assert.match(events.find(e => e.kind === 'review').review.checks[0].text, /AGIJobManager owner/);
  });
  it('blocks a moderator-only wallet from the owner backstop before collecting transaction arguments', async () => {
    const { ctx, events } = harness('moderator', true);
    await ctx.executeAdminControl('manager', 'resolveStaleDispute', true);
    assert.equal(events.length, 1);
    assert.equal(events[0].kind, 'blocked');
    assert.match(events[0].message, /AGIJobManager owner/);
  });
  it('lets an admitted moderator use the ordinary dispute decision', async () => {
    const { ctx, events } = harness('moderator', true);
    await ctx.executeAdminControl('manager', 'resolveDisputeWithCode', true);
    assert.equal(events.filter(e => e.kind === 'sent').length, 1);
    assert.match(events.find(e => e.kind === 'review').review.checks[0].text, /AGIJobManager moderator/);
  });
  it('does not give a non-moderator owner the ordinary moderator-only decision', async () => {
    const { ctx, events } = harness('owner');
    await ctx.executeAdminControl('manager', 'resolveDisputeWithCode', true);
    assert.equal(events.length, 1);
    assert.match(events[0].message, /AGIJobManager moderator/);
  });
  it('does not interpret malformed cached role values as moderator authority', async () => {
    for (const value of ['false', 'true', 1, {}, null]) {
      const { ctx, events } = harness('outsider', value);
      await ctx.executeAdminControl('manager', 'resolveDisputeWithCode', true);
      assert.equal(events.length, 1);
      assert.equal(events[0].kind, 'blocked');
    }
  });
  it('permits ownership acceptance by the proposed successor without current owner authority', async () => {
    const { ctx, events } = harness('successor');
    await ctx.executeAdminControl('manager', 'acceptOwnership', true);
    assert.equal(events.filter(e => e.kind === 'sent').length, 1);
    assert.match(events.find(e => e.kind === 'review').review.checks[0].text, /proposed new owner/);
  });
  it('never offers confirmation or submits when the contract rejects a deadline or resolver conflict', async () => {
    const { ctx, events } = harness('owner', false, true);
    await assert.rejects(ctx.executeAdminControl('manager', 'resolveStaleDispute', true), /deadline or resolver conflict/);
    assert.equal(events.some(e => e.kind === 'review' || e.kind === 'sent'), false);
  });
});
