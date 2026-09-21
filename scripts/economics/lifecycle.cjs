'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { assess } = require('./assess.cjs');
const { parseUSDC, formatUSDC } = require('../lib/usdc.js');
const OUTCOMES = ['agentWin', 'buyerWin', 'buyerAcceptance', 'neutralTimeout', 'noSubmission', 'cancelled', 'paymentUnavailable'];
const SCALE = 1000000n;
function requireThat(ok, message) { if (!ok) throw new Error(message); }
function shape(value, keys, label) { requireThat(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), `${label}: expected exactly ${keys.join(', ')}.`); }
function text(value, label) { requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= 2000 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value), `${label}: invalid text.`); }
function uint(value, min, max, label) { requireThat(Number.isSafeInteger(value) && value >= min && value <= max, `${label}: expected an integer from ${min} to ${max}.`); return value; }
function money(value, label) { requireThat(typeof value === 'string', `${label}: use a decimal string.`); try { return BigInt(parseUSDC(value)); } catch (e) { throw new Error(`${label}: ${e.message}`); } }
function weighted(n) { const a = n < 0n ? -n : n, f = (a % (SCALE * SCALE)).toString().padStart(12, '0').replace(/0+$/, ''); return `${n < 0n ? '-' : ''}${a / (SCALE * SCALE)}${f ? '.' + f : ''}`; }
function max(...values) { return values.reduce((a, b) => a > b ? a : b, 0n); }

