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

test('report row associations, exact columns, completeness and closed visible presentation reject planted defects', async () => {
  const {executeMission}=await import('../../site/assets/successor/missions.mjs');
  const {checkArtifacts}=await import('../../site/assets/successor/checker.mjs');
  const mission=defaultMission();mission.input='id,category,value\na,Alpha,100\nb,Beta,900';
  const original=executeMission(mission).files;
  assert.deepEqual(JSON.parse(original.find(f=>f.name==='result.json').content).groups,[{category:'Alpha',count:1,total:'100',min:'100',max:'100'},{category:'Beta',count:1,total:'900',min:'900',max:'900'}]);
  for(const mutate of [html=>html.replace('<td>Alpha</td>','<td>Beta</td>').replace('<td>Beta</td></tr>','<td>Alpha</td></tr>'),html=>html.replace('<tbody>','<tbody style="display:none">'),html=>html.replace('<thead>','<thead hidden>'),html=>html.replace('Total</th>','Minimum</th>'),html=>html.replace('<td>100</td>','<td>900</td>'),html=>html.replace('<body>','<body class="skip">'),html=>html.replace('</tbody>','<tr><td>extra</td></tr></tbody>'),html=>html.replace('lang="en"','lang="fr"'),html=>html.replace('border-collapse:collapse','display:none'),html=>html.replace(/<tr><td>Alpha[\s\S]*?<\/tr>/,'')]) {
    const files=structuredClone(original);files.find(f=>f.name==='report.html').content=mutate(files.find(f=>f.name==='report.html').content);
    assert.equal(checkArtifacts(mission,'baseline',files).passed,false);
  }
  assert.equal(checkArtifacts(mission,'baseline',original).assurance.businessCriteria,'not-evaluated');
});
test('explicit reuse after fresh restore retains method and lineage but no old result, plan, authority or verdict', async () => {
  const {reuseSystem,selectedMethod,validateState}=await import('../../site/assets/successor/model.mjs');
  const mission=defaultMission();mission.input='id,category,value\na,Software,1200.5\nb,Software,-100.5\nc,Research,1000\nc,Research,1000\nd,Documentation,300';
  let run=await runCandidate(await createSystem(mission),'baseline','0'.repeat(64));let state=await chooseCandidate(run.state,run.candidate.id,'keep');
  run=await runCandidate(state,'improved','0'.repeat(64));state=await chooseCandidate(run.state,run.candidate.id,'replace');
  state=await restoreCapsule(await inspectCapsule(await exportCapsule(state)),true);
  const nextMission={...mission,input:'id,category,value\na,Software,1400\nb,Software,-50\nc,Research,920.10\nc,Research,920.10\nd,Documentation,250'};
  await assert.rejects(reuseSystem(state,nextMission,false),{code:'REUSE_CONFIRMATION'});
  const next=await reuseSystem(state,nextMission,true);assert.equal(selectedMethod(next.state),'improved');assert.equal(next.state.active,null);assert.deepEqual(next.state.candidates,[]);assert.deepEqual(next.state.plans,[]);assert.equal(next.state.authority,'none');
  assert.equal(JSON.parse(next.state.chronicle[1].subject).parentCapsuleSha256,JSON.parse(next.parentCapsule).sha256);
  run=await runCandidate(next.state,selectedMethod(next.state),'0'.repeat(64));const result=JSON.parse(run.candidate.files.find(f=>f.name==='result.json').content);
  assert.deepEqual(result.groups.map(g=>g.total),['250','920.1','1350']);assert.equal(result.policy,'identical-id-once');assert.equal(run.state.active,null);await validateState(run.state);
  await assert.rejects(reuseSystem(state,{...nextMission,input:'id,category,value\na,A,1\na,A,2'},true).then(next=>runCandidate(next.state,selectedMethod(next.state),'0'.repeat(64))),{code:'DUPLICATE_CONFLICT'});
});
test('legacy capsule retains original bytes and assurance; explicit new-data reuse uses engine 2', async () => {
  const {freezeCandidate,appendEvent,reuseSystem,selectedMethod}=await import('../../site/assets/successor/model.mjs');
  const mission=defaultMission();let state=await createSystem(mission);state.engine='successor-local/1';
  const candidate=await freezeCandidate(mission,'improved','0'.repeat(64),'successor-local/1');state.candidates.push(candidate);await appendEvent(state,'candidate-checked',candidate.id);state=await chooseCandidate(state,candidate.id,'keep');
  const capsule=await exportCapsule(state);const restored=await restoreCapsule(await inspectCapsule(capsule),true);assert.deepEqual(restored.candidates[0].files,candidate.files);assert.equal(restored.candidates[0].checker.implementation,'successor-checker/1');
  const next=await reuseSystem(restored,{...mission,input:'id,category,value\na,A,0.1\nb,A,0.2'},true);assert.equal(next.state.engine,'successor-local/2');assert.equal(selectedMethod(next.state),'improved');
});
test('explicit mapping preserves decimal text and rejects ambiguous values, reused columns and conflicts', async () => {
  const {previewMapping}=await import('../../site/assets/successor/mapping.mjs');
  const mapping={id:'order_id',category:'product',value:'amount'}, raw='order_id,product,amount\na,"Tools, public",-12.050001\nb,Research,100000000001.999999';
  const result=await previewMapping(raw,mapping);assert.equal(result.preview[0].value,'-12.050001');assert.equal(result.receipt.decimalFormat,'dot-decimal-text');assert.equal(result.receipt.mapping.value,'amount');
  for(const bad of ['[{"order_id":"a","product":"A","amount":12.5}]','order_id,product,amount\na,A,"1,000"','order_id,product,amount\na,A,1e3'])await assert.rejects(previewMapping(bad,mapping));
  await assert.rejects(previewMapping(raw,{...mapping,value:'product'}));
});
