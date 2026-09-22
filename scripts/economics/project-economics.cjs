'use strict';
// Advisory scenario accounting only: no wallet, network, admission or settlement.
const fs = require('node:fs');
const { digest } = require('./computer-work.cjs');
const need = (v, c) => { if (!v) throw Error('PROJECT_ECONOMICS_' + c); };
const exact = (x, keys) => need(x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join('|') === [...keys].sort().join('|'), 'FIELDS');
const int = (x, min, max) => Number.isSafeInteger(x) && x >= min && x <= max;
const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(x);
const money = x => {
  need(typeof x === 'string' && /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/.test(x), 'MONEY');
  const [a, b = ''] = x.split('.');
  return BigInt(a) * 1000000n + BigInt(b.padEnd(6, '0'));
};
const text = x => {
  const a = x < 0n ? -x : x;
  return `${x < 0n ? '-' : ''}${a / 1000000n}.${(a % 1000000n).toString().padStart(6, '0')}`;
};
// Round expected net down, including negative fractions of a micro-USDC.
const floorMean = x => x >= 0n ? x / 10000n : -((-x + 9999n) / 10000n);
function projectEconomics(p) {
  exact(p, ['schema', 'measurementKind', 'jobPriceUSDC', 'participants', 'stages', 'scenarios']);
  need(p.schema === 'agi-project-economics/v1' && p.measurementKind === 'assumptions', 'SCHEMA');
  money(p.jobPriceUSDC);
  need(Array.isArray(p.participants) && p.participants.length >= 2 && p.participants.length <= 256, 'PARTICIPANTS');
  const actors = new Map();
  for (const a of p.participants) {
    exact(a, ['id', 'role', 'availableCapitalUSDC', 'minimumExpectedNetUSDC', 'maximumLossProbabilityBps', 'maximumScenarioLossUSDC']);
    need(id(a.id) && !actors.has(a.id) && ['agent', 'reviewer'].includes(a.role), 'PARTICIPANT');
    need(int(a.maximumLossProbabilityBps, 0, 10000), 'LOSS_PROBABILITY');
    for (const k of ['availableCapitalUSDC', 'minimumExpectedNetUSDC', 'maximumScenarioLossUSDC']) money(a[k]);
    actors.set(a.id, a);
  }
  need(['agent', 'reviewer'].every(role => [...actors.values()].some(a => a.role === role)), 'ROLES');
  need(Array.isArray(p.stages) && p.stages.length > 0 && p.stages.length <= 64, 'STAGES');
  const stages = new Map(), reserves = new Map([...actors.keys()].map(k => [k, 0n]));
  for (const s of p.stages) {
    exact(s, ['id', 'participant', 'dependencies', 'costReserveUSDC', 'depositUSDC']);
    need(id(s.id) && !stages.has(s.id) && actors.has(s.participant), 'STAGE');
    need(Array.isArray(s.dependencies) && new Set(s.dependencies).size === s.dependencies.length, 'DEPENDENCIES');
    reserves.set(s.participant, reserves.get(s.participant) + money(s.costReserveUSDC) + money(s.depositUSDC));
    stages.set(s.id, s);
  }
  for (const s of stages.values()) need(s.dependencies.every(d => stages.has(d) && d !== s.id), 'DEPENDENCY');
  need([...actors.keys()].every(a => p.stages.some(s => s.participant === a)), 'UNUSED_PARTICIPANT');
  const order = [], visited = new Set();
  while (order.length < stages.size) {
    const ready = p.stages.filter(s => !visited.has(s.id) && s.dependencies.every(d => visited.has(d)));
    need(ready.length > 0, 'CYCLE');
    for (const s of ready) { order.push(s); visited.add(s.id); }
  }
  need(Array.isArray(p.scenarios) && p.scenarios.length >= 2 && p.scenarios.length <= 256, 'SCENARIOS');
  const seen = new Set(), stats = new Map([...actors.keys()].map(k => [k, { weightedNet: 0n, lossBps: 0, worstLoss: 0n }]));
  let weight = 0, hasAdverse = false;
  const scenarios = [];
  for (const s of p.scenarios) {
    exact(s, ['id', 'probabilityBps', 'stages']);
    need(id(s.id) && !seen.has(s.id) && int(s.probabilityBps, 1, 9999), 'SCENARIO');
    seen.add(s.id); weight += s.probabilityBps;
    need(Array.isArray(s.stages) && s.stages.length === stages.size, 'COMPLETE_SCENARIO');
    const rows = new Map(), net = new Map([...actors.keys()].map(k => [k, 0n]));
    for (const r of s.stages) {
      exact(r, ['id', 'status', 'costUSDC', 'receiptsUSDC']);
      need(stages.has(r.id) && !rows.has(r.id) && ['complete', 'failed', 'not-started'].includes(r.status), 'SCENARIO_STAGE');
      const stage = stages.get(r.id), cost = money(r.costUSDC), receipts = money(r.receiptsUSDC);
      need(cost <= money(stage.costReserveUSDC), 'COST_RESERVE');
      need(r.status !== 'not-started' || (cost === 0n && receipts === 0n), 'UNSTARTED_CASH');
      const amount = receipts - cost - (r.status === 'not-started' ? 0n : money(stage.depositUSDC));
      net.set(stage.participant, net.get(stage.participant) + amount);
      rows.set(r.id, r);
      if (r.status === 'failed') hasAdverse = true;
    }
    for (const stage of order) if (rows.get(stage.id).status !== 'not-started')
      need(stage.dependencies.every(d => rows.get(d).status === 'complete'), 'FAILED_DEPENDENCY');
    const result = {};
    for (const [a, amount] of net) {
      const stat = stats.get(a);
      stat.weightedNet += amount * BigInt(s.probabilityBps);
      if (amount < 0n) { stat.lossBps += s.probabilityBps; stat.worstLoss = stat.worstLoss > -amount ? stat.worstLoss : -amount; }
      result[a] = text(amount);
    }
    scenarios.push({ id: s.id, probabilityBps: s.probabilityBps, netUSDCByParticipant: result });
  }
  need(weight === 10000, 'PROBABILITY_TOTAL');
  need(hasAdverse, 'ADVERSE_SCENARIO_REQUIRED');
  const reasons = [], participants = [];
  for (const [id, a] of actors) {
    const stat = stats.get(id), reserve = reserves.get(id), expected = floorMean(stat.weightedNet);
    const reject = code => reasons.push({ participant: id, code });
    if (reserve > money(a.availableCapitalUSDC)) reject('CAPITAL_RESERVE');
    if (stat.weightedNet < money(a.minimumExpectedNetUSDC) * 10000n) reject('EXPECTED_NET');
    if (stat.lossBps > a.maximumLossProbabilityBps) reject('LOSS_PROBABILITY');
    if (stat.worstLoss > money(a.maximumScenarioLossUSDC)) reject('SCENARIO_LOSS');
    participants.push({ id, role: a.role, reservedCapitalUSDC: text(reserve), expectedNetUSDC: text(expected), lossProbabilityBps: stat.lossBps, worstScenarioLossUSDC: text(stat.worstLoss) });
  }
  return {
    schema: 'agi-project-economics-report/v1', planSha256: digest(p), measurementKind: 'assumptions', authorization: 'NONE',
    meetsDeclaredLimits: reasons.length === 0, reasons, participants, scenarios,
    limitations: 'Advisory assumptions, not qualification or expected buyer value. Probabilities are supplied, not estimated. Scenarios must cover all material outcomes; completeness cannot be proven here. Receipts mean actual cash, including returned deposits; never count escrow or uncollected claims. Reserve all stages without recycling proceeds. Include gas, failed attempts and overhead in costs. No intermediate payment, retainer, grant, transaction or project settlement is created. Use independent observed outcomes and actual bills before expanding intake.'
  };
}
if (require.main === module) {
  try {
    need(process.argv.length === 3, 'USAGE: project-economics.cjs plan.json');
    const f = process.argv[2], stat = fs.lstatSync(f);
    need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 8 * 1024 * 1024, 'FILE');
    const r = projectEconomics(JSON.parse(fs.readFileSync(f, 'utf8')));
    console.log(JSON.stringify(r, null, 2));
    if (!r.meetsDeclaredLimits) process.exitCode = 2;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { projectEconomics };
