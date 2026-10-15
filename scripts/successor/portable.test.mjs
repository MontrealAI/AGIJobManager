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
  for(const mutate of [html=>html.replace('<td>Alpha</td>','<td>Beta</td>').replace('<td>Beta</td></tr>','<td>Alpha</td></tr>'),html=>html.replace('<tbody>','<tbody style="display:none">'),html=>html.replace('<thead>','<thead hidden>'),html=>html.replace('Total</th>','Minimum</th>'),html=>html.replace('<td>100</td>','<td>900</td>'),html=>html.replace('<body>','<body class="skip">'),html=>html.replace('<main>','<div class="skip"><main>').replace('</main>','</main></div>'),html=>html.replace('<body>','<body><html class="skip">'),html=>html.replace('<main>','<DIV class="skip"><main>').replace('</main>','</main></DIV>'),html=>html.replace('<main>','<title><main>').replace('</main>','</main></title>'),html=>html.replace('<main>','<p><main>').replace('</main>','</main></p>'),html=>html.replace('<table>','<style><table>').replace('</table>','</table></style>'),html=>html.replace('<head>','<head>unapproved structural text'),html=>html.replace('<head>','<head>\u00a0'),html=>html.replace('<head>','<head>\u2003'),html=>html.replace('<head>','<head>\ufeff'),html=>html.replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/,'<meta charset="utf-8">').replace('<head>',"<head>default-src 'none'; form-action 'none'"),html=>html.replace('</tbody>','<tr><td>extra</td></tr></tbody>'),html=>html.replace('lang="en"','lang="fr"'),html=>html.replace('border-collapse:collapse','display:none'),html=>html.replace(/<tr><td>Alpha[\s\S]*?<\/tr>/,'')]) {
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

for (const count of [98, 99, 100]) test(`history ${count}: exact restore, preserved checkpoint, explicit continuation and fresh rerun`, async () => {
  const {appendEvent,continueHistory,historyEvents,validateState}=await import('../../site/assets/successor/model.mjs');
  let run=await runCandidate(await createSystem(defaultMission()),'baseline','0'.repeat(64));
  let state=await chooseCandidate(run.state,run.candidate.id,'keep');
  const plan=await prepareImprovement(state,{budget:'100'});state=await recordPlan(state,plan);
  run=await runCandidate(state,'improved','0'.repeat(64));state=await chooseCandidate(run.state,run.candidate.id,'replace');
  while(state.chronicle.length<count) await appendEvent(state,'restored','0'.repeat(64));
  const raw=await exportCapsule(state), inspected=await inspectCapsule(raw), restored=await restoreCapsule(inspected,true);
  assert.deepEqual(restored,state,'restore must not consume a history slot or change committed work');assert.deepEqual(JSON.parse(await exportCapsule(restored)),JSON.parse(raw));
  if(count===100) await assert.rejects(runCandidate(restored,'improved','0'.repeat(64)),{code:'HISTORY_LIMIT'});
  else assert.equal((await runCandidate(restored,'improved','0'.repeat(64))).state.chronicle.length,count+1);
  await assert.rejects(continueHistory(restored,false),{code:'HISTORY_CONFIRMATION'});
  const continued=await continueHistory(restored,true);assert.deepEqual(JSON.parse(continued.checkpoint),JSON.parse(raw));assert.deepEqual(historyEvents(continued.state).slice(0,count),state.chronicle);
  assert.deepEqual(continued.state.candidates,state.candidates);assert.deepEqual(continued.state.plans,state.plans);assert.equal(continued.state.active,state.active);assert.equal(continued.state.authority,'none');
  const capsule=await inspectCapsule(await exportCapsule(continued.state));assert.equal(capsule.capsule.format,'successor-portable/2');
  run=await runCandidate(await restoreCapsule(capsule,true),'improved','0'.repeat(64));
  const rolled=await chooseCandidate(run.state,state.candidates[0].id,'rollback');assert.equal(rolled.active,state.candidates[0].id);await validateState(rolled);
});

test('history archive corruption, truncation, cross-segment chain, schema mismatch and overflow are rejected', async () => {
  const {appendEvent,continueHistory,validateState}=await import('../../site/assets/successor/model.mjs');
  const {sha256}=await import('../../site/assets/successor/safe.mjs');
  let state=await createSystem(defaultMission());while(state.chronicle.length<100) await appendEvent(state,'restored','0'.repeat(64));
  const overflow=structuredClone(state);const record={sequence:100,action:'restored',subject:'0'.repeat(64),previous:state.chronicle.at(-1).sha256};overflow.chronicle.push({...record,sha256:await sha256(record)});await assert.rejects(validateState(overflow),{code:'CHRONICLE'});
  state=(await continueHistory(state,true)).state;
  for(const mutation of [s=>s.archives[0].events[0].subject='1'.repeat(64),s=>s.archives[0].events.pop(),s=>s.archives[0].start=1,s=>s.chronicle[0].previous='0'.repeat(64),s=>s.chronicle[0].subject='0'.repeat(64),s=>s.schema='agijobmanager/successor-capsule/v1',s=>s.authority='restored']) {const bad=structuredClone(state);mutation(bad);await assert.rejects(validateState(bad));}
  const capsule=JSON.parse(await exportCapsule(state));capsule.format='successor-portable/1';await assert.rejects(inspectCapsule(JSON.stringify(capsule)),{code:'VERSION'});
  const tamper=structuredClone(state);tamper.archives[0].events.pop();tamper.archives[0].sha256=await sha256({start:0,events:tamper.archives[0].events});await assert.rejects(validateState(tamper),{code:'CHRONICLE_CHAIN'});
});

test('all ten history archives remain readable and exportable when continuation reaches its finite bound', async () => {
  const {appendEvent,continueHistory,historyEvents}=await import('../../site/assets/successor/model.mjs');
  let state=await createSystem(defaultMission());
  for(let segment=0;segment<10;segment++){while(state.chronicle.length<100) await appendEvent(state,'restored','0'.repeat(64));state=(await continueHistory(state,true)).state;}
  while(state.chronicle.length<100) await appendEvent(state,'restored','0'.repeat(64));
  assert.equal(historyEvents(state).length,1100);const raw=await exportCapsule(state), restored=await restoreCapsule(await inspectCapsule(raw),true);assert.deepEqual(restored,state);
  await assert.rejects(continueHistory(state,true),{code:'HISTORY_ARCHIVE_LIMIT'});assert.equal(await exportCapsule(state),raw);
});

test('candidate and plan bounds block only new entries and preserve read-only recovery', async () => {
  const {validateState}=await import('../../site/assets/successor/model.mjs');
  let state=await createSystem(defaultMission());
  for(let i=0;i<12;i++)state=(await runCandidate(state,'baseline',i.toString(16).padStart(64,'0'))).state;
  const rerun=await runCandidate(state,'baseline','0'.repeat(64));assert.equal(rerun.state.candidates.length,12);
  await assert.rejects(runCandidate(state,'baseline','f'.repeat(64)),{code:'CANDIDATE_LIMIT'});
  state=await chooseCandidate(state,state.candidates[0].id,'keep');
  for(let i=0;i<12;i++)state=await recordPlan(state,await prepareImprovement(state,{budget:String(100+i)}));
  const same=await recordPlan(state,state.plans[0]);assert.equal(same.plans.length,12);
  await assert.rejects(recordPlan(state,await prepareImprovement(state,{budget:'200'})),{code:'PLAN_LIMIT'});
  await validateState(await restoreCapsule(await inspectCapsule(await exportCapsule(state)),true));
});

test('serialized byte boundary exports compact valid work instead of an oversized pretty capsule', async () => {
  const {canonical,sha256,LIMITS}=await import('../../site/assets/successor/safe.mjs');
  const mission=defaultMission();mission.input='id,category,value\n'+Array.from({length:1000},(_,i)=>'row'+i+','+('Category '+i).padEnd(79,'x')+',1').join('\n');
  let state=await createSystem(mission);for(let i=0;i<11;i++)state=(await runCandidate(state,'baseline',i.toString(16).padStart(64,'0'))).state;
  const payload={state,sourceManifest:null},capsule={format:'successor-portable/1',payload,sha256:await sha256(payload)};
  assert.ok(new TextEncoder().encode(canonical(capsule)).length<LIMITS.capsule);assert.ok(new TextEncoder().encode(JSON.stringify(capsule,null,2)).length>LIMITS.capsule);
  const raw=await exportCapsule(state);assert.ok(new TextEncoder().encode(raw).length<=LIMITS.capsule);assert.deepEqual((await inspectCapsule(raw)).capsule.payload.state,state);
  await assert.rejects(inspectCapsule(raw+' '.repeat(LIMITS.capsule)),{code:'INPUT_SIZE'});
  await assert.rejects(runCandidate(state,'baseline','b'.repeat(64)),{code:'CAPSULE_CAPACITY'});assert.equal(await exportCapsule(state),raw,'rejected overflow must leave earlier work exportable');
  const {builderArtifacts}=await import('./build.mjs');
  const {appendEvent,exportableState}=await import('../../site/assets/successor/model.mjs');
  const source=builderArtifacts().sourceManifest;
  const size=s=>new TextEncoder().encode(canonical({format:'successor-portable/1',payload:{state:s,sourceManifest:source},sha256:'0'.repeat(64)})).length;
  while(size(state)+2300<3999900)await appendEvent(state,'restored','x'.repeat(2000));
  const probe=structuredClone(state);await appendEvent(probe,'restored','x');await appendEvent(state,'restored','x'.repeat(3999900-size(probe)+1));
  const checkpoint=await exportCapsule(state,source);assert.equal(new TextEncoder().encode(checkpoint).length,3999900);
  const restored=await restoreCapsule(await inspectCapsule(checkpoint),true);
  const selected=await chooseCandidate(restored,restored.candidates[0].id,'keep');
  await assert.rejects(exportableState(selected,source),{code:'CAPSULE_CAPACITY'});
  assert.equal(await exportCapsule(restored,source),checkpoint,'source-bearing rejection preserves the prior workspace');
  const {continueHistory}=await import('../../site/assets/successor/model.mjs');
  await assert.rejects(continueHistory(restored,true,source),{code:'CAPSULE_CAPACITY'});
  assert.equal(await exportCapsule(restored,source),checkpoint);
  await continueHistory(restored,true,null);
  const selectedSource=await exportCapsule(restored);const imported=await inspectCapsule(selectedSource);
  assert.equal(imported.capsule.payload.sourceManifest,null);
  assert.equal(await exportCapsule(await restoreCapsule(imported,true),imported.capsule.payload.sourceManifest),selectedSource);
  const {parseStrict}=await import('../../site/assets/successor/safe.mjs');
  const embedded=checkpoint.replace(/</g,'\\u003c');assert.ok(new TextEncoder().encode(embedded).length>LIMITS.capsule);
  const decoded=canonical(parseStrict(embedded,6*LIMITS.capsule));assert.equal(decoded,canonical(JSON.parse(checkpoint)));
  assert.deepEqual((await inspectCapsule(decoded)).capsule.payload.state,state);


});

for (const sourceManifest of [null,{repository:'MontrealAI/AGIJobManager',commit:'a'.repeat(40),engineSha256:'b'.repeat(64),files:[],license:'MIT'}]) test(`history and reuse preserve exact parent source ${sourceManifest?'present':'absent'}`,async()=>{
  const {continueHistory,reuseSystem}=await import('../../site/assets/successor/model.mjs');
  let state=await createSystem(defaultMission('analyst','en'));
  const ran=await runCandidate(state,'baseline','0'.repeat(64));state=await chooseCandidate(ran.state,ran.candidate.id,'keep');
  const raw=await exportCapsule(state,sourceManifest),original=JSON.parse(raw);
  const continued=await continueHistory(state,true,sourceManifest);assert.equal(continued.checkpoint,raw);
  assert.deepEqual(JSON.parse(await exportCapsule(continued.state,sourceManifest)).payload.sourceManifest,sourceManifest);
  const reused=await reuseSystem(state,{...state.mission,input:'id,category,value\na,A,4'},true,sourceManifest);
  assert.equal(reused.parentCapsule,raw);assert.equal(JSON.parse(reused.state.chronicle.at(-1).subject).parentCapsuleSha256,original.sha256);
  assert.equal(await exportCapsule(state,sourceManifest),raw,'parent remains unchanged');
});

test('JSON and CSV mapping reject empty or oversized column names during preview',async()=>{
  const {previewMapping}=await import('../../site/assets/successor/mapping.mjs');
  for(const name of ['', 'a'.repeat(81)])for(const raw of [JSON.stringify([{id:'a',category:'A',[name]:'1'}]),`id,category,${name}\na,A,1`])await assert.rejects(previewMapping(raw,{id:'id',category:'category',value:name}),{code:'MAPPING_COLUMNS'});
});
test('generated Builder CSP permits only exact reviewed current and legacy artifact styles',async()=>{
  const {builderArtifacts}=await import('./build.mjs');const {createHash}=await import('node:crypto');
  const {STYLE}=await import('../../site/assets/successor/missions.mjs');const {STYLE:legacy}=await import('../../site/assets/successor/legacy-missions.mjs');
  for(const html of Object.values(builderArtifacts().pages)){const csp=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];for(const css of [STYLE,legacy])assert.ok(csp.includes(`'sha256-${createHash('sha256').update(css).digest('base64')}'`));assert.ok(!csp.includes('unsafe-inline'));}
});
