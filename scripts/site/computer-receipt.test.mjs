// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {canonical,sha256} from '../../site/assets/successor/safe.mjs';
import {createComputerReceiptDraft as nativeCreate} from '../integrations/four-repo-computer-receipt.mjs';
import {createComputerReceiptDraft as browserCreate} from '../../site/assets/computer-receipt/adapter.mjs';
import {inspectComputerReturn,inspectComputerReceiptEvidence,retainComputerHandoff,importComputerReturn,inspectComputerHistory,inspectLearningArchive} from '../../site/assets/computer-receipt/inspectors.mjs';
import {prepareHistory,inspectHistory,mergeNativeHistory,saveBrowserHistory,BROWSER_STORAGE_PREFIX} from '../../site/assets/computer-receipt/history.mjs';
import {protocolInputs,completeAlphaArchiveRaw} from './computer-receipt-fixture.mjs';
const args={budgetUSDC:'12.345678',createdAt:'2026-10-19T18:00:00.000Z'},inspectors={inspectAlphaReturn:inspectComputerReturn,inspectComputerEvidence:inspectComputerReceiptEvidence};
test('canonical native and browser receivers produce identical explicit USDC drafts from native protocol inspection',async()=>{
  const {supplied,project}=await protocolInputs(),native=await nativeCreate(supplied,{...args,...inspectors}),browser=await browserCreate(supplied,{...args,...inspectors}),history=await prepareHistory(supplied,args);
  assert.equal(native,browser);assert.equal(history.value.drafts[0],native);assert.equal(history.project.id,project.id);assert.equal(canonical(history.project),canonical(project));
  const draft=history.drafts[0];assert.equal(draft.planning.amountBaseUnits,'12345678');assert.equal(draft.route.asset,'USDC');assert.equal(draft.route.chainId,1);assert.equal(draft.route.decimals,6);assert.equal(draft.route.deployment,null);assert.equal(draft.authority,'none');assert.equal(draft.commissioning.transaction,null);assert.equal(draft.trustedComputerExecution,false);assert.equal(draft.independentProof,false);assert.equal(draft.planning.reservedBaseUnits,'0');
});
test('complete history reopens inactive and keeps exact earlier proposals, native attempts and incumbent project',async()=>{
  const {supplied,project,report}=await protocolInputs(),first=await prepareHistory(supplied,args),second=await prepareHistory(supplied,{...args,budgetUSDC:'20',priorRaw:first.raw});
  assert.equal(second.value.drafts[0],first.value.drafts[0]);assert.equal(second.drafts.length,2);assert.equal(second.drafts[1].planning.amountBaseUnits,'20000000');assert.equal(canonical(second.project),canonical(project));
  const stopped=await protocolInputs({project,report,state:'interrupted'});let failed=await retainComputerHandoff(project,stopped.supplied.handoffRaw);failed=await importComputerReturn(project,stopped.supplied.handoffRaw,stopped.supplied.returnRaw,{priorRecord:failed});
  const merged=await mergeNativeHistory(second.value.alphaHistoryRaw,failed),exactImported=' \n'+merged+'\n',complete=await prepareHistory(supplied,{...args,priorRaw:second.raw,alphaHistoryRaw:exactImported}),restored=await inspectHistory(complete.raw);
  assert.equal(restored.value.nativeHistorySources[0],exactImported,'Complete source history wire bytes remain available after continuation');
  assert.equal(restored.native.records.length,2);assert(restored.native.records.some(item=>item.returnRaw!==null&&JSON.parse(item.returnRaw).receipt.state==='interrupted'));assert.equal(restored.value.inactive,true);assert.equal(restored.value.authority,'none');assert.equal(restored.value.productionQualified,false);assert.equal(restored.value.settlement,'not-connected');assert.deepEqual((await inspectComputerHistory(restored.value.alphaHistoryRaw)).records,restored.native.records);
  const originalArchive=completeAlphaArchiveRaw(),archive=await inspectLearningArchive(originalArchive),supplier=await protocolInputs({project:archive.project}),full=await prepareHistory(supplier.supplied,{...args,alphaHistoryRaw:originalArchive}),reopened=await inspectHistory(full.raw);
  assert.equal(reopened.value.nativeHistorySources[0],originalArchive,'Normal Alpha GUI archive bytes, including all fields, remain exact');assert.equal(reopened.originalAlphaArchives[0],originalArchive);assert.equal(reopened.native.records.length,4);assert(reopened.native.records.some(item=>item.review?.decision==='useful'));assert(reopened.native.records.some(item=>item.returnRaw!==null&&JSON.parse(item.returnRaw).receipt.state==='interrupted'));for(const record of archive.checkedComputer.records)assert(reopened.native.records.some(item=>canonical(item)===canonical(record)));
  assert.equal(canonical(reopened.project),canonical(archive.project));assert.deepEqual(JSON.parse(reopened.value.nativeHistorySources[0]).project.opportunities,archive.project.opportunities);
  const malformed={...JSON.parse(originalArchive),records:[{cycleId:'unknown-cycle',strategy:null,resolution:null}]};await assert.rejects(prepareHistory(supplier.supplied,{...args,alphaHistoryRaw:canonical(malformed)}),/LEARNING_CYCLE_BINDING/);
  await assert.rejects(prepareHistory(supplied,{...args,alphaHistoryRaw:originalArchive}),/HISTORY_PROJECT/);
});
test('recomputed outer checksums cannot promote authority, change the route or bypass native observation replay',async()=>{
  const {supplied}=await protocolInputs(),first=await prepareHistory(supplied,args);
  const rewrite=async value=>{const {sha256:old,...body}=value;return canonical({...body,sha256:await sha256(body)});};
  for(const patch of [{authority:'execution'},{inactive:false},{settlement:'connected'},{productionQualified:true}])await assert.rejects(inspectHistory(await rewrite({...first.value,...patch})),/COMPUTER_HISTORY_SCOPE/);
  const draft=JSON.parse(first.value.drafts[0]);draft.route.asset='AGIALPHA';draft.sha256='sha256:'+await sha256(canonical(Object.fromEntries(Object.entries(draft).filter(([key])=>key!=='sha256'))));
  await assert.rejects(inspectHistory(await rewrite({...first.value,drafts:[canonical(draft)]})),/COMPUTER_DRAFT_INTEGRITY/);
  const changed=JSON.parse(supplied.returnRaw);changed.observedText+='tampered';await assert.rejects(prepareHistory({...supplied,returnRaw:canonical(changed)},args),/ARTIFACT_BINDING/);
  await assert.rejects(prepareHistory({...supplied,inspector:'payload-selected-code'},args),/INPUT_FIELDS/);
});
test('different projects, ambiguous input, rounded prices and capacity overflow never replace prior history',async()=>{
  const one=await protocolInputs(),other=await protocolInputs(),first=await prepareHistory(one.supplied,args);
  await assert.rejects(prepareHistory(other.supplied,{...args,priorRaw:first.raw}),/HISTORY_PROJECT/);
  for(const budgetUSDC of ['1e3','1,25','0','1.0000001','-1'])await assert.rejects(prepareHistory(one.supplied,{...args,budgetUSDC}),/COMPUTER_DRAFT_USDC/);
  await assert.rejects(prepareHistory({...one.supplied,handoffRaw:'\uFEFF'+one.supplied.handoffRaw},args),/JSON/);
  await assert.rejects(prepareHistory(one.supplied,{...args,alphaHistoryRaw:''}));
  let current=first;for(let index=1;index<8;index++)current=await prepareHistory(one.supplied,{...args,budgetUSDC:String(index+20),priorRaw:current.raw});
  await assert.rejects(prepareHistory(one.supplied,{...args,budgetUSDC:'100',priorRaw:current.raw}),/HISTORY_DRAFTS/);assert.equal((await inspectHistory(current.raw)).drafts.length,8);assert.equal((await inspectHistory(first.raw)).drafts.length,1);
});
test('fixed portable inspector files remain exact original licensed Git bytes',()=>{
  for(const name of ['alpha-computer','jobs-computer']){const base=new URL('../../site/assets/computer-receipt/vendor/'+name+'/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('source-manifest.json',base)));assert.match(manifest.commit,/^[a-f0-9]{40}$/);assert.match(manifest.tree,/^[a-f0-9]{40}$/);for(const [relative,record]of Object.entries(manifest.files)){const bytes=fs.readFileSync(new URL(relative,base));assert.equal(bytes.length,record.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),record.gitBlob);}assert(fs.statSync(new URL('LICENSE',base)).size>0);}
});
test('atomic browser saves reject a shorter history and stale concurrent writers without replacing prior proposals',async()=>{
  const {supplied}=await protocolInputs(),first=await prepareHistory(supplied,args),left=await prepareHistory(supplied,{...args,budgetUSDC:'20',priorRaw:first.raw}),right=await prepareHistory(supplied,{...args,budgetUSDC:'30',priorRaw:first.raw});
  const records=new Map(),storage={getItem:key=>records.get(key)??null,setItem:(key,raw)=>records.set(key,raw)};let queue=Promise.resolve();
  const locks={request:(name,options,callback)=>{assert.equal(name,BROWSER_STORAGE_PREFIX+first.project.id);assert.equal(options.mode,'exclusive');const result=queue.then(callback);queue=result.catch(()=>{});return result;}};
  const save=raw=>saveBrowserHistory(raw,{storage,locks});await save(first.raw);await save(first.raw);
  const fresh=await prepareHistory(supplied,{...args,budgetUSDC:'99'});await assert.rejects(save(fresh.raw),/REOPEN_EXISTING_HISTORY_FIRST/);assert.equal(records.get(BROWSER_STORAGE_PREFIX+first.project.id),first.raw);
  const outcomes=await Promise.allSettled([save(left.raw),save(right.raw)]);assert.equal(outcomes.filter(item=>item.status==='fulfilled').length,1);assert.match(outcomes.find(item=>item.status==='rejected').reason.message,/REOPEN_EXISTING_HISTORY_FIRST/);
  const winner=records.get(BROWSER_STORAGE_PREFIX+first.project.id);assert.ok([left.raw,right.raw].includes(winner),'Only a complete accepted continuation may be stored');
  const continued=await prepareHistory(supplied,{...args,budgetUSDC:winner===left.raw?'30':'20',priorRaw:winner});await save(continued.raw);assert.equal((await inspectHistory(records.get(BROWSER_STORAGE_PREFIX+first.project.id))).drafts.length,3);
  await assert.rejects(saveBrowserHistory(continued.raw,{storage,locks:null}),/ATOMIC_BROWSER_STORAGE_UNAVAILABLE/);assert.equal(records.get(BROWSER_STORAGE_PREFIX+first.project.id),continued.raw);
});
