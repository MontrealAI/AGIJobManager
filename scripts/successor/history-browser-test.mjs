import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {builderArtifacts} from './build.mjs';
import {defaultMission} from '../../site/assets/successor/missions.mjs';
import {createSystem,runCandidate,chooseCandidate,appendEvent,exportCapsule,historyEvents} from '../../site/assets/successor/model.mjs';
import {sha256} from '../../site/assets/successor/safe.mjs';
const {chromium}=await import(process.env.SUCCESSOR_PLAYWRIGHT || '@playwright/test');
const directory=path.resolve(process.env.SUCCESSOR_HISTORY_EVIDENCE || 'build/successor-history-browser');fs.mkdirSync(directory,{recursive:true});
const artifacts=builderArtifacts(),results=[],server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(artifacts.pages[req.url==='/fr'?'fr':'en']);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.SUCCESSOR_CHROMIUM?{executablePath:process.env.SUCCESSOR_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
async function checkpoint(lang,count){let run=await runCandidate(await createSystem(defaultMission('analyst',lang)),'baseline',artifacts.sourceManifest.engineSha256),state=await chooseCandidate(run.state,run.candidate.id,'keep');run=await runCandidate(state,'improved',artifacts.sourceManifest.engineSha256);state=await chooseCandidate(run.state,run.candidate.id,'replace');while(state.chronicle.length<count)await appendEvent(state,'restored','0'.repeat(64));return state;}
async function download(page,id,label){const pending=page.waitForEvent('download');await page.locator('#'+id).click();const file=await pending,destination=path.join(directory,label);await file.saveAs(destination);return {destination,raw:fs.readFileSync(destination,'utf8')};}
async function restore(page,raw){await page.locator('#import-file').evaluate(element=>element.closest('details').open=true);await page.locator('#import-file').setInputFiles({name:'checkpoint.json',mimeType:'application/json',buffer:Buffer.from(raw)});await page.locator('#restore-preview').waitFor({state:'visible'});await page.locator('#restore-consent').check();await page.locator('#restore').click();await page.locator('#history-capacity').waitFor({state:'visible'});assert.equal(await page.locator('#error').isVisible(),false);}
try{
for(const lang of ['en','fr'])for(const count of [98,99,100]){
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(origin))external.push(request.url());});
 await context.route('**/*',route=>/^https?:/.test(route.request().url())&&!route.request().url().startsWith(origin)?route.abort():route.continue());
 await context.addInitScript(()=>{window.__walletCalls=0;window.ethereum={request(){window.__walletCalls++;throw Error('No wallet authority');}};});
 await page.goto(origin+'/'+lang);const state=await checkpoint(lang,count),raw=await exportCapsule(state,artifacts.sourceManifest);await restore(page,raw);
 assert.deepEqual(JSON.parse((await download(page,'download-capsule',`restored-${lang}-${count}.json`)).raw).payload.state,state);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'390px history controls must reflow');assert.equal(await page.locator('#history-warning').getAttribute('role'),'alert');assert.equal(await page.locator('#rollback').isDisabled(),count===100);
 if(count===100){await page.locator('#public-consent').check();await page.locator('#run').click();await page.locator('#error').waitFor({state:'visible'});assert.ok((await page.locator('#error').textContent()).includes('HISTORY_LIMIT'));assert.equal(await page.locator('#download-capsule').isEnabled(),true);}
 const pending=page.waitForEvent('download');await page.locator('#history-consent').check();await page.locator('#continue-history').click();const file=await pending,oldPath=path.join(directory,`previous-${lang}-${count}.json`);await file.saveAs(oldPath);assert.deepEqual(JSON.parse(fs.readFileSync(oldPath,'utf8')).payload.state,state);
 await page.waitForFunction(()=>document.querySelector('#history-warning').textContent.includes('1/100'));
 const continued=JSON.parse((await download(page,'download-capsule',`continued-${lang}-${count}.json`)).raw);assert.equal(continued.format,'successor-portable/2');assert.deepEqual(historyEvents(continued.payload.state).slice(0,count),state.chronicle);assert.equal(continued.payload.state.active,state.active);assert.equal(continued.payload.state.authority,'none');
 await page.locator('#public-consent').check();await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#history-warning').textContent.includes('2/100'));await page.frameLocator('#preview').getByText(/identical-id-once/).waitFor();
 await page.locator('#rollback').click();await page.frameLocator('#preview').getByText(/every-row/).waitFor();
 const saved=await download(page,'download-html',`offline-${lang}-${count}.html`),offlineContext=await browser.newContext({acceptDownloads:true}),offline=await offlineContext.newPage();
 await offlineContext.route('**/*',route=>/^https?:/.test(route.request().url())?route.abort():route.continue());await offline.goto(pathToFileURL(saved.destination).href);await offline.locator('#restore-preview').waitFor({state:'visible'});await offline.locator('#restore-consent').check();await offline.locator('#restore').click();await offline.locator('#history-capacity').waitFor({state:'visible'});await offline.locator('#public-consent').check();await offline.locator('#run').click();await offline.waitForFunction(()=>document.querySelector('#history-warning').textContent.includes('4/100'));assert.equal(await offline.locator('#error').isVisible(),false);
 const final=JSON.parse((await download(offline,'download-capsule',`offline-restored-${lang}-${count}.json`)).raw);assert.equal(final.payload.state.archives[0].events.length,count);assert.equal(final.payload.state.active,state.candidates[0].id);assert.equal(final.payload.state.authority,'none');
 if(count===100){const overflow=structuredClone(state),record={sequence:100,action:'restored',subject:'0'.repeat(64),previous:state.chronicle.at(-1).sha256};overflow.chronicle.push({...record,sha256:await sha256(record)});const payload={state:overflow,sourceManifest:null},bad={format:'successor-portable/1',payload,sha256:await sha256(payload)};await page.locator('#import-file').setInputFiles({name:'overflow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.locator('#error').waitFor({state:'visible'});assert.equal(await page.locator('#restore-preview').isVisible(),false);
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};});await page.locator('#save').click();await page.locator('#error').waitFor({state:'visible'});assert.ok((await page.locator('#error').textContent()).includes('STORAGE'));assert.equal(await page.locator('#download-capsule').isEnabled(),true);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(await page.evaluate(()=>window.__walletCalls),0);results.push({lang,count,restoredWithoutSlot:true,archivedWithoutLoss:true,hostedRerun:true,earlierRollback:true,savedOfflineRestoreRerun:true,authority:'none',overflowAndInjectedQuota:count===100});
 await offlineContext.close();await context.close();
}
fs.writeFileSync(path.join(directory,'evidence.json'),JSON.stringify({node:process.version,browser:browser.version(),sourceManifest:artifacts.sourceManifest,scope:'actual generated hosted and downloaded standalone HTML; deterministic local work; no provider, signer, physical host, installer, elapsed endurance or independent user session',results},null,2)+'\n');console.log('History browser checks passed: '+results.length+' hosted and saved-offline scenarios; Chromium '+browser.version());
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
