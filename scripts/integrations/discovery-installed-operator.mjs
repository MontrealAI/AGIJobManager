// SPDX-License-Identifier: MIT
// One bounded local receiver operation over an already verified saved release.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {captureSavedAlpha,boundedSource,decodeUtf8} from './discovery-installed-runtime.mjs';
import {receiveDiscoveryLabWorkRequest} from './discovery-lab-work-request.mjs';
const sha=raw=>createHash('sha256').update(raw).digest('hex');

export async function inspectInstalledRequest(capsuleRoot,workspaceRaw,original,campaignDigest,sourceContext) {
  assert.equal(typeof workspaceRaw,'string');assert.equal(typeof original,'string');
  assert.match(campaignDigest,/^[a-f0-9]{64}$/);
  assert.match(sourceContext.sourceCommit,/^[a-f0-9]{40}$/);assert.match(sourceContext.sourceTree,/^[a-f0-9]{40}$/);
  const installed=captureSavedAlpha(capsuleRoot);
  try {
    const [workspace,history,contract,receipts,evidence,docket,{createInspector}]=await Promise.all([
      'workspace','discovery-lab-history','discovery-lab-contract','discovery-lab-receipts',
      'discovery-lab-evidence-history','discovery-lab-docket','discovery-lab-inspector'].map(installed.load));
    const before=await workspace.parseWorkspace(workspaceRaw),view=await workspace.inspectWorkspace(before);
    assert.equal(view.discovery.active,null,'Finish or preserve the active construction attempt first');
    const matches=view.discovery.campaigns.filter(row=>row.campaignDigest===campaignDigest&&row.state==='accepted'
      &&row.lineageQualified!==false&&Object.entries(installed.sources).every(([key,value])=>row.bindings[key]===value));
    assert.equal(matches.length,1,'Select exactly one accepted current-source campaign from the saved mission');
    const selected=matches[0],request=await contract.parseWorkRequest(original);
    const capacity={acquisitions:0,search:0,checking:20000,memoryBytes:10_000_000,storageBytes:8_000_000,
      workerCapacity:4,installations:0,elapsedMs:120_000};
    for(let row=selected;row;row=row.parent)for(const key of ['acquisitions','search','checking','installations'])capacity[key]+=row.charter.budget[key];
    for(const key of contract.RESOURCE_KEYS)assert.ok(request.resourceLimits[key]<=capacity[key],'Request exceeds installed local capacity: '+key);
    const expected=await history.workRequest(selected,'USDC',request.resourceLimits);
    expected.stage=request.stage;expected.inputArtifacts=selected.artifacts.slice(0,contract.STAGES.indexOf(request.stage)).map(row=>row.digest);
    assert.equal(contract.canonical(request),contract.canonical(expected),'Original draft differs from independently reconstructed mission context');
    const receipt=await receiveDiscoveryLabWorkRequest(original,{
      expectedBindings:Object.fromEntries(contract.BINDING_KEYS.map(key=>[key,selected.bindings[key]])),
      expectedCommission:Object.fromEntries(['id','branch','route'].map(key=>[key,expected.commission[key]])),
      inspectCampaign:createInspector(installed.sources)});
    const raw=JSON.stringify(receipt,null,2)+'\n',source={repository:'MontrealAI/AGIJobManager',
      commit:sourceContext.sourceCommit,tree:sourceContext.sourceTree,
      adapterSha256:sha(boundedSource(fileURLToPath(new URL('./discovery-lab-work-request.mjs',import.meta.url)))),
      contractSha256:sha(boundedSource(fileURLToPath(new URL('./discovery-lab-contract.mjs',import.meta.url))))};
    const wrapper={raw,source},checked=await receipts.inspectReceiverReceipt(wrapper,receipts.makeReceiverContext(selected),{expectedReceiverSources:[source]});
    const payload=await evidence.evidencePayload(campaignDigest,'receiver-receipt',wrapper);
    const after=await workspace.recordDiscoveryEvent(before,'lab-evidence-attached',payload);
    assert.equal(contract.canonical(after.events.slice(0,-1)),contract.canonical(before.events));assert.equal(after.events.length,before.events.length+1);
    const unchanged=contract.canonical(after);
    await assert.rejects(workspace.recordDiscoveryEvent(after,'lab-evidence-attached',payload));
    assert.equal(contract.canonical(after),unchanged);
    const forged={raw:JSON.stringify({...receipt,authority:'execute'}),source};
    await assert.rejects(workspace.recordDiscoveryEvent(after,'lab-evidence-attached',
      await evidence.evidencePayload(campaignDigest,'receiver-receipt',forged)));
    assert.equal(contract.canonical(after),unchanged);
    const attachments=await docket.emptyDocketAttachments(after),options={expectedReceiverSources:[source],expectedMissionId:before.missionId};
    const text=await docket.exportDiscoveryDocket(after,attachments,options);await docket.verifyDiscoveryDocket(text,options);
    const reopened=await workspace.parseWorkspace(contract.canonical(after));
    const again=await docket.exportDiscoveryDocket(reopened,attachments,options);assert.equal(again,text);
    return {schema:'manager/discovery-installed-operation/v1',original,rawReceipt:raw,wrapper,
      installedOperator:{path:'scripts/integrations/discovery-installed-operator.mjs',
        sha256:sha(boundedSource(fileURLToPath(import.meta.url))),docketSha256:sha(text),reopenedDocketSha256:sha(again),
        sourceCustody:installed.custody},
      workspace:after,docket:text,reopenedDocket:again,receiptId:checked.receiptId,
      sameHistory:{prefixPreserved:true,appendedEvents:1,duplicateRefused:true,refusalPreserved:true,reopenByteIdentical:true,docketSections:13},
      scope:'Bounded local synthetic review in the retained mission; imported code is never selected by the request.',
      authority:'none',externalExecution:'unprovisioned',currencyCapBaseUnits:'0'};
  } finally {installed.dispose();}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [capsule,workspaceFile,requestFile,campaignDigest,manifestFile,output]=process.argv.slice(2);
  assert.ok(capsule&&workspaceFile&&requestFile&&campaignDigest&&manifestFile&&output,
    'Use CAPSULE WORKSPACE_JSON ORIGINAL_REQUEST_JSON CAMPAIGN_DIGEST RELEASE_MANIFEST_JSON ABSENT_OUTPUT');
  assert.ok(path.isAbsolute(output)&&!fs.existsSync(output),'An absent absolute output directory is required');
  const manifest=JSON.parse(decodeUtf8(boundedSource(path.resolve(manifestFile))));
  assert.equal(manifest.releaseProfile,'manager-discovery-release-v1');
  const result=await inspectInstalledRequest(path.resolve(capsule),decodeUtf8(boundedSource(path.resolve(workspaceFile))),
    decodeUtf8(boundedSource(path.resolve(requestFile))),campaignDigest,manifest);
  fs.mkdirSync(output);
  const files={'original-request.json':result.original,'raw-receipt.json':result.rawReceipt,
    'receipt-wrapper.json':JSON.stringify(result.wrapper,null,2)+'\n','workspace-after.json':JSON.stringify(result.workspace),
    'docket.json':result.docket,'docket-reopened.json':result.reopenedDocket};
  for(const [name,raw] of Object.entries(files))fs.writeFileSync(path.join(output,name),raw,{flag:'wx'});
  console.log(JSON.stringify({receiptId:result.receiptId,authority:result.authority,externalExecution:result.externalExecution}));
}