function lifecycle(input) {
  shape(input, ['schemaVersion', 'assumptionSource', 'horizonDays', 'terms', 'participants', 'cases'], 'Lifecycle');
  requireThat(input.schemaVersion === 1, 'Unsupported lifecycle schema.');
  text(input.assumptionSource, 'assumptionSource');
  uint(input.horizonDays, 1, 3650, 'horizonDays');
  shape(input.terms, ['jobCostUSDC', 'agentBondUSDC', 'reviewerBondUSDC', 'rewardPercentage', 'slashBps'], 'terms');
  const t = input.terms;
  const price = money(t.jobCostUSDC, 'jobCostUSDC'), agentBond = money(t.agentBondUSDC, 'agentBondUSDC'), reviewerBond = money(t.reviewerBondUSDC, 'reviewerBondUSDC');
  // Reuse the existing integer-arithmetic and contract-bound validation.
  assess({ ...t, approvals: 0, rejections: 0, disputeInitiator: 'none', disputeBondUSDC: '0', agentCostUSDC: '0', reviewerCostUSDC: '0', assumptionSource: input.assumptionSource });
  requireThat(Array.isArray(input.participants) && input.participants.length >= 3 && input.participants.length <= 52, 'Use an employer, an agent and 1–50 declared reviewers.');
  const actors = new Map();
  for (const p of input.participants) {
    shape(p, ['id', 'role', 'minimumExpectedNetUSDC', 'maximumScenarioLossUSDC'], 'participant');
    requireThat(typeof p.id === 'string' && /^[a-z][a-z0-9_-]{0,39}$/.test(p.id) && !actors.has(p.id), 'Participant IDs must be unique simple identifiers.');
    requireThat(['employer', 'agent', 'reviewer'].includes(p.role), 'Invalid participant role.');
    money(p.minimumExpectedNetUSDC, 'minimumExpectedNetUSDC'); money(p.maximumScenarioLossUSDC, 'maximumScenarioLossUSDC');
    actors.set(p.id, p);
  }
  const byRole = role => input.participants.filter(p => p.role === role);
  requireThat(byRole('employer').length === 1 && byRole('agent').length === 1, 'Exactly one employer and agent are required.');
  const employer = byRole('employer')[0].id, agent = byRole('agent')[0].id, reviewers = byRole('reviewer').map(p => p.id);
  const totals = Object.fromEntries([...actors.keys()].map(id => [id, { weighted: 0n, worst: null, capital: 0n, costs: 0n, lossWeightPpm: 0 }]));
  requireThat(Array.isArray(input.cases) && input.cases.length >= 8 && input.cases.length <= 64, 'Use 8–64 explicit lifecycle cases.');
  const ids = new Set(), covered = new Set(), adverse = new Set(), absent = new Set();
  let weights = 0, diluted = false, zeroReview = false, unavailable = false;
  const cases = [];
  for (const row of input.cases) {
    shape(row, ['id', 'outcome', 'weightPpm', 'rationale', 'ballots', 'otherApprovals', 'otherRejections', 'disputeInitiator', 'disputeBondUSDC', 'employerValueUSDC', 'costsUSDC'], 'case');
    text(row.id, 'case.id'); text(row.rationale, 'case.rationale');
    requireThat(!ids.has(row.id), 'Duplicate case ID.'); ids.add(row.id);
    requireThat(OUTCOMES.includes(row.outcome), 'Unsupported lifecycle outcome.'); covered.add(row.outcome);
    weights += uint(row.weightPpm, 0, 1000000, 'weightPpm');
    shape(row.ballots, reviewers, 'ballots'); shape(row.costsUSDC, [...actors.keys()], 'costsUSDC');
    const costs = Object.fromEntries([...actors.keys()].map(id => [id, money(row.costsUSDC[id], `costsUSDC.${id}`)]));
    const value = money(row.employerValueUSDC, 'employerValueUSDC'), disputeBond = money(row.disputeBondUSDC, 'disputeBondUSDC');
    requireThat(['none', 'buyer', 'agent'].includes(row.disputeInitiator), 'Invalid dispute initiator.');
    let approvals = uint(row.otherApprovals, 0, 50, 'otherApprovals'), rejections = uint(row.otherRejections, 0, 50, 'otherRejections');
    for (const id of reviewers) {
      const vote = row.ballots[id]; requireThat(['approve', 'reject', 'absent'].includes(vote), 'Invalid ballot.');
      if (vote === 'approve') approvals++; else if (vote === 'reject') rejections++; else absent.add(id);
      if ((vote === 'approve' && row.outcome === 'buyerWin') || (vote === 'reject' && row.outcome === 'agentWin')) adverse.add(id);
    }
    requireThat(approvals + rejections <= 50, 'Reviewer count exceeds the contract limit.');
    if (row.outcome === 'agentWin' && approvals === 50) diluted = true;
    if (['agentWin', 'buyerWin', 'buyerAcceptance', 'neutralTimeout'].includes(row.outcome) && approvals + rejections === 0) zeroReview = true;
    if (row.outcome === 'paymentUnavailable' && value === 0n && reviewers.every(id => row.ballots[id] !== 'absent')) unavailable = true;
    const simple = ['noSubmission', 'cancelled', 'paymentUnavailable'].includes(row.outcome);
    if (simple) requireThat(disputeBond === 0n && row.disputeInitiator === 'none', 'Non-adjudication stress cases require no dispute bond.');
    if (['noSubmission', 'cancelled'].includes(row.outcome)) requireThat(approvals + rejections === 0 && value === 0n, 'Pre-submission cases require no votes or delivered artifact value.');
    const deposit = Object.fromEntries([...actors.keys()].map(id => [id, 0n]));
    deposit[employer] = price + (row.disputeInitiator === 'buyer' ? disputeBond : 0n);
    deposit[agent] = (row.outcome === 'cancelled' ? 0n : agentBond) + (row.disputeInitiator === 'agent' ? disputeBond : 0n);
    for (const id of reviewers) if (row.ballots[id] !== 'absent') deposit[id] = reviewerBond;
    const receipt = Object.fromEntries([...actors.keys()].map(id => [id, 0n]));
    let settlement = null;
    if (!simple) {
      settlement = assess({ ...t, approvals, rejections, disputeInitiator: row.disputeInitiator, disputeBondUSDC: row.disputeBondUSDC, agentCostUSDC: '0', reviewerCostUSDC: '0', assumptionSource: input.assumptionSource }).scenarios[row.outcome];
      requireThat(settlement.modeled, 'Unavailable settlement case, including disputed buyer acceptance.');
      receipt[employer] = money(settlement.buyerReceiptUSDC, 'receipt'); receipt[agent] = money(settlement.agentReceiptIncludingReturnedBondsUSDC, 'receipt');
      for (const id of reviewers) if (row.ballots[id] !== 'absent') receipt[id] = money(settlement[row.ballots[id] === 'approve' ? 'approvingReviewers' : 'rejectingReviewers'].eachReceiptUSDC, 'receipt');
    } else if (row.outcome === 'cancelled') receipt[employer] = price;
    else if (row.outcome === 'noSubmission') receipt[employer] = price + agentBond;
    // paymentUnavailable is a cash-horizon stress: claims may still legally exist.
    const net = {};
    for (const id of actors.keys()) {
      const n = receipt[id] - deposit[id] - costs[id] + (id === employer ? value : 0n), total = totals[id];
      net[id] = formatUSDC(n); total.weighted += n * BigInt(row.weightPpm);
      if (total.worst === null || n < total.worst) total.worst = n;
      total.capital = max(total.capital, deposit[id]); total.costs = max(total.costs, costs[id]);
      if (n < 0n) total.lossWeightPpm += row.weightPpm;
    }
    cases.push({ id: row.id, outcome: row.outcome, weightPpm: row.weightPpm, approvals, rejections, netUSDC: net, capitalCommittedUSDC: Object.fromEntries(Object.entries(deposit).map(([id, v]) => [id, formatUSDC(v)])), settlement });
  }
  requireThat(weights === 1000000, 'Lifecycle weights must sum to exactly 1000000 ppm.');
  requireThat(OUTCOMES.every(o => covered.has(o)), 'Every lifecycle outcome, including cancellation, non-delivery and payment unavailability, must be included.');
  requireThat(unavailable && diluted && zeroReview && reviewers.every(id => adverse.has(id) && absent.has(id)), 'Include an all-participant payment-unavailability stress with zero artifact value, 50-approval dilution, a zero-review settlement, and absence/adverse-vote stress for every declared reviewer.');
  const failures = [], participants = {};
  for (const [id, p] of actors) {
    const r = totals[id], loss = max(-r.worst);
    const marginMet = r.weighted >= money(p.minimumExpectedNetUSDC, 'minimumExpectedNetUSDC') * SCALE;
    const lossWithinLimit = loss <= money(p.maximumScenarioLossUSDC, 'maximumScenarioLossUSDC');
    if (!marginMet) failures.push(`${id}: expected margin below limit.`);
    if (!lossWithinLimit) failures.push(`${id}: cash-horizon modeled loss exceeds limit.`);
    participants[id] = { role: p.role, expectedNetUSDC: weighted(r.weighted), worstModeledNetUSDC: formatUSDC(r.worst), maximumModeledLossUSDC: formatUSDC(loss), capitalCommittedUSDC: formatUSDC(r.capital), maximumCostUSDC: formatUSDC(r.costs), conservativeExposureUSDC: formatUSDC(r.capital + r.costs), assumedLossWeightPpm: r.lossWeightPpm, marginMet, lossWithinLimit };
  }
  return { schemaVersion: 1, decision: failures.length ? 'OUTSIDE_SUPPLIED_LIMITS' : 'WITHIN_SUPPLIED_LIMITS', horizonDays: input.horizonDays, assumptionSource: input.assumptionSource, participants, cases, failures, authorization: 'NONE', limitations: [
    'Weights, costs, artifact values and controls are assumptions. This calculation neither verifies evidence nor authorizes transactions.',
    'Cases are mutually exclusive assumed paths at the stated cash horizon. Payment unavailability treats committed receipts as unavailable; it does not extinguish claims or establish permanent loss.',
    'Worst loss includes zero-weight cases. Capital plus maximum cost is reserved separately from expected profit or loss.',
    'Only declared participants have economic limits checked. Other reviewers model dilution; their costs, independence and profitability are not established.',
    'Coverage checks ensure explicit stress cases, not exhaustive real-world risk. Custody compromise, common control, unmodeled failures and misspecified probabilities can exceed modeled losses.',
  ] };
}
function render(r) { return [r.decision, 'Offline lifecycle model; no transaction authority.', ...Object.entries(r.participants).map(([id, p]) => `${id}: expected ${p.expectedNetUSDC}; worst ${p.worstModeledNetUSDC}; conservative exposure ${p.conservativeExposureUSDC} USDC`), ...r.failures, ...r.limitations].join('\n'); }
if (require.main === module) {
  try {
    const args = process.argv.slice(2); requireThat(args.length >= 1 && args.length <= 2 && (args.length === 1 || args[1] === '--json'), 'Usage: node scripts/economics/lifecycle.cjs <file|--example> [--json]');
    const file = args[0] === '--example' ? path.join(__dirname, 'lifecycle-example.json') : args[0];
    requireThat(fs.statSync(file).isFile() && fs.statSync(file).size <= 1048576, 'Use a regular JSON file of at most 1 MiB.');
    const r = lifecycle(JSON.parse(fs.readFileSync(file, 'utf8'))); console.log(args[1] === '--json' ? JSON.stringify(r, null, 2) : render(r)); process.exitCode = r.failures.length ? 2 : 0;
  } catch (e) { console.error(String(e.message).replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')); process.exitCode = 1; }
}
module.exports = { lifecycle, shape, text, uint, money, weighted, requireThat };
