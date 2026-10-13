// This test travels with the editable engine and needs only Node, not npm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMission } from '../../site/assets/successor/missions.mjs';
import { recordPlan, createSystem, runCandidate, chooseCandidate, compareCandidates, exportCapsule, inspectCapsule, restoreCapsule } from '../../site/assets/successor/model.mjs';
import { prepareImprovement, validateImprovement } from '../../site/assets/successor/jobs.mjs';

for (const kind of ['analyst', 'website']) test(`portable ${kind}: work, gap, draft, improve, choose, restore, rerun, rollback`, async () => {
  let state = await createSystem(defaultMission(kind, 'en'));
  let result = await runCandidate(state, 'baseline', '0'.repeat(64));
  const original = result.candidate;
  assert.equal(original.checker.passed, true);
  assert.ok(original.gaps.length > 0);
  state = await chooseCandidate(result.state, original.id, 'keep');
  const plan = await prepareImprovement(state, { budget: '100', repairReserve: '20', days: '7', inputURLs: '', requested: '' });
  await validateImprovement(plan); state = await recordPlan(state, plan);
  assert.equal(plan.currency.symbol, 'USDC');
  result = await runCandidate(state, 'improved', '0'.repeat(64));
  assert.equal(compareCandidates(original, result.candidate).outcome, 'improvement');
  assert.equal(result.state.active, original.id, 'execution cannot select a version');
  state = await chooseCandidate(result.state, result.candidate.id, 'replace');
  const source = { repository: 'MontrealAI/AGIJobManager', commit: '0'.repeat(40), engineSha256: '0'.repeat(64), files: [], license: 'MIT' };
  const inspection = await inspectCapsule(await exportCapsule(state, source));
  await assert.rejects(restoreCapsule(inspection, false));
  const restored = await restoreCapsule(inspection, true);
  assert.equal(restored.authority, 'none');
  const rerun = await runCandidate(restored, 'improved', '0'.repeat(64));
  assert.deepEqual(rerun.candidate.files, result.candidate.files);
  state = await chooseCandidate(rerun.state, original.id, 'rollback');
  assert.equal(state.active, original.id);
});
