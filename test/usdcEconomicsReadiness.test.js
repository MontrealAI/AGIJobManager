const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { assess, render } = require('../scripts/economics/assess.cjs');
const { formatUSDC, parseUSDC } = require('../scripts/lib/usdc.js');
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

contract('USDC scenario differential against local settlement', accounts => {
  const { buildInitConfig } = require('./helpers/deploy');
  const [owner, buyer, agent, alice, bob, carol, , , wallet30, wallet10] = accounts;
  const voters = [alice, bob, carol], zero = '0x' + '00'.repeat(32);
  const raw = amount => BigInt(parseUSDC(amount));
  const rpc = (method, params = []) => web3.currentProvider.request({ method, params });
  const advance = async seconds => { await rpc('evm_increaseTime', [seconds]); await rpc('evm_mine'); };
  async function fixture(recipient30 = wallet30) {
    const token = await artifacts.require('MockUSDCControls').new();
    const ens = await artifacts.require('MockENSRegistry').new();
    const wrapper = await artifacts.require('MockNameWrapper').new();
    const manager = await artifacts.require('AGIJobManager').new(...buildInitConfig(token.address, 'ipfs://', ens.address, wrapper.address, zero, zero, zero, zero, zero, zero, [recipient30, wallet10]));
    await manager.setAgentNftRequired(false);
    await manager.addAdditionalAgent(agent);
    for (const voter of voters) await manager.addAdditionalValidator(voter);
    await manager.addModerator(owner);
    await manager.setRequiredValidatorApprovals(0);
    await manager.setRequiredValidatorDisapprovals(0);
    await manager.setCompletionReviewPeriod(1000);
    await manager.setDisputeReviewPeriod(10);
    await manager.unpauseIntake();
    for (const account of [buyer, agent, ...voters]) {
      await token.mint(account, '1000000000000');
      await token.approve(manager.address, '1000000000000', { from: account });
    }
    const amount = async account => BigInt((await token.balanceOf(account)).toString());
    const claim = async account => BigInt((await manager.pendingUSDC(account)).toString());
    return { token, manager, amount, claim };
  }
  async function prepare(f, input) {
    const agentBond = raw(input.agentBondUSDC).toString(), reviewerBond = raw(input.reviewerBondUSDC).toString();
    await f.manager.setAgentBondParams(0, agentBond, agentBond);
    await f.manager.setValidatorBondParams(0, reviewerBond, reviewerBond);
    await f.manager.setValidatorSlashBps(input.slashBps);
    await f.manager.setValidationRewardPercentage(input.rewardPercentage);
    await f.manager.createJob('ipfs://criteria', parseUSDC(input.jobCostUSDC), 1, 'Measured criteria', { from: buyer });
    await f.manager.applyForJob(0, '', [], { from: agent });
    await f.manager.requestJobCompletion(0, 'ipfs://evidence', { from: agent });
    for (let i = 0; i < input.approvals + input.rejections; i++) await f.manager[i < input.approvals ? 'validateJob' : 'disapproveJob'](0, '', [], { from: voters[i] });
  }

  it('matches actual paid-or-reserved receipts for micro-USDC rounding, disabled/capped bonds and all four outcomes', async () => {
    const f = await fixture();
    const clean = await rpc('evm_snapshot');
    let cleanSnapshot = clean;
    const cases = [
      ['0.000001', '0.000001', '0.000001', 60, 10000, 0, 0],
      ['0.000002', '0', '0', 1, 0, 2, 1],
      ['0.000003', '0.000001', '0.000001', 60, 8000, 2, 1],
      ['0.000007', '0.000002', '0.000002', 8, 10000, 1, 2],
      ['0.000011', '0', '0.000011', 60, 10000, 0, 3],
      ['0.000099', '0.000099', '0.000099', 60, 9999, 3, 0],
      ['100.000003', '5.0432', '15', 8, 8000, 2, 1],
      ['100.000003', '0', '0', 60, 0, 1, 2],
    ];
    for (let index = 0; index < cases.length; index++) {
      const [jobCostUSDC, agentBondUSDC, reviewerBondUSDC, rewardPercentage, slashBps, approvals, rejections] = cases[index];
      const input = { ...example, jobCostUSDC, agentBondUSDC, reviewerBondUSDC, rewardPercentage, slashBps, approvals, rejections };
      await prepare(f, input);
      let submitted = await rpc('evm_snapshot');
      for (const outcome of ['buyerAcceptance', 'agentWin', 'buyerWin', 'neutralTimeout']) {
        const scenarioInput = { ...input };
        if (outcome !== 'buyerAcceptance') {
          const initiator = index % 2 ? agent : buyer;
          await f.manager.disputeJob(0, { from: initiator });
          scenarioInput.disputeInitiator = initiator === buyer ? 'buyer' : 'agent';
          scenarioInput.disputeBondUSDC = formatUSDC((await f.manager.getJobBonds(0)).disputeAmount.toString());
        }
        if (index === cases.length - 1) await f.token.setBlocked(agent, true);
        const expected = assess(scenarioInput).scenarios[outcome];
        const expectedReceipts = new Map([[buyer, raw(expected.buyerReceiptUSDC)], [agent, raw(expected.agentReceiptIncludingReturnedBondsUSDC)], [wallet30, raw(expected.wallet30USDC)], [wallet10, raw(expected.wallet10USDC)]]);
        for (let i = 0; i < approvals + rejections; i++) expectedReceipts.set(voters[i], raw((i < approvals ? expected.approvingReviewers : expected.rejectingReviewers).eachReceiptUSDC));
        const before = new Map();
        for (const account of expectedReceipts.keys()) before.set(account, await f.amount(account) + await f.claim(account));
        if (outcome === 'buyerAcceptance') await f.manager.acceptJob(0, { from: buyer });
        else if (outcome === 'neutralTimeout') { await advance(21); await f.manager.refundUnresolvedDispute(0); }
        else await f.manager.resolveDisputeWithCode(0, outcome === 'agentWin' ? 1 : 2, 'Differential outcome');
        for (const [account, expectedReceipt] of expectedReceipts) assert.equal(await f.amount(account) + await f.claim(account) - before.get(account), expectedReceipt, `${index}/${outcome}/${account}`);
        assert.equal(await f.amount(f.manager.address), BigInt((await f.manager.lockedClaims()).toString()), `${index}/${outcome}/claim backing`);
        assert.equal((await f.manager.withdrawableUSDC()).toString(), '0');
        await rpc('evm_revert', [submitted]); submitted = await rpc('evm_snapshot');
      }
      await rpc('evm_revert', [cleanSnapshot]); cleanSnapshot = await rpc('evm_snapshot');
    }
  });

  it('demonstrates why overlapping settlement beneficiaries must aggregate role allocations', async () => {
    const f = await fixture(agent);
    await prepare(f, example);
    const before = await f.amount(agent);
    await f.manager.acceptJob(0, { from: buyer });
    const report = assess(example), expected = report.scenarios.buyerAcceptance;
    assert.equal(await f.amount(agent) - before, raw(expected.agentReceiptIncludingReturnedBondsUSDC) + raw(expected.wallet30USDC));
    assert.equal(await f.amount(agent) - before, 87043202n);
    assert.equal(raw(expected.agentReceiptIncludingReturnedBondsUSDC), 57043202n);
    assert.match(report.beneficiaryAssumption, /separate beneficiaries/);
    assert.match(report.beneficiaryAssumption, /add that share to their receipts and net/);
    assert.ok(render(report).includes(`Beneficiaries: ${report.beneficiaryAssumption}`));
  });
});
