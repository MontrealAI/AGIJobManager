const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../ui/agijobmanager-usdc.html'), 'utf8');
function section(start, end) { const a = html.indexOf(start), b = html.indexOf(end, a); assert(a >= 0 && b > a); return html.slice(a, b); }
function context(overrides = {}) {
  const state = { now: 100, paused: false, raw: ['150', '200', '250', '0', '0'], quorum: '3' };
  const ctx = vm.createContext({
    agiJobManager: { methods: {
      getJobDeadlines: () => ({ call: async () => state.raw }), settlementPaused: () => ({ call: async () => state.paused })
    } }, nowSec: () => state.now, secondsToHuman: String, fmtRemaining: String,
    computeValidatorBondFromPayout: () => 1000000n, getNumericText: () => 8000n,
    el: id => ({ textContent: id === 'voteQuorum' ? state.quorum : '3' }), ...overrides
  });
  vm.runInContext(section('async function readJobDeadlines(', 'async function fetchJobSnapshot('), ctx);
  vm.runInContext(section('function simulateJobSettlement(', 'async function fetchJobTimeline('), ctx);
  return { ctx, state };
}
const job = overrides => ({ payout: '100000000', agentPayoutPct: '52', completionRequested: true, approvals: '0', disapprovals: '0', deadlines: { settlementAfter: 90, paused: false }, ...overrides });
describe('v0.9.5 buyer console behavior', () => {
  it('reads the exact contract deadline and preserves remaining time while paused', async () => {
    const { ctx, state } = context(); state.paused = true;
    const deadlines = await ctx.readJobDeadlines(7);
    assert.equal(deadlines.settlementAfter, 250);
    assert.match(ctx.jobDeadlineText({ deadlines }, 'settlementAfter'), /150 remaining/);
    state.now = 1000;
    assert.match(ctx.jobDeadlineText({ deadlines }, 'settlementAfter'), /150 remaining/);
  });
  it('fails closed when a deadline or pause read is malformed', async () => {
    for (const [key, value] of [['raw', ['150','bad','250','0','0']], ['paused', 'false']]) {
      const { ctx, state } = context(); state[key] = value;
      assert.equal(await ctx.readJobDeadlines(7), null);
    }
  });
  it('does not show an unreviewed submission as approved for payment', () => {
    const { ctx } = context(); assert.equal(ctx.simulateJobSettlement(job()).headline, 'Escalate unreviewed work');
  });
  it('requires the exact full-review deadline despite a reached approval threshold', () => {
    const { ctx } = context(); const result = ctx.simulateJobSettlement(job({ approvals: '3', deadlines: {settlementAfter: 250, paused: false} }));
    assert.equal(result.reviewEnded, false); assert.equal(result.headline, 'Approval threshold reached');
  });
  it('blocks settlement advice while the clock is paused or unknown', () => {
    const { ctx } = context();
    assert.equal(ctx.simulateJobSettlement(job({deadlines: null})).headline, 'Deadline unknown');
    assert.equal(ctx.simulateJobSettlement(job({deadlines: {settlementAfter: 90, paused: true}})).headline, 'Review clock paused');
  });
  it('does not assume an unknown quorum authorizes a majority payment', () => {
    const { ctx, state } = context(); state.quorum = '—';
    assert.equal(ctx.simulateJobSettlement(job({approvals: '1'})).headline, 'Review rules unavailable');
  });
});
