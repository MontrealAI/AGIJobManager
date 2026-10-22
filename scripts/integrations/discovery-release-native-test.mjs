// SPDX-License-Identifier: MIT
// Execute only captured, Git-authenticated installed Alpha code. No request selects code.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {canonical, parseBounded, BINDING_KEYS, STAGES, RESOURCE_KEYS} from './discovery-lab-contract.mjs';
import {receiveDiscoveryLabWorkRequest, DISCOVERY_LAB_ADMISSION_CHECKS} from './discovery-lab-work-request.mjs';
const ROUTE = 'USDC';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
import {boundedSource,capturePinnedAlpha,captureSavedAlpha,decodeUtf8} from './discovery-installed-runtime.mjs';
export {boundedSource,capturePinnedAlpha,captureSavedAlpha,decodeUtf8,guardMainGitConfig} from './discovery-installed-runtime.mjs';

export function assertStrongerSuccessor(initial,stronger) {
  assert.equal(stronger?.state,'accepted');
  assert.ok(hash(initial.campaignDigest) && hash(stronger.campaignDigest),'Unique current campaign identities are required');
  assert.notEqual(stronger.campaignDigest,initial.campaignDigest,'A distinct stronger campaign identity is required');
  assert.notEqual(stronger.resultDigest,initial.resultDigest,'A distinct retained accepted successor is required');
  let ancestor=stronger.parent, matched=false;
  for(let depth=0;ancestor&&depth<8;depth++,ancestor=ancestor.parent) {
    if(ancestor.campaignDigest===initial.campaignDigest && ancestor.resultDigest===initial.resultDigest && canonical(ancestor.bindings)===canonical(initial.bindings)) {matched=true;break;}
  }
  assert.ok(matched,'The stronger campaign must descend from the exact source-bound predecessor');
  assert.equal(stronger.bindings.missionId,initial.bindings.missionId);
  assert.ok(stronger.bindings.revision>initial.bindings.revision);
  assert.equal(stronger.charter.purpose,initial.charter.purpose);
  assert.ok(stronger.charter.controls>=initial.charter.controls && stronger.charter.memory>=initial.charter.memory);
  assert.ok(initial.charter.operations.every(operation=>stronger.charter.operations.includes(operation)));
  assert.ok(stronger.charter.controls>initial.charter.controls || stronger.charter.memory>initial.charter.memory
    ||stronger.charter.operations.some(operation=>!initial.charter.operations.includes(operation)),'A real monotone extension is required');
  assert.equal(stronger.result.reuse.priorPurposePreservedOnOldSlice,true);
  assert.equal(stronger.result.reuse.acceptedPredecessorPreserved,true);
  assert.ok(stronger.result.reuse.retainedFactors.length>0,'Actual retained factor evidence is required');
}

