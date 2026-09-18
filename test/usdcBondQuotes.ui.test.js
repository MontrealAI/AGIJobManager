const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../ui/agijobmanager-usdc.html'), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert(a >= 0 && b > a); return html.slice(a, b);
}
function fixture() {
  const calls = [];
  const state = { bonds: ['5043200', '15000000', true, '0'], payout: '100000000', bps: '3000', slash: '8000' };
  const method = (name, value) => () => ({ call: async (_, block) => { calls.push([name, block]); return value(); } });
  const ctx = vm.createContext({ web3: { eth: { getBlockNumber: async () => 12345 } }, agiJobManager: { methods: {
    getJobCore: method('core', () => ({ payout: state.payout })),
    getJobBonds: method('bonds', () => state.bonds),
    validatorBondBps: method('bps', () => state.bps), validatorBondMin: method('min', () => '10000000'),
    validatorBondMax: method('max', () => '1000000000'), validatorSlashBps: method('slash', () => state.slash)
  } } });
  for (const [start, end] of [
    ['function buildValidatorBondTrace(', 'function buildDisputeBondTrace('],
    ['async function readJobBonds(', 'async function fetchDisputeBondSnapshot('],
    ['function quoteSuccessCostSplit(', 'function renderJobCostPreview('],
    ['function toJsonSafe(', 'function coerceJobRecordFromFresh('],
    ['function dossierText(', 'function downloadTextFile(']
  ]) vm.runInContext(section(start, end), ctx);
  return { ctx, state, calls };
}
describe('USDC console exact bond quotes and cost transparency', () => {
  it('quotes the recorded bond despite an owner default change, with all reads at one block', async () => {
    const { ctx, calls } = fixture(); const quote = await ctx.fetchValidatorBondSnapshot(7);
    assert.equal(quote.finalBondRaw, '15000000'); assert.equal(quote.bpsRaw, '3000');
    assert.equal(quote.slashBpsRaw, '8000'); assert.equal(quote.validatorFixed, true);
    assert.equal(calls.length, 6); assert(calls.every(([, block]) => block === 12345));
  });
  it('preserves a fixed zero bond after the owner enables future bonds', async () => {
    const { ctx, state } = fixture(); state.bonds[1] = '0';
    assert.equal((await ctx.fetchValidatorBondSnapshot(7)).finalBondRaw, '0');
  });
  it('uses the current formula only before the first vote', async () => {
    const { ctx, state } = fixture(); state.bonds[1] = '0'; state.bonds[2] = false;
    assert.equal((await ctx.fetchValidatorBondSnapshot(7)).finalBondRaw, '30000000');
  });
  it('rejects malformed, inconsistent, oversized and unavailable bond reads', async () => {
    for (const bonds of [null, ['0','bad',true,'0'], ['0','0','false','0'], ['0','1',false,'0'], ['0',String(2n**256n),true,'0'], ['0','100000001',true,'0']]) {
      const { ctx, state } = fixture(); state.bonds = bonds;
      await assert.rejects(ctx.fetchValidatorBondSnapshot(7));
    }
    const { ctx } = fixture(); delete ctx.agiJobManager.methods.getJobBonds;
    await assert.rejects(ctx.fetchValidatorBondSnapshot(7), /manager version/);
  });
  it('rejects invalid slashing terms instead of treating an unreadable penalty as zero', async () => {
    for (const value of ['bad', '-1', '10001']) {
      const { ctx, state } = fixture(); state.slash = value;
      await assert.rejects(ctx.fetchValidatorBondSnapshot(7));
    }
  });
  it('separates the 100 USDC total from agent earnings and reviewer and wallet shares', () => {
    const { ctx } = fixture(); const q = ctx.quoteSuccessCostSplit('100000000', '8');
    assert.equal(q.validatorBudget, 8000000n); assert.equal(q.wallet30, 30000000n);
    assert.equal(q.wallet10, 10000000n); assert.equal(q.agentBase, 52000000n);
    assert.equal(q.agentWithoutReviewers, 60000000n);
    assert.equal(ctx.quoteSuccessCostSplit('100000000', '60').agentBase, 0n);
  });
  it('conserves integer USDC units for rounded costs and refuses unknown terms', () => {
    const { ctx } = fixture(); const q = ctx.quoteSuccessCostSplit('100000003', '8');
    assert.equal(q.validatorBudget + q.wallet30 + q.wallet10 + q.agentBase, q.cost);
    for (const [cost, rate] of [['0','8'], ['1.5','8'], ['100','61'], ['100',undefined], [String(2n**256n),'8']]) {
      assert.throws(() => ctx.quoteSuccessCostSplit(cost, rate));
    }
  });
  it('exports large exact amounts and unknown quotes without a BigInt serialization error', () => {
    const { ctx } = fixture(); const large = 2n**100n;
    const report = JSON.parse(ctx.dossierText({ simulation: { payout: large, validatorBond: null }, values: [15n] }));
    assert.equal(report.simulation.payout, large.toString()); assert.equal(report.simulation.validatorBond, null);
    assert.deepEqual(report.values, ['15']);
  });
});
