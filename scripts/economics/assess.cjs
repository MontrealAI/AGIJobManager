'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseUSDC, formatUSDC } = require('../lib/usdc.js');
const amountFields = ['jobCostUSDC', 'agentBondUSDC', 'reviewerBondUSDC', 'disputeBondUSDC', 'agentCostUSDC', 'reviewerCostUSDC'];
const integerFields = { rewardPercentage: [1, 60], slashBps: [0, 10000], approvals: [0, 50], rejections: [0, 50] };
const fields = [...amountFields, ...Object.keys(integerFields), 'disputeInitiator', 'assumptionSource'];
const maxUint = (1n << 256n) - 1n;

function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Scenario must be a JSON object.');
  for (const key of Object.keys(input)) if (!fields.includes(key)) throw new Error(`Unknown scenario field: ${key}`);
  const values = {};
  for (const key of amountFields) {
    if (typeof input[key] !== 'string') throw new Error(`${key} must be an exact decimal string, such as "100".`);
    try { values[key] = BigInt(parseUSDC(input[key])); }
    catch (error) { throw new Error(`${key}: ${error.message}`); }
  }
  for (const [key, [minimum, maximum]] of Object.entries(integerFields)) {
    if (!Number.isSafeInteger(input[key]) || input[key] < minimum || input[key] > maximum) throw new Error(`${key} must be an integer from ${minimum} to ${maximum}.`);
    values[key] = BigInt(input[key]);
  }
  if (!values.jobCostUSDC) throw new Error('jobCostUSDC must be greater than zero.');
  if (values.approvals + values.rejections > 50n) throw new Error('Total reviewers cannot exceed 50.');
  for (const key of ['agentBondUSDC', 'reviewerBondUSDC', 'disputeBondUSDC']) if (values[key] > values.jobCostUSDC) throw new Error(`${key} cannot exceed jobCostUSDC.`);
  if (!['none', 'buyer', 'agent'].includes(input.disputeInitiator)) throw new Error('disputeInitiator must be none, buyer, or agent.');
  if ((input.disputeInitiator === 'none') !== (values.disputeBondUSDC === 0n)) throw new Error('Use a zero dispute bond only with disputeInitiator none.');
  if (typeof input.assumptionSource !== 'string' || !input.assumptionSource.trim()) throw new Error('assumptionSource must explain where the settings and cost assumptions came from.');
  const total = values.jobCostUSDC + values.agentBondUSDC + (values.approvals + values.rejections) * values.reviewerBondUSDC + values.disputeBondUSDC;
  if (total > maxUint || values.jobCostUSDC * 100n > maxUint || values.reviewerBondUSDC * values.slashBps > maxUint) throw new Error('Scenario exceeds safe contract arithmetic bounds.');
  return values;
}