export async function qualifyDiscoveryLabReceiver(alphaRoot,{retainedWorkspace=null,installedCapsule=false,sourceContext=null,evidenceDirectory=null,candidateArchiveSha256=null,
  originalWorkspaceRaw=null,originalRequestRaw=null,campaignDigest=null}={}) {
  if(originalWorkspaceRaw!==null||originalRequestRaw!==null||campaignDigest!==null) {
    assert.ok(installedCapsule,'Original-browser qualification requires the saved installed capsule');
    return qualifyOriginalBrowserReceiver(alphaRoot,{sourceContext,evidenceDirectory,candidateArchiveSha256,
      originalWorkspaceRaw,originalRequestRaw,campaignDigest});
  }
  const installed = installedCapsule ? captureSavedAlpha(alphaRoot) : capturePinnedAlpha(alphaRoot);
  try {
    const load = installed.load;
    const [runtime,history,workspace,contract,{createInspector},receipts,docket,evidenceHistory] = await Promise.all([
      load('discovery-lab'),load('discovery-lab-history'),load('workspace'),load('discovery-lab-contract'),load('discovery-lab-inspector'),
      load('discovery-lab-receipts'),load('discovery-lab-docket'),load('discovery-lab-evidence-history')]);
    const inspectCampaign=createInspector(installed.sources);
    let saved=retainedWorkspace ? await workspace.parseWorkspace(canonical(retainedWorkspace)) : await workspace.createWorkspace();
    const retained=retainedWorkspace ? (await workspace.inspectWorkspace(saved)).discovery.campaigns : null;
    async function campaign(charter,parent=null) {
      const attempt=await history.startPayload(saved,charter,installed.sources,parent?.campaignDigest||null);
      saved=await workspace.recordDiscoveryEvent(saved,'lab-started',attempt);
      const started=performance.now(),result=runtime.runCampaign(charter,{parent:parent?.result||null});
      const verified=history.verifyForRecording(charter,result,parent?.result||null);
      saved=await workspace.recordDiscoveryEvent(saved,'lab-completed',await history.completedPayload(attempt.attempt,result,
        Math.ceil(performance.now()-started),verified.verificationResources));
      return (await workspace.inspectWorkspace(saved)).discovery.campaigns.at(-1);
    }
    const initial=retained ? retained.find(record=>record.state==='accepted') : await campaign(runtime.DEFAULT_CHARTER);
    assert.equal(initial?.state,'accepted','A retained accepted predecessor is required');
    const primaryCase='accepted-evolve';
    const outcomes=[];
    function limitsFor(record) {
      const out=Object.fromEntries(RESOURCE_KEYS.map(key=>[key,0]));
      for(let item=record;item;item=item.parent) for(const key of ['acquisitions','search','checking','installations'])out[key]+=item.charter.budget[key];
      out.checking+=DISCOVERY_LAB_ADMISSION_CHECKS+contract.DISCOVERY_LAB_INSPECTION_CHECKS;
      return {...out,memoryBytes:8_000_000,storageBytes:8_000_000,workerCapacity:4,elapsedMs:120_000};
    }
    async function receive(record,stage='evolve',change=null,limitChange=null) {
      const limits=limitsFor(record);if(limitChange)limitChange(limits);
      const request=await history.workRequest(record,ROUTE,limits);request.stage=stage;
      request.inputArtifacts=record.artifacts.slice(0,STAGES.indexOf(stage)).map(artifact=>artifact.digest);
      if(change) {change(request);request.payloadDigest=await contract.payloadDigest(request.payload);}
      const expectedBindings=Object.fromEntries(BINDING_KEYS.map(key=>[key,record.bindings[key]]));
      return receiveDiscoveryLabWorkRequest(canonical(request),{expectedBindings,
        expectedCommission:Object.fromEntries(['id','branch','route'].map(key=>[key,request.commission[key]])),inspectCampaign});
    }
    for(const stage of STAGES) {
      if(installedCapsule && stage==='evolve'&&primaryCase==='accepted-evolve') {outcomes.push({case:'accepted-evolve',receipt:null});continue;}
      const receipt=await receive(initial,stage);assert.equal(receipt.state,'local-checked');
      assert.equal(receipt.lifecycle.commission,'DRAFT_NOT_SUBMITTED');assert.equal(receipt.authority,'none');
      assert.equal(receipt.commission.capBaseUnits,'0');assert.equal(receipt.checker.nativeWithinResourceEnvelope,true);
      outcomes.push({case:'accepted-'+stage,receipt});
    }
    const missingInspectionReserve=await receive(initial,'evolve',null,limits=>{
      limits.checking-=contract.DISCOVERY_LAB_INSPECTION_CHECKS;
    });
    assert.equal(missingInspectionReserve.state,'inconclusive');
    assert.equal(missingInspectionReserve.checker.report.resourceUsed.checking,contract.DISCOVERY_LAB_INSPECTION_CHECKS);
    assert.equal(missingInspectionReserve.checker.report.resourceUsed.search,0);
    assert.ok(missingInspectionReserve.checker.report.reasons.includes('CONSERVATIVE_REPLAY_CHECK_INCOMPLETE'));
    outcomes.push({case:'missing-inspection-reserve',receipt:missingInspectionReserve});
    const tampered=await receive(initial,'learn',request=>{request.payload.result.stages[0].program.errorBound+=1;});
    assert.notEqual(tampered.state,'local-checked');outcomes.push({case:'rehashed-invalid-measurement',receipt:tampered});
    const negative=retained ? retained.find(record=>record.state==='rejected') : await campaign({...structuredClone(runtime.DEFAULT_CHARTER),noise:1,accuracy:0},initial);
    assert.equal(negative.state,'rejected');await assert.rejects(history.workRequest(negative,ROUTE,limitsFor(negative)));
    const exhausted=retained ? retained.find(record=>record.state==='inconclusive') : await campaign({...structuredClone(runtime.DEFAULT_CHARTER),budget:{...runtime.DEFAULT_CHARTER.budget,search:0}},initial);
    assert.equal(exhausted.state,'inconclusive');await assert.rejects(history.workRequest(exhausted,ROUTE,limitsFor(exhausted)));
    const stronger=retained ? retained.filter(record=>record.state==='accepted').at(-1) : await campaign({...structuredClone(runtime.DEFAULT_CHARTER),controls:4,memory:16,operations:['flip-z','flip-w']},initial);
    assertStrongerSuccessor(initial,stronger);
    assert.equal(stronger.state,'accepted');
    const successorReceipt=await receive(stronger);
    assert.equal(successorReceipt.state,'local-checked');outcomes.push({case:'stronger-successor',receipt:successorReceipt});
    const reloaded=await workspace.parseWorkspace(canonical(saved)),view=await workspace.inspectWorkspace(reloaded);
    if(!retained) assert.deepEqual(view.discovery.campaigns.map(record=>record.state),['accepted','rejected','inconclusive','accepted']);
    assert.ok(view.discovery.campaigns.some(record=>record.state==='accepted' && record.resultDigest===initial.resultDigest));
    let returned = null,returnedWorkspace=reloaded;
    if(installedCapsule) {
      assert.ok(sourceContext && /^[a-f0-9]{40}$/.test(sourceContext.sourceCommit) && /^[a-f0-9]{40}$/.test(sourceContext.sourceTree));
      const source={repository:'MontrealAI/AGIJobManager',commit:sourceContext.sourceCommit,tree:sourceContext.sourceTree,
        adapterSha256:sha(boundedSource(fileURLToPath(new URL('./discovery-lab-work-request.mjs',import.meta.url)))),
        contractSha256:sha(boundedSource(fileURLToPath(new URL('./discovery-lab-contract.mjs',import.meta.url))))};
      const primaryCampaign=initial;
      const draft=await history.workRequest(primaryCampaign,ROUTE,limitsFor(primaryCampaign));
      draft.stage='evolve';draft.inputArtifacts=primaryCampaign.artifacts.slice(0,5).map(item=>item.digest);
      const before=canonical(reloaded),original=canonical(draft);
      const {inspectInstalledRequest}=await import('./discovery-installed-operator.mjs');
      const operation=await inspectInstalledRequest(alphaRoot,before,original,primaryCampaign.campaignDigest,sourceContext);
      const primary=JSON.parse(operation.rawReceipt),receiptRaw=operation.rawReceipt,wrapper=operation.wrapper;
      outcomes.find(item=>item.case===primaryCase).receipt=primary;
      assert.equal(primary.state,'local-checked');assert.equal(primary.authority,'none');
      assert.equal(primary.lifecycle.commission,'DRAFT_NOT_SUBMITTED');assert.equal(primary.commission.capBaseUnits,'0');
      assert.equal(primary.checker.nativeWithinResourceEnvelope,true);
      const beforeEvents=structuredClone(reloaded.events);
      const checked=await receipts.inspectReceiverReceipt(wrapper,receipts.makeReceiverContext(primaryCampaign),{expectedReceiverSources:[source]});
      const payload=await evidenceHistory.evidencePayload(primaryCampaign.campaignDigest,'receiver-receipt',wrapper);
      const after=operation.workspace;returnedWorkspace=after;
      assert.equal(canonical(after.events.slice(0,-1)),canonical(beforeEvents));assert.equal(after.events.length,reloaded.events.length+1);
      const retainedAfter=canonical(after);
      await assert.rejects(workspace.recordDiscoveryEvent(after,'lab-evidence-attached',payload));
      assert.equal(canonical(after),retainedAfter);
      const forged={raw:JSON.stringify({...primary,authority:'execute'}),source};
      await assert.rejects(workspace.recordDiscoveryEvent(after,'lab-evidence-attached',
        await evidenceHistory.evidencePayload(primaryCampaign.campaignDigest,'receiver-receipt',forged)));
      assert.equal(canonical(after),retainedAfter);
      const attachments=await docket.emptyDocketAttachments(after);
      attachments.receipts=outcomes.filter(item=>![primaryCase,'rehashed-invalid-measurement'].includes(item.case)).map(item=>({raw:JSON.stringify(item.receipt,null,2)+'\n',source}));
      const text=await docket.exportDiscoveryDocket(after,attachments,{expectedReceiverSources:[source]});
      await docket.verifyDiscoveryDocket(text,{expectedReceiverSources:[source],expectedMissionId:after.missionId});
      const reopened=await workspace.parseWorkspace(canonical(after));
      const again=await docket.exportDiscoveryDocket(reopened,attachments,{expectedReceiverSources:[source]});
      assert.equal(again,text);assert.equal(Object.keys(JSON.parse(text).files).length,13);
      returned={installedOperator:operation.installedOperator,primaryCase,missionId:after.missionId,campaignDigest:primaryCampaign.campaignDigest,receiptId:checked.receiptId,
        requestSha256:sha(primary.original),receiptSha256:sha(receiptRaw),workspaceBeforeSha256:sha(before),
        workspaceAfterSha256:sha(canonical(after)),docketSha256:sha(text),reopenedDocketSha256:sha(again),
        sameHistory:{prefixPreserved:true,appendedEvents:1,duplicateRefused:true,refusalPreserved:true,reopenByteIdentical:true,docketSections:13}};
      if(evidenceDirectory) {
        assert.ok(path.isAbsolute(evidenceDirectory)&&!fs.existsSync(evidenceDirectory));fs.mkdirSync(evidenceDirectory);
        const files={'original-request.json':primary.original,'raw-receipt.json':receiptRaw,'receipt-wrapper.json':JSON.stringify(wrapper,null,2)+'\n',
          'workspace-before.json':before,'workspace-after.json':canonical(after),'docket.json':text,'docket-reopened.json':again};
        for(const [name,raw] of Object.entries(files))fs.writeFileSync(path.join(evidenceDirectory,name),raw,{flag:'wx'});
      }
    }
    const negativeMeasurement=outcomes.find(item=>item.case==='rehashed-invalid-measurement');
    const qualificationRefusals=[{case:negativeMeasurement.case,rawReceipt:JSON.stringify(negativeMeasurement.receipt,null,2)+'\n',
      resourceUsed:negativeMeasurement.receipt.resources.totalUsed,admittedToMission:false,totalComplete:false,authority:'none',
      scope:'Negative qualification-test observation outside the admitted mission receipt ledger.'}];
    return {schema:'successor/discovery-release-native-evidence/v1',qualificationRefusals,...(sourceContext||{}),...(returned||{}),candidateArchiveSha256,
      scope:'Constructed/retained local synthetic regression and receiver admission; no original-browser continuity, release qualification or external execution.',
      route:ROUTE,node:process.version,alphaCommit:installed.pin.commit,alphaTree:installed.pin.tree,sourceHash:installed.pin.sourceHash,
      sourceCustody:installed.custody,retainedWorkspace:returnedWorkspace,workspaceDigest:sha(canonical(returnedWorkspace)),
      inputWorkspace:retainedWorkspace?'shared-frozen-workspace':installedCapsule?'constructed-independent-regression':'constructed-for-this-route',
      historyStates:view.discovery.campaigns.map(record=>record.state),
      barriers:{rejectedNotExported:true,inconclusiveNotExported:true,acceptedPredecessorPreserved:true},
      historyInspectionCosts:history.auditSnapshot(),outcomes,externalExecution:'unprovisioned',currencyCapBaseUnits:'0',authority:'none'};
  } finally {installed.dispose();}
}

