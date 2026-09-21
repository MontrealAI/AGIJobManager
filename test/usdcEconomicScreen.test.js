const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { screen, render } = require('../scripts/economics/screen.cjs');
const example = require('../scripts/economics/screen-example.json');
const fresh = () => JSON.parse(JSON.stringify(example));

describe('Conditional economic screening', () => {
  it('calculates hand-derived weighted net earnings without counting returned bonds', () => {
    const r = screen(example);
    assert.equal(r.decision, 'WITHIN_SUPPLIED_LIMITS');
    assert.equal(r.parties.agent.expectedNetUSDC, '483.40000194');
    assert.equal(r.parties.employer.expectedNetUSDC, '968.2');
    assert.equal(r.parties.eachApprovingReviewer.expectedNetUSDC, '19.46666602');
    assert.equal(r.parties.eachApprovingReviewer.worstModeledNetUSDC, '-124');
    assert.equal(r.parties.eachApprovingReviewer.assumedLossWeightPpm, 30000);
    assert.equal(r.totalDepositedIncludingBondsUSDC, '1500');
    assert.match(r.authorization, /^NONE/);
  });
  it('rejects a profitable-looking job when even one participant misses its margin', () => {
    const input = fresh();
    input.policy.eachApprovingReviewer.minimumExpectedNetUSDC = '20';
    const r = screen(input);
    assert.equal(r.decision, 'OUTSIDE_SUPPLIED_LIMITS');
    assert.equal(r.failures.length, 1);
    assert.match(r.failures[0], /eachApprovingReviewer/);
    assert.equal(r.parties.agent.expectedMarginMet, true);
  });
  it('retains zero-weight failure scenarios in maximum loss checks', () => {
    const input = fresh();
    for (const row of Object.values(input.outcomes)) row.weightPpm = 0;
    input.outcomes.agentWin.weightPpm = 1000000;
    input.policy.eachApprovingReviewer.maximumScenarioLossUSDC = '123.999999';
    const r = screen(input);
    assert.equal(r.parties.eachApprovingReviewer.assumedLossWeightPpm, 0);
    assert.equal(r.parties.eachApprovingReviewer.maximumModeledLossUSDC, '124');
    assert.equal(r.parties.eachApprovingReviewer.scenarioLossWithinLimit, false);
    assert.equal(r.decision, 'OUTSIDE_SUPPLIED_LIMITS');
  });
  it('compares exact weighted fractions without rounding away a tiny loss', () => {
    const input = fresh();
    Object.assign(input.terms, { jobCostUSDC: '0.000001', agentBondUSDC: '0', reviewerBondUSDC: '0', approvals: 0 });
    for (const p of Object.values(input.policy)) { p.minimumExpectedNetUSDC = '0'; p.maximumScenarioLossUSDC = '1'; }
    for (const row of Object.values(input.outcomes)) Object.assign(row, { weightPpm: 0, agentCostUSDC: '0', employerCostUSDC: '0', eachReviewerCostUSDC: '0' });
    input.outcomes.agentWin.weightPpm = 499999;
    Object.assign(input.outcomes.neutralTimeout, { weightPpm: 500001, agentCostUSDC: '0.000001' });
    const r = screen(input);
    assert.equal(r.parties.agent.expectedNetUSDC, '-0.000000000002');
    assert.equal(r.parties.agent.expectedMarginMet, false);
  });
  it('accounts for outcome-specific delivery, review and employer costs', () => {
    const input = fresh();
    input.outcomes.buyerWin.agentCostUSDC = '1020';
    input.outcomes.buyerWin.eachReviewerCostUSDC = '1004';
    input.outcomes.buyerWin.employerCostUSDC = '1010';
    const r = screen(input);
    assert.equal(r.parties.agent.expectedNetUSDC, '463.40000194');
    assert.equal(r.parties.eachApprovingReviewer.expectedNetUSDC, '-0.53333398');
    assert.equal(r.parties.employer.expectedNetUSDC, '948.2');
    assert.equal(r.outcomes.buyerWin.netUSDC.agent, '-1070');
  });
  it('requires employer value to cover their own payment and handling costs', () => {
    const input = fresh();
    input.outcomes.agentWin.employerValueUSDC = '0';
    const r = screen(input);
    assert.equal(r.parties.employer.expectedNetUSDC, '-971.8');
    assert.equal(r.parties.employer.expectedMarginMet, false);
  });
  it('handles absent reviewer groups and independently evaluates dissenting reviewers', () => {
    const input = fresh();
    assert.deepEqual(screen(input).parties.eachRejectingReviewer, { applicable: false, count: 0 });
    Object.assign(input.terms, { approvals: 2, rejections: 1 });
    const r = screen(input);
    assert.equal(r.parties.eachRejectingReviewer.expectedNetUSDC, '-114.6');
    assert.equal(r.parties.eachRejectingReviewer.expectedMarginMet, false);
    assert.equal(r.outcomes.buyerAcceptance.settlement.rejectingReviewers.eachBondLossUSDC, '0');
  });
  it('keeps neutral refunds distinct from compensation for work', () => {
    const input = fresh();
    for (const row of Object.values(input.outcomes)) row.weightPpm = 0;
    input.outcomes.neutralTimeout.weightPpm = 1000000;
    const r = screen(input);
    assert.equal(r.parties.agent.expectedNetUSDC, '-20');
    assert.equal(r.parties.eachApprovingReviewer.expectedNetUSDC, '-4');
    assert.equal(r.parties.employer.expectedNetUSDC, '-10');
    assert.equal(r.decision, 'OUTSIDE_SUPPLIED_LIMITS');
  });
  it('supports dispute collateral and refuses nonzero weight for unavailable acceptance', () => {
    const input = fresh();
    Object.assign(input.terms, { disputeInitiator: 'agent', disputeBondUSDC: '10' });
    const r = screen(input);
    assert.equal(r.outcomes.buyerAcceptance.modeled, false);
    assert.equal(r.outcomes.buyerWin.netUSDC.agent, '-80');
    assert.equal(r.outcomes.neutralTimeout.netUSDC.agent, '-20');
    input.outcomes.buyerAcceptance.weightPpm = 1;
    input.outcomes.agentWin.weightPpm -= 1;
    assert.throws(() => screen(input), /unavailable/);
  });
  it('rejects missing, unknown or malformed nested fields and misleading weights', () => {
    for (const mutate of [x => { delete x.scope; }, x => { x.authorized = true; }, x => { x.scope = 'all-jobs'; }, x => { x.schemaVersion = 2; }, x => { x.terms.approvals = 51; }, x => { x.terms.slashBps = 10001; }, x => { x.terms.jobCostUSDC = 1000; }, x => { delete x.outcomes.buyerWin; }, x => { x.outcomes.failure = {}; }, x => { x.outcomes.agentWin.weightPpm = 970001; }, x => { x.outcomes.agentWin.weightPpm = '970000'; }, x => { x.outcomes.agentWin.weightPpm = -1; }, x => { x.outcomes.agentWin.weightPpm = 1.2; }, x => { x.outcomes.agentWin.rationale = ''; }, x => { x.assumptionSource = 'bad\u001b[2J'; }, x => { x.policy.agent.minimumExpectedNetUSDC = '-1'; }, x => { x.policy.agent.maximumScenarioLossUSDC = '0.0000001'; }, x => { x.outcomes.buyerWin.agentCostUSDC = '1e3'; }, x => { delete x.outcomes.neutralTimeout.employerValueUSDC; }]) {
      const input = fresh(); mutate(input); assert.throws(() => screen(input));
    }
    for (const input of [null, [], {}, 'x']) assert.throws(() => screen(input));
  });
  it('treats equality at both supplied limits as within limits and preserves inputs', () => {
    const input = fresh(), original = fresh();
    input.policy.eachApprovingReviewer.maximumScenarioLossUSDC = '124';
    const r = screen(input);
    assert.equal(r.parties.eachApprovingReviewer.scenarioLossWithinLimit, true);
    assert.deepEqual(example, original);
    input.terms.jobCostUSDC = '2';
    assert.equal(r.inputs.terms.jobCostUSDC, '1000');
  });
  it('supports exact amounts above the JavaScript safe integer range', () => {
    const input = fresh();
    input.terms.jobCostUSDC = '9007199254740993.000001';
    const r = screen(input);
    assert.equal(r.outcomes.agentWin.settlement.totalAllocatedUSDC, '9007199254741493.000001');
    assert.equal(r.outcomes.buyerAcceptance.settlement.totalAllocatedUSDC, r.totalDepositedIncludingBondsUSDC);
  });
  it('returns machine-readable CLI decisions and distinct invalid-input/limit exit codes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'economic-screen-'));
    try {
      const cli = path.resolve(__dirname, '../scripts/economics/screen.cjs');
      const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
      const good = run(['--example', '--json']);
      assert.equal(good.status, 0, good.stderr);
      assert.equal(JSON.parse(good.stdout).authorization.startsWith('NONE'), true);
      const input = fresh(); input.policy.agent.minimumExpectedNetUSDC = '1000';
      const file = path.join(dir, 'scenario.json'); fs.writeFileSync(file, JSON.stringify(input));
      const fail = run([file, '--json']);
      assert.equal(fail.status, 2); assert.equal(JSON.parse(fail.stdout).decision, 'OUTSIDE_SUPPLIED_LIMITS');
      fs.writeFileSync(file, '{invalid');
      const invalid = run([file]); assert.equal(invalid.status, 1); assert.equal(invalid.stdout, '');
      for (const args of [[], ['--example', '--ignore-risk'], ['--live'], [dir]]) assert.equal(run(args).status, 1);
      assert.equal(run(['--help']).status, 0);
      assert.match(render(screen(example)), /not permission/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
