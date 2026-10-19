// SPDX-License-Identifier: MIT
import {copy} from './copy.mjs';
import {inspectHistory,prepareHistory,saveBrowserHistory,HISTORY_LIMIT,BROWSER_STORAGE_PREFIX} from './history.mjs';
const $=id=>document.getElementById(id),t=copy[document.documentElement.lang]??copy.en;
const prefix=BROWSER_STORAGE_PREFIX;let current=null,dirty=false,busy=false,revision=0;
const say=text=>{$('status').textContent=text;};
async function attempt(fn){if(busy)return;busy=true;controls();try{await fn();}catch(error){const code=error.code||error.message;say(code==='REOPEN_EXISTING_HISTORY_FIRST'?t.reopenExisting:code==='ATOMIC_BROWSER_STORAGE_UNAVAILABLE'?t.portableOnly:code==='INPUT_CHANGED_REVIEW_AGAIN'?t.inputChanged:error.name==='QuotaExceededError'?t.quota:t.blocked+': '+code);}finally{busy=false;controls();}}
async function readFile(file,maximum=4_000_000){if(!file)throw Error('FILE_REQUIRED');if(file.size>maximum)throw Error('FILE_SIZE');try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await file.arrayBuffer());}catch{throw Error('UTF8_REQUIRED');}}
function save(name,raw){const url=URL.createObjectURL(new Blob([raw],{type:'application/json;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function controls(){
  for(const id of ['handoff-file','return-file','report-file','native-history-file','public-input','budget','history-file','restore-consent','saved','new-project','download-draft','download-history','download-alpha','download-alpha-workspace','save-browser'])$(id).disabled=busy;
  $('download-alpha-workspace').hidden=!current?.originalAlphaArchives.length;
  $('prepare').disabled=busy||!$('public-input').checked||!$('budget').value||!['handoff-file','return-file','report-file'].every(id=>$(id).files.length);
  $('restore').disabled=busy||!$('restore-consent').checked||!$('history-file').files.length;
  $('reopen').disabled=busy||!$('saved').value;
}
function display(){const draft=current.drafts.at(-1);$('result').hidden=false;$('summary').textContent=[`${t.project}: ${current.project.id}`,`${t.revision}: ${current.project.revision}`,`${t.proposals}: ${current.drafts.length}`,`${t.amountLabel}: ${draft.planning.budgetUSDC} USDC`,`${t.units}: ${draft.planning.amountBaseUnits}`,`${t.state}: ${t.stateValue}`,`Project SHA-256: ${draft.project.projectSha256}`,`Native return SHA-256: ${draft.bindings.returnRawSha256}`,`${t.producerSource}: ${draft.bindings.alphaSourceHash}`].join('\n');$('summary').focus();}
function listSaved(){const selected=$('saved').value;$('saved').replaceChildren();try{const names=Object.keys(localStorage).filter(key=>key.startsWith(prefix)&&/^[a-f0-9-]{36}$/.test(key.slice(prefix.length))).sort();for(const key of names){const option=document.createElement('option');option.value=key;option.textContent=key.slice(prefix.length);$('saved').append(option);}if(names.includes(selected))$('saved').value=selected;if(!names.length){const option=document.createElement('option');option.value='';option.textContent=t.empty;$('saved').append(option);}}catch(error){say(t.blocked+': '+error.name);}controls();}
for(const id of ['handoff-file','return-file','report-file','native-history-file'])$(id).onchange=()=>{revision++;$('public-input').checked=false;controls();};
for(const id of ['public-input','budget','restore-consent','saved'])$(id).oninput=()=>{revision++;controls();};
$('history-file').onchange=()=>{revision++;$('restore-consent').checked=false;controls();};
$('prepare').onclick=()=>attempt(async()=>{
  if(!$('public-input').checked)throw Error('PUBLIC_NONPERSONAL_REQUIRED');
  const originalRevision=revision,files=['handoff-file','return-file','report-file','native-history-file'].map(id=>$(id).files[0]),budgetUSDC=$('budget').value,priorRaw=current?.raw??null;
  const supplied={handoffRaw:await readFile(files[0]),returnRaw:await readFile(files[1]),reportRaw:await readFile(files[2])};
  const checked=await prepareHistory(supplied,{budgetUSDC,createdAt:new Date().toISOString(),priorRaw,alphaHistoryRaw:files[3]?await readFile(files[3],4_000_000):null});
  if(revision!==originalRevision||!$('public-input').checked)throw Error('INPUT_CHANGED_REVIEW_AGAIN');
  current=checked;dirty=true;$('public-input').checked=false;display();say(t.prepared);
});
$('download-draft').onclick=()=>attempt(async()=>{if(!current)throw Error('HISTORY_REQUIRED');save('manager-usdc-unsigned-proposal.json',current.value.drafts.at(-1));});
$('download-history').onclick=()=>attempt(async()=>{if(!current)throw Error('HISTORY_REQUIRED');save('manager-computer-project-history.json',current.raw);dirty=false;});
$('download-alpha').onclick=()=>attempt(async()=>{if(!current)throw Error('HISTORY_REQUIRED');save('successor-alpha-computer-history.json',current.value.alphaHistoryRaw);});
$('download-alpha-workspace').onclick=()=>attempt(async()=>{const original=current?.originalAlphaArchives.at(-1);if(!original)throw Error('ALPHA_WORKSPACE_REQUIRED');save('successor-alpha-original-workspace.json',original);});
$('save-browser').onclick=()=>attempt(async()=>{if(!current)throw Error('HISTORY_REQUIRED');await saveBrowserHistory(current.raw);dirty=false;listSaved();say(t.savedOk);});
async function reopen(raw,originalRevision=revision){const checked=await inspectHistory(raw);if(revision!==originalRevision)throw Error('INPUT_CHANGED_REVIEW_AGAIN');if(current&&dirty)throw Error('SAVE_CURRENT_HISTORY_FIRST');current=checked;dirty=false;display();$('restore-consent').checked=false;say(t.restored);}
$('restore').onclick=()=>attempt(async()=>{if(!$('restore-consent').checked)throw Error('RESTORE_CONFIRMATION_REQUIRED');const originalRevision=revision,file=$('history-file').files[0];await reopen(await readFile(file,HISTORY_LIMIT),originalRevision);});
$('reopen').onclick=()=>attempt(async()=>{const key=$('saved').value;if(!key.startsWith(prefix))throw Error('HISTORY_REQUIRED');const raw=localStorage.getItem(key);if(typeof raw!=='string')throw Error('HISTORY_REQUIRED');await reopen(raw);});
$('new-project').onclick=()=>{if(busy)return;if(dirty){say(t.needSave);return;}current=null;$('result').hidden=true;for(const id of ['handoff-file','return-file','report-file','native-history-file','history-file'])$(id).value='';$('public-input').checked=false;$('restore-consent').checked=false;$('budget').value='';controls();};
window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});listSaved();controls();