async function qualifyOriginalBrowserReceiver(alphaRoot,{sourceContext,evidenceDirectory,candidateArchiveSha256,
  originalWorkspaceRaw,originalRequestRaw,campaignDigest}) {
  assert.ok(typeof originalWorkspaceRaw==='string'&&typeof originalRequestRaw==='string'&&hash(campaignDigest));
  assert.ok(sourceContext?.browserInput,'Authenticated original browser input custody is required');
  for(const [key,value] of Object.entries({workspaceSha256:sha(originalWorkspaceRaw),requestSha256:sha(originalRequestRaw),campaignDigest}))
    assert.equal(sourceContext.browserInput[key],value,'Original browser input differs: '+key);
  assert.ok(path.isAbsolute(evidenceDirectory||'')&&!fs.existsSync(evidenceDirectory),'Original native evidence directory must be absent');
  const {inspectInstalledRequest}=await import('./discovery-installed-operator.mjs');
  const operation=await inspectInstalledRequest(alphaRoot,originalWorkspaceRaw,originalRequestRaw,campaignDigest,sourceContext);
  const receipt=parseBounded(operation.rawReceipt),after=canonical(operation.workspace);
  assert.equal(operation.workspace.missionId,sourceContext.browserInput.missionId);
  assert.equal(receipt.state,'local-checked');assert.equal(receipt.authority,'none');
  assert.equal(receipt.lifecycle.commission,'DRAFT_NOT_SUBMITTED');assert.equal(receipt.commission.capBaseUnits,'0');
  assert.equal(receipt.commission.route,'manager-usdc');assert.equal(receipt.checker.nativeWithinResourceEnvelope,true);
  fs.mkdirSync(evidenceDirectory);
  const files={'original-request.json':originalRequestRaw,'raw-receipt.json':operation.rawReceipt,
    'receipt-wrapper.json':JSON.stringify(operation.wrapper,null,2)+'\n','workspace-before.json':originalWorkspaceRaw,
    'workspace-after.json':after,'docket.json':operation.docket,'docket-reopened.json':operation.reopenedDocket};
  for(const [name,raw] of Object.entries(files))fs.writeFileSync(path.join(evidenceDirectory,name),raw,{flag:'wx'});
  const regression=await qualifyDiscoveryLabReceiver(alphaRoot,{installedCapsule:true,
    sourceContext:{sourceCommit:sourceContext.sourceCommit,sourceTree:sourceContext.sourceTree},
    evidenceDirectory:path.join(evidenceDirectory,'regression'),candidateArchiveSha256});
  assert.notEqual(regression.missionId,operation.workspace.missionId,'Constructed regression must retain a separate mission');
  const regressionRaw=JSON.stringify(regression,null,2)+'\n';
  fs.writeFileSync(path.join(evidenceDirectory,'regression/native-evidence.json'),regressionRaw,{flag:'wx'});
  const pin=parseBounded(decodeUtf8(boundedSource(fileURLToPath(new URL('../../config/discovery-release-alpha-source-v1.json',import.meta.url)))));
  return {schema:'successor/discovery-release-native-evidence/v1',...sourceContext,candidateArchiveSha256,
    scope:'Pinned inspection of the exact authenticated original UI workspace/request and same-mission receipt admission; constructed regressions have separate history and costs.',
    route:ROUTE,node:process.version,alphaCommit:pin.commit,alphaTree:pin.tree,sourceHash:pin.sourceHash,
    sourceCustody:operation.installedOperator.sourceCustody,installedOperator:operation.installedOperator,
    primaryCase:'original-browser-usdc',missionId:operation.workspace.missionId,campaignDigest,receiptId:operation.receiptId,
    requestSha256:sha(originalRequestRaw),receiptSha256:sha(operation.rawReceipt),workspaceBeforeSha256:sha(originalWorkspaceRaw),
    workspaceAfterSha256:sha(after),docketSha256:sha(operation.docket),reopenedDocketSha256:sha(operation.reopenedDocket),
    sameHistory:operation.sameHistory,retainedWorkspace:operation.workspace,workspaceDigest:sha(after),
    inputWorkspace:'authenticated-original-browser-workspace',
    primaryObservation:{receiptId:operation.receiptId,receiptSha256:sha(operation.rawReceipt),
      resourceUsed:receipt.resources.totalUsed,totalComplete:false,authority:'none'},
    regression:{scope:'constructed-independent-mission',nativeEvidenceSha256:sha(regressionRaw),missionId:regression.missionId,
      campaignDigest:regression.campaignDigest,receiptId:regression.receiptId,validReceiptCount:8,invalidQualificationCount:1},
    externalExecution:'unprovisioned',currencyCapBaseUnits:'0',authority:'none'};
}

