const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { assess, render } = require('../scripts/economics/assess.cjs');
const { formatUSDC } = require('../scripts/lib/usdc.js');
const example = require('../scripts/economics/example.json');

describe('Offline USDC participant cost scenarios', () => {
  it('separates returned collateral from earnings and exposes an underfunded review example', () => {
    const report = assess(example), s = report.scenarios.agentWin;
    assert.equal(s.agentJobProceedsUSDC, '52.000002');
    assert.equal(s.agentReceiptIncludingReturnedBondsUSDC, '57.043202');
    assert.equal(s.agentNetAfterAssumedCostUSDC, '7.000002');
    assert.equal(s.approvingReviewers.eachReceiptUSDC, '17.666666');
    assert.equal(s.approvingReviewers.eachNetAfterAssumedCostUSDC, '-0.333334');
    assert.equal(s.unallocatedPoolToWinningPartyUSDC, '0.000002');
    assert.ok(s.notices.some(text => text.includes('earns less')));
    assert.match(report.report, /not live quotes or certified readiness/);
  });

  it('caps buyer-win review funding at the agent bond and preserves every escrow unit', () => {
    const s = assess({ ...example, approvals: 0, rejections: 3 }).scenarios.buyerWin;
    assert.equal(s.buyerReceiptUSDC, '100.000002');
    assert.equal(s.fundedBaseReviewerBudgetUSDC, '5.0432');
    assert.equal(s.rejectingReviewers.eachRewardUSDC, '1.681066');
    assert.equal(s.agentNetAfterAssumedCostUSDC, '-50.0432');
    assert.equal(s.wallet30USDC, '0');
    assert.equal(s.wallet10USDC, '0');
  });

  it('includes forfeited reviewer collateral in adjudicated rewards and losses', () => {
    const s = assess({ ...example, approvals: 2, rejections: 1 }).scenarios;
    assert.equal(s.agentWin.approvingReviewers.eachRewardUSDC, '10');
    assert.equal(s.agentWin.rejectingReviewers.eachBondLossUSDC, '12');
    assert.equal(s.agentWin.rejectingReviewers.eachNetAfterAssumedCostUSDC, '-15');
    assert.equal(s.buyerWin.rejectingReviewers.eachRewardUSDC, '29.0432');
    assert.equal(s.buyerWin.buyerReceiptUSDC, '100');
  });

  it('never slashes dissent on buyer acceptance and rewards only approving reviewers', () => {
    const s = assess({ ...example, approvals: 2, rejections: 1 }).scenarios.buyerAcceptance;
    assert.equal(s.approvingReviewers.eachRewardUSDC, '4');
    assert.equal(s.rejectingReviewers.eachRewardUSDC, '0');
    assert.equal(s.rejectingReviewers.eachBondLossUSDC, '0');
    assert.equal(s.rejectingReviewers.eachReceiptUSDC, '15');
    assert.equal(s.rejectingReviewers.eachNetAfterAssumedCostUSDC, '-3');
    assert.ok(s.notices.some(text => text.includes('automatic disputes can have no bond')));
  });

  it('allocates unused rewards and slashes to the winner when no reviewer matches', () => {
    const s = assess({ ...example, approvals: 0, rejections: 3 }).scenarios;
    assert.equal(s.agentWin.agentJobProceedsUSDC, '96');
    assert.equal(s.agentWin.unallocatedPoolToWinningPartyUSDC, '44');
    assert.equal(s.buyerAcceptance.agentJobProceedsUSDC, '60');
    assert.equal(s.buyerAcceptance.rejectingReviewers.eachReceiptUSDC, '15');
    assert.equal(assess(example).scenarios.buyerWin.buyerReceiptUSDC, '141.0432');
  });

  it('handles no reviewers without dividing by zero or treating a modeled agent win as automatic', () => {
    const report = assess({ ...example, approvals: 0 }), s = report.scenarios;
    assert.equal(s.buyerAcceptance.agentJobProceedsUSDC, '60');
    assert.equal(s.agentWin.fundedBaseReviewerBudgetUSDC, '0');
    assert.equal(s.agentWin.approvingReviewers.eachRewardUSDC, null);
    assert.equal(s.neutralTimeout.buyerReceiptUSDC, '100');
    assert.ok(report.limitations.some(text => text.includes('counterfactuals')));
  });

  it('returns own collateral in neutral timeout but leaves work and review uncompensated', () => {
    const s = assess({ ...example, disputeInitiator: 'agent', disputeBondUSDC: '1' }).scenarios.neutralTimeout;
    assert.equal(s.buyerReceiptUSDC, '100');
    assert.equal(s.agentReceiptIncludingReturnedBondsUSDC, '6.0432');
    assert.equal(s.agentNetAfterAssumedCostUSDC, '-45');
    assert.equal(s.approvingReviewers.eachReceiptUSDC, '15');
    assert.equal(s.approvingReviewers.eachNetAfterAssumedCostUSDC, '-3');
  });

  it('accounts for party dispute bonds without offering acceptance of disputed work', () => {
    const s = assess({ ...example, disputeInitiator: 'buyer', disputeBondUSDC: '1' }).scenarios;
    assert.equal(s.agentWin.agentNetAfterAssumedCostUSDC, '8.000002');
    assert.equal(s.agentWin.buyerCashChangeUSDC, '-101');
    assert.equal(s.buyerWin.buyerCashChangeUSDC, '41.0432');
    assert.equal(s.neutralTimeout.buyerReceiptUSDC, '101');
    assert.equal(s.neutralTimeout.buyerCashChangeUSDC, '0');
    assert.equal(s.buyerAcceptance.modeled, false);
  });

  it('keeps one-unit payouts exact and represents disabled collateral', () => {
    const s = assess({ ...example, jobCostUSDC: '0.000001', agentBondUSDC: '0', reviewerBondUSDC: '0', agentCostUSDC: '0', reviewerCostUSDC: '0' }).scenarios;
    assert.equal(s.agentWin.agentJobProceedsUSDC, '0.000001');
    assert.equal(s.agentWin.wallet30USDC, '0');
    assert.equal(s.buyerWin.buyerReceiptUSDC, '0.000001');
    assert.equal(s.buyerWin.rejectingReviewers.count, 0);
  });

  it('exposes zero agent base income at the maximum reviewer rate and reviewer dilution', () => {
    const s = assess({ ...example, rewardPercentage: 60, approvals: 50 }).scenarios.agentWin;
    assert.equal(s.agentJobProceedsUSDC, '0');
    assert.equal(s.agentNetAfterAssumedCostUSDC, '-45');
    assert.equal(s.approvingReviewers.eachRewardUSDC, '1.2');
    assert.equal(s.approvingReviewers.eachNetAfterAssumedCostUSDC, '-1.8');
  });

  it('conserves funds across every vote split at the 50-voter bound and rate/slash extremes', () => {
    for (const rewardPercentage of [1, 8, 60]) for (const slashBps of [0, 8000, 10000]) for (let approvals = 0; approvals <= 50; approvals++) {
      const report = assess({ ...example, jobCostUSDC: '100.000003', rewardPercentage, slashBps, approvals, rejections: 50 - approvals });
      for (const s of Object.values(report.scenarios)) assert.equal(s.totalAllocatedUSDC, report.totalDepositedIncludingBondsUSDC);
    }
  });

  it('rejects malformed amounts, unsafe numbers, out-of-range settings and incomplete assumptions', () => {
    for (const key of ['jobCostUSDC', 'agentBondUSDC', 'reviewerBondUSDC', 'disputeBondUSDC', 'agentCostUSDC', 'reviewerCostUSDC']) {
      for (const value of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1, '-1', '1e3', '1.0000001', 'NaN', '', ' 1', true, null]) assert.throws(() => assess({ ...example, [key]: value }), new RegExp(key));
    }
    for (const patch of [{ jobCostUSDC: '0' }, { approvals: 51 }, { approvals: 49, rejections: 2 }, { rejections: 1.1 }, { rewardPercentage: 0 }, { rewardPercentage: 61 }, { slashBps: 10001 }, { agentBondUSDC: '101' }, { disputeInitiator: 'buyer' }, { disputeBondUSDC: '1' }, { assumptionSource: ' ' }, { price: '1' }, { jobCostUSDC: ((1n << 256n) - 1n).toString() }]) assert.throws(() => assess({ ...example, ...patch }));
    for (const input of [null, [], {}, '100']) assert.throws(() => assess(input));
    const huge = formatUSDC(1n << 249n);
    assert.throws(() => assess({ ...example, jobCostUSDC: huge, reviewerBondUSDC: huge, agentBondUSDC: '0', approvals: 1, slashBps: 10000 }), /arithmetic bounds/);
  });

  it('produces usable CLI output with explicit assumptions and fails invalid invocations', () => {
    const cli = path.resolve(__dirname, '../scripts/economics/assess.cjs');
    const run = spawnSync(process.execPath, [cli, '--example', '--json'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(JSON.parse(run.stdout).assumptionSource, /Hypothetical/);
    assert.match(render(assess(example)), /net after assumed costs -0.333334 USDC/);
    const invalid = spawnSync(process.execPath, [cli, '--example', '--ignore-costs'], { encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Usage:/);
  });
});
