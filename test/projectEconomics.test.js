const assert = require('node:assert/strict');
const { projectEconomics } = require('../scripts/economics/project-economics.cjs');
const sample = () => structuredClone(require('../examples/project-economics-100.json'));
describe('Whole-project participant cash economics', function () {
  it('keeps advisory authority and exact participant cash separate', () => {
    const p = sample(), before = JSON.stringify(p), r = projectEconomics(p);
    assert.equal(r.authorization, 'NONE'); assert.equal(r.meetsDeclaredLimits, true);
    assert.equal(r.participants[0].expectedNetUSDC, '32.200000');
    assert.equal(r.participants[1].expectedNetUSDC, '0.366666');
    assert.equal(r.participants[1].lossProbabilityBps, 1000);
    assert.equal(JSON.stringify(p), before);
  });
  it('rejects high priced projects with positive Node means but frequent losses', () => {
    const r = projectEconomics(require('../examples/project-economics-10000.json'));
    const node = r.participants.find(x => x.id === 'node-1');
    assert(Number(node.expectedNetUSDC) > 0); assert.equal(node.lossProbabilityBps, 6500);
    assert(r.reasons.some(x => x.participant === node.id && x.code === 'LOSS_PROBABILITY'));
  });
  it('includes spent work without inventing intermediate compensation', () => {
    const r = projectEconomics(require('../examples/project-economics-1000.json'));
    assert.equal(r.scenarios.find(x => x.id === 'final-rejected').netUSDCByParticipant['node-1'], '-24.000000');
  });
  it('reserves every stage without reusing hoped-for receipts', () => {
    const p = sample(); p.participants[0].availableCapitalUSDC = '11.999999';
    assert(projectEconomics(p).reasons.some(x => x.code === 'CAPITAL_RESERVE'));
  });
  it('subtracts deposits and counts their return only when included in cash receipts', () => {
    const p = sample(); p.stages[0].depositUSDC = '5'; p.participants[0].availableCapitalUSDC = '17';
    assert.equal(projectEconomics(p).participants[0].expectedNetUSDC, '27.200000');
    p.scenarios[0].stages[0].receiptsUSDC = '57';
    assert.equal(projectEconomics(p).participants[0].expectedNetUSDC, '31.450000');
  });
  for (const [name, mutate, code] of [
    ['missing outcome row', p => p.scenarios[1].stages.pop(), 'COMPLETE_SCENARIO'],
    ['missing probability mass', p => p.scenarios[0].probabilityBps--, 'PROBABILITY_TOTAL'],
    ['duplicate outcome', p => p.scenarios[1].id = p.scenarios[0].id, 'SCENARIO'],
    ['duplicate row', p => p.scenarios[0].stages[1] = p.scenarios[0].stages[0], 'SCENARIO_STAGE'],
    ['cost overrun', p => p.scenarios[0].stages[0].costUSDC = '12.000001', 'COST_RESERVE'],
    ['cash from unstarted work', p => p.scenarios[2].stages[1].receiptsUSDC = '1', 'UNSTARTED_CASH'],
    ['executing a failed dependency', p => { p.scenarios[2].stages[1].status = 'complete'; }, 'FAILED_DEPENDENCY'],
    ['cycle', p => p.stages[0].dependencies.push(p.stages[1].id), 'CYCLE'],
    ['unknown participant', p => p.stages[0].participant = 'other', 'STAGE'],
    ['binary floating point cash', p => p.stages[0].costReserveUSDC = 12.01, 'MONEY'],
    ['claiming observation', p => p.measurementKind = 'observed', 'SCHEMA'],
    ['unsupported retainer field', p => p.retainerUSDC = '10', 'FIELDS'],
    ['optimistic-only scenarios', p => { for (const s of p.scenarios) for (const r of s.stages) r.status = 'complete'; }, 'ADVERSE_SCENARIO_REQUIRED'],
  ]) it('rejects ' + name, () => { const p = sample(); mutate(p); assert.throws(() => projectEconomics(p), new RegExp(code)); });
  it('rounds a negative sub-micro expected net conservatively', () => {
    const p = sample();
    for (const s of p.scenarios) for (const r of s.stages) { r.receiptsUSDC = '0'; r.costUSDC = '0'; }
    p.scenarios[2].stages[0].costUSDC = '0.000001';
    assert.equal(projectEconomics(p).participants[0].expectedNetUSDC, '-0.000001');
  });
});