if(process.argv[1]&&fs.existsSync(process.argv[1])&&fs.realpathSync(process.argv[1])===fs.realpathSync(new URL(import.meta.url))) {
  if(['--installed','--installed-regression'].includes(process.argv[2])) {
    const [capsule,contextFile,output,workspaceFile,requestFile,campaignDigest]=process.argv.slice(3);
    const browserOriginal=process.argv[2]==='--installed';
    assert.ok(capsule&&contextFile&&output&&(!browserOriginal||(workspaceFile&&requestFile&&campaignDigest)),
      'Use --installed CAPSULE SOURCE_CONTEXT_JSON ABSENT_EVIDENCE_DIRECTORY BROWSER_WORKSPACE_JSON ORIGINAL_USDC_REQUEST_JSON CAMPAIGN_DIGEST');
    const sourceContext=parseBounded(decodeUtf8(boundedSource(path.resolve(contextFile))));
    const result=await qualifyDiscoveryLabReceiver(path.resolve(capsule),{installedCapsule:true,sourceContext,
      evidenceDirectory:path.resolve(output),candidateArchiveSha256:sourceContext.candidateArchiveSha256,
      ...(browserOriginal?{originalWorkspaceRaw:decodeUtf8(boundedSource(path.resolve(workspaceFile))),
        originalRequestRaw:decodeUtf8(boundedSource(path.resolve(requestFile))),campaignDigest}:{})});
    fs.writeFileSync(path.join(output,'native-evidence.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({schema:result.schema,receiptId:result.receiptId,regressionCases:result.regression?9:result.outcomes.length,
      docketSha256:result.docketSha256,authority:result.authority}));
  } else {
    assert.ok(process.argv.length===3 || process.argv.length===4,'Usage: node discovery-release-native-test.mjs /absolute/pinned/alpha-checkout [/absolute/shared-workspace.json]');
    const retainedWorkspace=process.argv[3]?parseBounded(decodeUtf8(boundedSource(path.resolve(process.argv[3])))):null;
    console.log(JSON.stringify(await qualifyDiscoveryLabReceiver(process.argv[2],{retainedWorkspace}),null,2));
  }
}
