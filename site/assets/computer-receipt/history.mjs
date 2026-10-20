// SPDX-License-Identifier: MIT
import {canonical,parseStrict,sha256,keys,fail} from '../successor/safe.mjs';
import {createComputerReceiptDraft,inspectComputerReceiptDraft} from './adapter.mjs';
import {inspectComputerHandoff,inspectComputerReturn,inspectComputerReceiptEvidence,retainComputerHandoff,importComputerReturn,inspectComputerHistory,inspectLearningArchive,projectContains} from './inspectors.mjs';
export const HISTORY_SCHEMA='agijobmanager/computer-project-history/v1';
export const HISTORY_LIMIT=16_000_000;
const options=Object.freeze({inspectAlphaReturn:inspectComputerReturn,inspectComputerEvidence:inspectComputerReceiptEvidence});
const scope={authority:'none',inactive:true,settlement:'not-connected',productionQualified:false};
const same=(a,b)=>canonical(a)===canonical(b);
export const BROWSER_STORAGE_PREFIX='agi-manager/computer-history/v1:';
async function encode(body){const raw=canonical({...body,sha256:await sha256(body)});fail(new TextEncoder().encode(raw).length<=HISTORY_LIMIT,'COMPUTER_HISTORY_SIZE');return raw;}
async function inspectHistorySource(raw){
  const value=parseStrict(raw,HISTORY_LIMIT);
  if(['successor-alpha-learning-archive/v1','successor-alpha-learning-archive/v2'].includes(value?.schema)){
    const checked=await inspectLearningArchive(raw);
    return {project:checked.project,records:checked.checkedComputer?.records??[],historyRaw:checked.computerHistoryRaw??null,archiveRaw:raw};
  }
  const checked=await inspectComputerHistory(raw);return {...checked,historyRaw:raw};
}
export async function mergeNativeHistory(leftRaw,rightRaw){
  if(leftRaw===null&&rightRaw===null)return null;
  if(leftRaw===null)return (await inspectComputerHistory(rightRaw),rightRaw);
  if(rightRaw===null)return (await inspectComputerHistory(leftRaw),leftRaw);
  const left=await inspectComputerHistory(leftRaw),right=await inspectComputerHistory(rightRaw);
  fail(left.project.id===right.project.id,'COMPUTER_HISTORY_PROJECT');
  const project=projectContains(right.project,left.project)?right.project:projectContains(left.project,right.project)?left.project:null;
  fail(project,'COMPUTER_HISTORY_FORK');
  const records=left.records.map(record=>({...record}));
  for(const item of right.records){
    const existing=records.find(record=>same(parseStrict(record.handoffRaw),parseStrict(item.handoffRaw)));
    if(!existing){records.push({...item});continue;}
    fail(existing.handoffRaw===item.handoffRaw,'COMPUTER_HISTORY_EXACT_HANDOFF');
    fail(existing.returnRaw===null||item.returnRaw===null||existing.returnRaw===item.returnRaw,'COMPUTER_HISTORY_EXACT_RETURN');
    fail(existing.review===null||item.review===null||same(existing.review,item.review),'COMPUTER_HISTORY_REVIEW_CONFLICT');
    if(existing.returnRaw===null)existing.returnRaw=item.returnRaw;
    if(existing.review===null)existing.review=item.review;
  }
  const raw=canonical({schema:left.schema,project,records,authority:'none',settlement:'not_connected'});
  await inspectComputerHistory(raw);return raw;
}
export async function inspectHistory(raw){
  const value=parseStrict(raw,HISTORY_LIMIT);
  keys(value,['schema','alphaHistoryRaw','nativeHistorySources','drafts','authority','inactive','settlement','productionQualified','sha256'],'COMPUTER_HISTORY_FIELDS');
  fail(value.schema===HISTORY_SCHEMA&&Object.entries(scope).every(([key,item])=>value[key]===item),'COMPUTER_HISTORY_SCOPE');
  const {sha256:recorded,...body}=value;
  fail(typeof recorded==='string'&&recorded===await sha256(body)&&raw===canonical(value),'COMPUTER_HISTORY_INTEGRITY');
  fail(Array.isArray(value.drafts)&&value.drafts.length>=1&&value.drafts.length<=8&&new Set(value.drafts).size===value.drafts.length,'COMPUTER_HISTORY_DRAFTS');
  const native=await inspectComputerHistory(value.alphaHistoryRaw),drafts=[],originalAlphaArchives=[];
  fail(Array.isArray(value.nativeHistorySources)&&value.nativeHistorySources.length<=8&&new Set(value.nativeHistorySources).size===value.nativeHistorySources.length,'COMPUTER_HISTORY_SOURCES');
  for(const sourceRaw of value.nativeHistorySources){const source=await inspectHistorySource(sourceRaw);fail(projectContains(native.project,source.project),'COMPUTER_HISTORY_PROJECT');if(source.archiveRaw)originalAlphaArchives.push(source.archiveRaw);for(const record of source.records){const retained=native.records.find(item=>item.handoffRaw===record.handoffRaw);fail(retained&&(record.returnRaw===null||retained.returnRaw===record.returnRaw)&&(record.review===null||same(retained.review,record.review)),'COMPUTER_HISTORY_SOURCE_RECORD');}}
  for(const draftRaw of value.drafts){
    const draft=await inspectComputerReceiptDraft(draftRaw,options);
    fail(draft.project.id===native.project.id,'COMPUTER_HISTORY_PROJECT');
    fail(native.records.some(record=>record.handoffRaw===draft.original.handoffRaw&&record.returnRaw===draft.original.returnRaw),'COMPUTER_HISTORY_NATIVE_RECORD');
    drafts.push(draft);
  }
  return {value,native,project:native.project,drafts,originalAlphaArchives,raw};
}
export async function prepareHistory(supplied,{budgetUSDC,createdAt,priorRaw=null,alphaHistoryRaw=null}={}){
  const prior=priorRaw===null?null:await inspectHistory(priorRaw);
  const draftRaw=await createComputerReceiptDraft(supplied,{...options,budgetUSDC,createdAt});
  const checked=await inspectComputerHandoff(supplied.handoffRaw);
  const source=alphaHistoryRaw===null?null:await inspectHistorySource(alphaHistoryRaw);
  let retained=await mergeNativeHistory(prior?.value.alphaHistoryRaw??null,source?.historyRaw??null);
  let dossier=checked.project;
  if(source){fail(source.project.id===dossier.id,'COMPUTER_HISTORY_PROJECT');if(projectContains(source.project,dossier))dossier=source.project;else fail(projectContains(dossier,source.project),'COMPUTER_HISTORY_FORK');}
  if(retained){const native=await inspectComputerHistory(retained);fail(native.project.id===dossier.id,'COMPUTER_HISTORY_PROJECT');
    if(projectContains(native.project,dossier))dossier=native.project;else fail(projectContains(dossier,native.project),'COMPUTER_HISTORY_FORK');
    const existing=native.records.find(record=>same(parseStrict(record.handoffRaw),checked.handoff));
    if(existing){fail(existing.handoffRaw===supplied.handoffRaw,'COMPUTER_HISTORY_EXACT_HANDOFF');fail(existing.returnRaw===null||existing.returnRaw===supplied.returnRaw,'COMPUTER_HISTORY_EXACT_RETURN');}
  }
  retained=await retainComputerHandoff(dossier,supplied.handoffRaw,{priorRecord:retained});
  retained=await importComputerReturn(dossier,supplied.handoffRaw,supplied.returnRaw,{priorRecord:retained});
  const drafts=[...(prior?.value.drafts??[])];if(!drafts.includes(draftRaw))drafts.push(draftRaw);
  const nativeHistorySources=[...(prior?.value.nativeHistorySources??[])];if(alphaHistoryRaw&&!nativeHistorySources.includes(alphaHistoryRaw))nativeHistorySources.push(alphaHistoryRaw);
  const raw=await encode({schema:HISTORY_SCHEMA,alphaHistoryRaw:retained,nativeHistorySources,drafts,...scope});
  return inspectHistory(raw);
}
export function preservesHistory(previous,next){
  if(!projectContains(next.project,previous.project))return false;
  if(!previous.value.drafts.every(raw=>next.value.drafts.includes(raw))||!previous.value.nativeHistorySources.every(raw=>next.value.nativeHistorySources.includes(raw)))return false;
  return previous.native.records.every(old=>next.native.records.some(record=>record.handoffRaw===old.handoffRaw&&(old.returnRaw===null||record.returnRaw===old.returnRaw)&&(old.review===null||same(record.review,old.review))));
}
export async function saveBrowserHistory(raw,{storage=globalThis.localStorage,locks=globalThis.navigator?.locks}={}){
  const next=await inspectHistory(raw);
  fail(locks&&typeof locks.request==='function','ATOMIC_BROWSER_STORAGE_UNAVAILABLE');
  const key=BROWSER_STORAGE_PREFIX+next.project.id;
  return locks.request(key,{mode:'exclusive'},async()=>{
    const previousRaw=storage.getItem(key);
    if(previousRaw!==null&&previousRaw!==next.raw){const previous=await inspectHistory(previousRaw);fail(preservesHistory(previous,next),'REOPEN_EXISTING_HISTORY_FIRST');}
    storage.setItem(key,next.raw);return next;
  });
}