function assess(input) {
  const v = validate(input);
  const payout = v.jobCostUSDC, bond = v.reviewerBondUSDC, count = v.approvals + v.rejections;
  const buyerDispute = input.disputeInitiator === 'buyer' ? v.disputeBondUSDC : 0n;
  const agentDispute = input.disputeInitiator === 'agent' ? v.disputeBondUSDC : 0n;
  const total = payout + v.agentBondUSDC + count * bond + v.disputeBondUSDC;
  const scenarios = {};
  for (const name of ['agentWin', 'buyerWin', 'buyerAcceptance', 'neutralTimeout']) {
    if (name === 'buyerAcceptance' && v.disputeBondUSDC !== 0n) {
      scenarios[name] = { modeled: false, reason: 'Buyer acceptance requires undisputed work; a posted party dispute bond indicates an active dispute.' };
      continue;
    }
    const neutral = name === 'neutralTimeout', wins = name === 'agentWin' || name === 'buyerAcceptance';
    const correct = neutral ? 0n : wins ? v.approvals : v.rejections;
    const slash = neutral || name === 'buyerAcceptance' ? 0n : bond * v.slashBps / 10000n;
    let budget = !neutral && (wins ? count > 0n : correct > 0n) ? payout * v.rewardPercentage / 100n : 0n;
    if (!wins && budget > v.agentBondUSDC) budget = v.agentBondUSDC;
    const pool = budget + slash * (count - correct);
    const each = correct ? pool / correct : 0n;
    const remainder = pool - each * correct;
    const amount30 = wins ? payout * 30n / 100n : 0n, amount10 = wins ? payout * 10n / 100n : 0n;
    const agentProceeds = wins ? payout - budget - amount30 - amount10 + remainder : 0n;
    const agentReceipt = agentProceeds + (wins || neutral ? v.agentBondUSDC : 0n) + (wins ? v.disputeBondUSDC : neutral ? agentDispute : 0n);
    const buyerReceipt = neutral ? payout + buyerDispute : wins ? 0n : payout + v.agentBondUSDC - budget + remainder + v.disputeBondUSDC;
    const reviewer = (number, approve) => {
      if (!number) return { count: 0, eachReceiptUSDC: null, eachRewardUSDC: null, eachBondLossUSDC: null, eachNetAfterAssumedCostUSDC: null };
      const aligned = !neutral && approve === wins;
      const reward = aligned ? each : 0n, loss = aligned ? 0n : slash;
      return { count: Number(number), eachReceiptUSDC: formatUSDC(bond + reward - loss), eachRewardUSDC: formatUSDC(reward), eachBondLossUSDC: formatUSDC(loss), eachNetAfterAssumedCostUSDC: formatUSDC(reward - loss - v.reviewerCostUSDC) };
    };
    const approvals = reviewer(v.approvals, true), rejections = reviewer(v.rejections, false);
    const allocated = agentReceipt + buyerReceipt + amount30 + amount10 + (v.approvals ? BigInt(parseUSDC(approvals.eachReceiptUSDC)) * v.approvals : 0n) + (v.rejections ? BigInt(parseUSDC(rejections.eachReceiptUSDC)) * v.rejections : 0n);
    if (allocated !== total) throw new Error('Scenario conservation check failed.');
    const notices = [];
    const agentNet = agentReceipt - v.agentBondUSDC - agentDispute - v.agentCostUSDC;
    if (agentNet < 0n) notices.push('Agent receipts do not cover lost collateral and the supplied work/gas/capital cost.');
    if (correct && each < v.reviewerCostUSDC) notices.push('Each reviewer matching the outcome earns less than the supplied review/gas/capital cost.');
    if (!neutral && !correct) notices.push('No reviewer matches this outcome; unused reward and slashed collateral go to the winning party.');
    if (name === 'buyerAcceptance') notices.push('Acceptance additionally requires submitted, undisputed work. A zero dispute bond does not establish eligibility; automatic disputes can have no bond.');
    if (neutral) notices.push('No work or review is compensated; own bonds return. Exit still requires the on-chain deadline and settlement to be unpaused.');
    scenarios[name] = {
      modeled: true,
      fundedBaseReviewerBudgetUSDC: formatUSDC(budget), reviewerRewardPoolIncludingSlashesUSDC: formatUSDC(pool),
      unallocatedPoolToWinningPartyUSDC: formatUSDC(remainder), wallet30USDC: formatUSDC(amount30), wallet10USDC: formatUSDC(amount10),
      buyerReceiptUSDC: formatUSDC(buyerReceipt), buyerCashChangeUSDC: formatUSDC(buyerReceipt - payout - buyerDispute),
      agentJobProceedsUSDC: formatUSDC(agentProceeds), agentReceiptIncludingReturnedBondsUSDC: formatUSDC(agentReceipt),
      agentNetAfterAssumedCostUSDC: formatUSDC(agentNet), approvingReviewers: approvals, rejectingReviewers: rejections,
      totalAllocatedUSDC: formatUSDC(allocated), notices,
    };
  }
  return {
    report: 'Offline scenario analysis — not live quotes or certified readiness',
    assumptionSource: input.assumptionSource,
    inputs: { ...input },
    totalDepositedIncludingBondsUSDC: formatUSDC(total),
    limitations: [
      'No network, price, signer, eligibility, quorum, deadline, work-quality, or arbitration checks. Outcomes are separate counterfactuals, not predictions or a transaction plan.',
      'Protocol amounts use integer USDC units. Costs are supplied assumptions in USDC equivalents, including work/review effort, all gas, and capital cost; the same per-reviewer cost applies to every vote.',
      'Receipt means paid USDC or a recorded deferred claim. It does not promise immediate liquidity, token transferability, or successful recovery.',
      'Returned own bonds are excluded from net earnings. Buyer cash change excludes the value of delivered work, buyer gas, delay and other losses.',
      'Positive margins do not prove reviewer independence, incentive compatibility, truthful arbitration, or mainnet readiness. No probabilities or expected returns are inferred.',
      'Unassigned cancellation and no-submission expiry are outside this four-outcome model. Expiry forfeits the agent bond; it is different from neutral arbitration timeout.',
    ],
    scenarios,
  };
}

