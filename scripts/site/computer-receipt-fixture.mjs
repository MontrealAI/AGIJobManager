// SPDX-License-Identifier: MIT
// PROTOCOL DOUBLE ONLY: valid native envelopes, no browser/model/signature authenticity claim.
import {canonical,digest} from '../../site/assets/computer-receipt/vendor/alpha-computer/docs/assets/successor/engine.mjs';
import {exactDigest} from '../../site/assets/computer-receipt/vendor/alpha-computer/examples/successor-alpha/continuity.mjs';
import {createProject} from '../../site/assets/computer-receipt/vendor/alpha-computer/examples/successor-alpha/project.mjs';
import {createComputerHandoff} from '../../site/assets/computer-receipt/vendor/alpha-computer/examples/successor-alpha/computer.mjs';
import {createComputerMission,runComputerMission,checkComputerPlan} from '../../site/assets/computer-receipt/vendor/jobs-computer/packages/successor-core/src/computer-mission.mjs';
import {renderComputerDeskTaskHTML} from '../../site/assets/computer-receipt/vendor/jobs-computer/scripts/pages/computer-mission.mjs';
import fs from 'node:fs';
export const completeAlphaArchiveRaw=()=>fs.readFileSync(new URL('./fixtures/alpha-learning-archive-three-protocol.json',import.meta.url),'utf8');
export async function protocolInputs({project=null,report=null,state='review'}={}){
  report??=await runComputerMission(await createComputerMission(),{formulationApproval:{approved:true,ownerLabel:'Synthetic protocol fixture',reason:'Preserve staged requirements for parser and browser UI tests only.'}});
  project??=createProject({name:'Protocol-only browser history',goal:'Retain exact public synthetic allocation evidence without authority.'});
  const handoffRaw=await createComputerHandoff(project,{sourceHash:'a'.repeat(64),goal:project.goal,selected:'reframe',valueHypothesis:'Protocol consistency only; no value or execution established.',hypotheses:['A single early supplier.','A staged allocation.'],combination:'Compare exact landed costs and required delivery dates.',reframing:'Remove the extra single-delivery assumption while preserving actual requirements.',successCriteria:['Preserve exact report and program commitments.','Retain production boundaries.'],html:renderComputerDeskTaskHTML(report),inputRights:report.mission.inputRights.classification,license:report.mission.inputRights.license});
  const handoff=JSON.parse(handoffRaw),executionContext=await digest('computer-handoff',handoff),execution={provider:{mode:'responses',model:'PROTOCOL_DOUBLE_NO_BROWSER',endpoint:'https://example.invalid/v1'},image:'sha256:'+'1'.repeat(64),workerSha256:'2'.repeat(64)};
  const taskCommitment=await digest('computer-task',{task:handoff.task,provider:execution.provider,image:execution.image,worker_sha256:execution.workerSha256,execution_context:executionContext});
  const arithmetic=checkComputerPlan(report.mission,report.frozen.plan,{formulation:report.formulation});
  const observedText='PROTOCOL_DOUBLE_NO_BROWSER\nSUCCESSOR_COMPUTER_RESULT '+canonical({schemaVersion:'1.0.0',kind:'SupplierDeskResult',missionDigest:report.mission.digest,reportDigest:report.digest,frozenProgramDigest:report.frozen.programDigest,plan:report.frozen.plan,check:{valid:arithmetic.valid,totals:arithmetic.totals},formulation:report.formulation,purchaseExecuted:false});
  const receipt={run_id:crypto.randomUUID(),state,cleanup:'VERIFIED',execution_context:executionContext,commitment:taskCommitment,provider:execution.provider,authority:[],billing:'UNKNOWN',actions_reserved:1,turns_reserved:2,elapsed_milliseconds:1000,verified:false,completion_claim:'Protocol double; no browser/model execution claimed.',screenshots:[{file:'screen-000.png',sha256:'3'.repeat(64)},{file:'screen-001.png',sha256:'4'.repeat(64)}],events:[{action:{type:'screenshot'},status:'observed',turn:0}],observed_text_sha256:await exactDigest(observedText),observed_text_bytes:new TextEncoder().encode(observedText).length};
  const returnRaw=canonical({schema:'successor-alpha-computer-return/v1',handoffSha256:await exactDigest(canonical(handoff)),executionContext,projectSha256:handoff.projectSha256,sourceHash:handoff.sourceHash,taskCommitment,execution,receipt,signedReceipt:{domain:'computer-receipt',principal:'PROTOCOL_DOUBLE',payload:receipt,signature:'A'.repeat(86)+'=='},observedText,authority:'none',settlement:'not_connected',verified:false});
  return {supplied:{handoffRaw,returnRaw,reportRaw:JSON.stringify(report)},project,report};
}
