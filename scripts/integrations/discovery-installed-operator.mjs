// SPDX-License-Identifier: MIT
// One bounded local receiver operation over an already verified saved release.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {captureSavedAlpha,boundedSource,decodeUtf8} from './discovery-installed-runtime.mjs';
import {receiveDiscoveryLabWorkRequest} from './discovery-lab-work-request.mjs';
import {canonical as canonicalContext} from './discovery-lab-contract.mjs';
const sha=raw=>createHash('sha256').update(raw).digest('hex');

export const JOBS_RC20_COUNTERPART = Object.freeze({
  schema:'manager/discovery-qualified-counterpart/v1',
  id:'jobs-rc20-f7',
  archiveSha256:'5ae312997ce3e2685760e621954828a82ded714cc245339fcfcdd5245373ccfa',
  archiveBytes:457348,
  manifestSha256:'3ce7fe629f1f39800711dcd3be32f2c5c0b00aec67dbfd45b906a1f32c9d4606',
  source:Object.freeze({repository:'MontrealAI/AGIJobsv0',
    commit:'f7c00e668fe31ce1ea907f0006b6c14dc9db5e01',
    tree:'17c1cf5ccca47d427401e2832433e325d5e10563',
    adapterSha256:'337fabca02ece2a25b8cc50e56fea5bf5338f2b6f18343eb4a3353a634aefec4',
    contractSha256:'98c8de8ce2774b7650bf4ee11eeedfb0a69b75fa6d1b080ef823637d77d0ab47'})
});

// Public rc21 release422958907; exact anonymous archive/installed-source handoff6389174231.
export const JOBS_RC21_COUNTERPART = Object.freeze({
  schema:'manager/discovery-qualified-counterpart/v1',
  id:'jobs-rc21-bc4',
  archiveSha256:'f9578d4aaae99f651feb34b82d07079b60748b03e6556d9321888167f7c6b602',
  archiveBytes:512539,
  manifestSha256:'53b2e9bd4c545ff54f05daed810edfb052899039927d28bf567bd0221bee6125',
  source:Object.freeze({repository:'MontrealAI/AGIJobsv0',
    commit:'bc4abbd5c28f3672275b13300e40ea26c820b8ee',
    tree:'009f11b81c554d80eeddda882c8f91f2e89c8b2e',
    adapterSha256:'337fabca02ece2a25b8cc50e56fea5bf5338f2b6f18343eb4a3353a634aefec4',
    contractSha256:'98c8de8ce2774b7650bf4ee11eeedfb0a69b75fa6d1b080ef823637d77d0ab47'})
});

// Selection must come from independently authenticated public archive provenance,
// never from the mission or its receipt. These finite peers do not select code.
export function qualifiedCounterpartSource(counterpartSelection) {
  const selected=canonicalContext(counterpartSelection);
  if(selected===canonicalContext(JOBS_RC20_COUNTERPART))return JOBS_RC20_COUNTERPART.source;
  assert.ok(JOBS_RC21_COUNTERPART!==null,
    'Counterpart Jobs rc21 public archive, manifest and source selection is pending');
  assert.equal(selected,canonicalContext(JOBS_RC21_COUNTERPART),
    'Counterpart differs from the exact qualified Jobs rc20 or rc21 source and archive selection');
  return JOBS_RC21_COUNTERPART.source;
}

export function receiverSourcesForHistory(managerSource,priorSources,counterpartSelection=null) {
  const allowed=[managerSource];
  if(counterpartSelection!==null) {
    allowed.push(qualifiedCounterpartSource(counterpartSelection));
  }
  for(const source of priorSources)assert.ok(allowed.some(expected=>
    canonicalContext(expected)===canonicalContext(source)),
    'Receiver is absent from the explicitly selected installed source context.');
  return allowed;
}

export async function inspectInstalledRequest(capsuleRoot,workspaceRaw,original,campaignDigest,sourceContext,counterpartSelection=null) {
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
    const source={repository:'MontrealAI/AGIJobManager',
      commit:sourceContext.sourceCommit,tree:sourceContext.sourceTree,
      adapterSha256:sha(boundedSource(fileURLToPath(new URL('./discovery-lab-work-request.mjs',import.meta.url)))),
      contractSha256:sha(boundedSource(fileURLToPath(new URL('./discovery-lab-contract.mjs',import.meta.url))))};
    const priorSources=before.events.filter(event=>event.kind==='lab-evidence-attached'
      &&event.payload.kind==='receiver-receipt').map(event=>event.payload.record.source);
    const expectedReceiverSources=receiverSourcesForHistory(source,priorSources,counterpartSelection);
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
    const raw=JSON.stringify(receipt,null,2)+'\n';
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
    const attachments=await docket.emptyDocketAttachments(after),options={expectedReceiverSources,expectedMissionId:before.missionId};
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
  const args=process.argv.slice(2);
  assert.ok(args.length===6||args.length===8,'Use six arguments, optionally followed by COUNTERPART_JSON COUNTERPART_SHA256');
  const [capsule,workspaceFile,requestFile,campaignDigest,manifestFile,output,counterpartFile,counterpartSha256]=args;
  assert.ok(capsule&&workspaceFile&&requestFile&&campaignDigest&&manifestFile&&output,
    'Use CAPSULE WORKSPACE_JSON ORIGINAL_REQUEST_JSON CAMPAIGN_DIGEST RELEASE_MANIFEST_JSON ABSENT_OUTPUT');
  assert.ok(path.isAbsolute(output)&&!fs.existsSync(output),'An absent absolute output directory is required');
  const manifest=JSON.parse(decodeUtf8(boundedSource(path.resolve(manifestFile))));
  assert.equal(manifest.releaseProfile,'manager-discovery-release-v1');
  let counterpartSelection=null;
  if(counterpartFile!==undefined) {
    assert.match(counterpartSha256,/^[a-f0-9]{64}$/,'An independently selected counterpart record SHA-256 is required');
    const raw=boundedSource(path.resolve(counterpartFile));
    assert.equal(sha(raw),counterpartSha256,'Counterpart record differs from independently selected provenance');
    counterpartSelection=JSON.parse(decodeUtf8(raw));
  }
  const result=await inspectInstalledRequest(path.resolve(capsule),decodeUtf8(boundedSource(path.resolve(workspaceFile))),
    decodeUtf8(boundedSource(path.resolve(requestFile))),campaignDigest,manifest,counterpartSelection);
  fs.mkdirSync(output);
  const files={'original-request.json':result.original,'raw-receipt.json':result.rawReceipt,
    'receipt-wrapper.json':JSON.stringify(result.wrapper,null,2)+'\n','workspace-after.json':JSON.stringify(result.workspace),
    'docket.json':result.docket,'docket-reopened.json':result.reopenedDocket};
  for(const [name,raw] of Object.entries(files))fs.writeFileSync(path.join(output,name),raw,{flag:'wx'});
  console.log(JSON.stringify({receiptId:result.receiptId,authority:result.authority,externalExecution:result.externalExecution}));
}