function render(report) {
  const lines = [report.report, `Assumptions: ${report.assumptionSource}`, `Deposited, including bonds: ${report.totalDepositedIncludingBondsUSDC} USDC`];
  const titles = { agentWin: 'Agent wins adjudicated/review outcome', buyerWin: 'Buyer wins adjudication/review outcome', buyerAcceptance: 'Buyer explicitly accepts undisputed work', neutralTimeout: 'Unanswered arbitration reaches neutral timeout' };
  for (const [name, s] of Object.entries(report.scenarios)) {
    lines.push('', titles[name]);
    if (!s.modeled) { lines.push(`  Not modeled: ${s.reason}`); continue; }
    lines.push(`  Buyer receives ${s.buyerReceiptUSDC}; cash change ${s.buyerCashChangeUSDC} USDC.`, `  Agent job proceeds ${s.agentJobProceedsUSDC}; receipt with bonds ${s.agentReceiptIncludingReturnedBondsUSDC}; net after assumed costs ${s.agentNetAfterAssumedCostUSDC} USDC.`);
    for (const [label, r] of [['Approving', s.approvingReviewers], ['Rejecting', s.rejectingReviewers]]) {
      if (r.count) lines.push(`  ${label} reviewers (${r.count}): each reward ${r.eachRewardUSDC}, bond loss ${r.eachBondLossUSDC}, net after assumed costs ${r.eachNetAfterAssumedCostUSDC} USDC.`);
    }
    lines.push(`  Settlement wallets receive ${s.wallet30USDC} / ${s.wallet10USDC} USDC. Pool remainder to winner: ${s.unallocatedPoolToWinningPartyUSDC} USDC.`);
    for (const notice of s.notices) lines.push(`  Note: ${notice}`);
  }
  lines.push('', ...report.limitations.map(line => `Limit: ${line}`));
  return lines.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const usage = 'Usage: node scripts/economics/assess.cjs <scenario.json|--example> [--json]\nAll settings and cost estimates must be supplied. --example uses an explicitly hypothetical bundled example.';
  if (args.length === 1 && args[0] === '--help') console.log(usage);
  else {
    try {
      if (args.length < 1 || args.length > 2 || (args.length === 2 && args[1] !== '--json') || (args[0].startsWith('--') && args[0] !== '--example')) throw new Error(usage);
      const filename = args[0] === '--example' ? path.join(__dirname, 'example.json') : path.resolve(args[0]);
      const result = assess(JSON.parse(fs.readFileSync(filename, 'utf8')));
      console.log(args[1] === '--json' ? JSON.stringify(result, null, 2) : render(result));
    } catch (error) { console.error(`Scenario analysis failed: ${error.message}`); process.exitCode = 1; }
  }
}

module.exports = { assess, render };
