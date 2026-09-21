'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { assess } = require('./assess.cjs');
const { parseUSDC, formatUSDC } = require('../lib/usdc.js');
const OUTCOMES = ['agentWin', 'buyerWin', 'buyerAcceptance', 'neutralTimeout'];
const PARTIES = ['employer', 'agent', 'eachApprovingReviewer', 'eachRejectingReviewer'];
const TERMS = ['jobCostUSDC', 'agentBondUSDC', 'reviewerBondUSDC', 'disputeBondUSDC', 'disputeInitiator', 'rewardPercentage', 'slashBps', 'approvals', 'rejections'];
const SCALE = 1000000n;

function shape(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) throw new Error(`${label} must contain exactly: ${keys.join(', ')}.`);
}
function note(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000 || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) throw new Error(`${label} must be nonempty, single-line text of at most 2000 characters without control characters.`);
}
function amount(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be an exact nonnegative USDC decimal string.`);
  try { return BigInt(parseUSDC(value)); } catch (error) { throw new Error(`${label}: ${error.message}`); }
}
function signed(value) {
  return value.startsWith('-') ? -BigInt(parseUSDC(value.slice(1))) : BigInt(parseUSDC(value));
}
function expectedDecimal(numerator) {
  const magnitude = numerator < 0n ? -numerator : numerator;
  const fraction = (magnitude % (SCALE * SCALE)).toString().padStart(12, '0').replace(/0+$/, '');
  return `${numerator < 0n ? '-' : ''}${magnitude / (SCALE * SCALE)}${fraction ? '.' + fraction : ''}`;
}

function screen(input) {
  shape(input, ['schemaVersion', 'scope', 'assumptionSource', 'terms', 'policy', 'outcomes'], 'Screen');
  if (input.schemaVersion !== 1 || input.scope !== 'submitted-work-fixed-votes') throw new Error('Expected schemaVersion 1 and scope submitted-work-fixed-votes.');
  note(input.assumptionSource, 'assumptionSource');
  shape(input.terms, TERMS, 'terms');
  shape(input.policy, PARTIES, 'policy');
  const limits = {};
  for (const party of PARTIES) {
    shape(input.policy[party], ['minimumExpectedNetUSDC', 'maximumScenarioLossUSDC'], `policy.${party}`);
    limits[party] = Object.fromEntries(Object.entries(input.policy[party]).map(([key, value]) => [key, amount(value, `${party}.${key}`)]));
  }
  shape(input.outcomes, OUTCOMES, 'outcomes');
  const base = { ...input.terms, assumptionSource: input.assumptionSource, agentCostUSDC: '0', reviewerCostUSDC: '0' };
  const settlement = assess(base);
  const totals = Object.fromEntries(PARTIES.map(party => [party, { weightedNet: 0n, worstNet: null, lossWeightPpm: 0 }]));
  const counts = { employer: 1, agent: 1, eachApprovingReviewer: input.terms.approvals, eachRejectingReviewer: input.terms.rejections };
  const outcomes = {};
  let weightSum = 0;
  for (const name of OUTCOMES) {
    const row = input.outcomes[name];
    shape(row, ['weightPpm', 'rationale', 'employerValueUSDC', 'employerCostUSDC', 'agentCostUSDC', 'eachReviewerCostUSDC'], `outcomes.${name}`);
    if (!Number.isSafeInteger(row.weightPpm) || row.weightPpm < 0 || row.weightPpm > 1000000) throw new Error(`${name}.weightPpm must be an integer from 0 to 1000000.`);
    note(row.rationale, `${name}.rationale`);
    for (const key of ['employerValueUSDC', 'employerCostUSDC', 'agentCostUSDC', 'eachReviewerCostUSDC']) amount(row[key], `${name}.${key}`);
    weightSum += row.weightPpm;
    const s = assess({ ...base, agentCostUSDC: row.agentCostUSDC, reviewerCostUSDC: row.eachReviewerCostUSDC }).scenarios[name];
    if (!s.modeled) {
      if (row.weightPpm !== 0) throw new Error(`${name} is unavailable with a posted dispute bond; its weight must be zero.`);
      outcomes[name] = { ...s, weightPpm: 0 };
      continue;
    }
    const nets = {
      employer: signed(s.buyerCashChangeUSDC) + amount(row.employerValueUSDC, 'employerValueUSDC') - amount(row.employerCostUSDC, 'employerCostUSDC'),
      agent: signed(s.agentNetAfterAssumedCostUSDC),
      eachApprovingReviewer: counts.eachApprovingReviewer ? signed(s.approvingReviewers.eachNetAfterAssumedCostUSDC) : null,
      eachRejectingReviewer: counts.eachRejectingReviewer ? signed(s.rejectingReviewers.eachNetAfterAssumedCostUSDC) : null,
    };
    for (const party of PARTIES) {
      if (!counts[party]) continue;
      const net = nets[party], total = totals[party];
      total.weightedNet += net * BigInt(row.weightPpm);
      // Zero assumed probability must not remove a modeled loss from stress limits.
      if (total.worstNet === null || net < total.worstNet) total.worstNet = net;
      if (net < 0n) total.lossWeightPpm += row.weightPpm;
    }
    outcomes[name] = { weightPpm: row.weightPpm, netUSDC: Object.fromEntries(PARTIES.map(party => [party, nets[party] === null ? null : formatUSDC(nets[party])])), settlement: s };
  }
  if (weightSum !== 1000000) throw new Error('Outcome weights must sum to exactly 1000000 ppm.');
  const parties = {}, failures = [];
  for (const party of PARTIES) {
    if (!counts[party]) { parties[party] = { applicable: false, count: 0 }; continue; }
    const total = totals[party], limit = limits[party], loss = total.worstNet < 0n ? -total.worstNet : 0n;
    const expectedMarginMet = total.weightedNet >= limit.minimumExpectedNetUSDC * SCALE;
    const scenarioLossWithinLimit = loss <= limit.maximumScenarioLossUSDC;
    parties[party] = { applicable: true, count: counts[party], expectedNetUSDC: expectedDecimal(total.weightedNet), worstModeledNetUSDC: formatUSDC(total.worstNet), maximumModeledLossUSDC: formatUSDC(loss), assumedLossWeightPpm: total.lossWeightPpm, expectedMarginMet, scenarioLossWithinLimit };
    if (!expectedMarginMet) failures.push(`${party}: expected net is below the supplied minimum.`);
    if (!scenarioLossWithinLimit) failures.push(`${party}: a modeled outcome exceeds the supplied loss limit.`);
  }
  return {
    schemaVersion: 1, scope: input.scope, decision: failures.length ? 'OUTSIDE_SUPPLIED_LIMITS' : 'WITHIN_SUPPLIED_LIMITS',
    authorization: 'NONE — an offline conditional screen, not permission to post, accept, vote or move funds.',
    assumptionSource: input.assumptionSource, inputs: JSON.parse(JSON.stringify(input)),
    totalDepositedIncludingBondsUSDC: settlement.totalDepositedIncludingBondsUSDC,
    parties, failures, outcomes,
    limitations: [
      'Weights, costs, employer value and risk limits are supplied assumptions, not verified probabilities, measured savings, live prices or guaranteed profit.',
      'Conditional on submitted work and the specified fixed vote split. No-submission expiry, cancellation, different reviewer counts/votes, unbounded delays, token failure, compromised keys and systemic losses are outside this screen. It is not a complete job-admission system.',
      'Worst modeled loss includes every available counterfactual even at zero weight. Loss weights are conditional assumptions; no statistical confidence is inferred.',
      'All-in costs must include acquisition, revisions, failed work, inference, gas, human handling, infrastructure, capital carrying cost and relevant taxes. Costs apply per outcome; one reviewer cost applies to each participating reviewer.',
      'Employer value is the incremental value of the usable artifact relative to the best alternative; it is not inferred from price, receipts or a model assertion.',
      'Returned own collateral is not earnings. Receipts include deferred claims and do not prove payment liquidity. Settlement-wallet allocations are not participant revenue unless common ownership is modeled separately.',
      'No independence, authority, chain settings, settlement eligibility, evidence completeness, live demand, portfolio exposure or provider entitlement is checked. Existing obligations still require their agreed settlement and recovery.',
    ],
  };
}

function render(report) {
  const lines = [report.decision, report.authorization, `Assumptions: ${report.assumptionSource}`, `Scope: ${report.scope}`, `Deposited including bonds: ${report.totalDepositedIncludingBondsUSDC} USDC`, ''];
  for (const [party, p] of Object.entries(report.parties)) {
    lines.push(p.applicable ? `${party} (${p.count}): expected net ${p.expectedNetUSDC} USDC; worst modeled net ${p.worstModeledNetUSDC}; assumed loss weight ${p.assumedLossWeightPpm}/1000000.` : `${party}: no participants in this vote split.`);
  }
  lines.push('', ...report.failures, '', ...report.limitations.map(value => `Limit: ${value}`));
  return lines.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const usage = 'Usage: node scripts/economics/screen.cjs <screen.json|--example> [--json]\nExit 0: within supplied limits; 2: outside limits; 1: invalid input. No exit code authorizes a transaction.';
  if (args.length === 1 && args[0] === '--help') console.log(usage);
  else {
    try {
      if (args.length < 1 || args.length > 2 || (args.length === 2 && args[1] !== '--json') || (args[0].startsWith('--') && args[0] !== '--example')) throw new Error(usage);
      const file = args[0] === '--example' ? path.join(__dirname, 'screen-example.json') : path.resolve(args[0]);
      if (!fs.statSync(file).isFile() || fs.statSync(file).size > 1024 * 1024) throw new Error('Input must be a regular JSON file no larger than 1 MiB.');
      const report = screen(JSON.parse(fs.readFileSync(file, 'utf8')));
      console.log(args[1] === '--json' ? JSON.stringify(report, null, 2) : render(report));
      process.exitCode = report.failures.length ? 2 : 0;
    } catch (error) { console.error(`Economic screening failed: ${String(error.message).replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')}`); process.exitCode = 1; }
  }
}

module.exports = { screen, render };
