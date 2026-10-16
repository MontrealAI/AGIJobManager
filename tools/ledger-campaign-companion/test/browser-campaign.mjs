import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createBrowserCampaignFixture } from './fixtures/browser/campaign.mjs';
export async function runCampaignBrowserTests({browser,directory,test,rawMarkers,logs,remoteRequests,errors}) {
  async function fixture(options, run) {
    const privateDirectory = await mkdtemp(resolve(tmpdir(),'companion-campaign-browser-private-'));
    let campaign,context;
    try {
      campaign=await createBrowserCampaignFixture({staticRoot:directory,privateDirectory,...options,expireOnImport:options?.deviceMode==='expire-after-approval'});
      context=await browser.newContext({acceptDownloads:options?.downloads!==false});context.setDefaultTimeout(10000);
      await context.addInitScript(({mode})=>{const now=Date.now.bind(Date);Object.defineProperty(globalThis,'__COMPANION_BROWSER_TEST__',{value:{testOnly:true,mode},configurable:false});Date.now=()=>__COMPANION_BROWSER_TEST__.now??now();Object.defineProperty(navigator,'hid',{get(){throw new Error('ACTUAL_USB_MUST_NEVER_BE_CALLED');},configurable:false});},{mode:options?.deviceMode??'success'});
      context.on('page',p=>{p.on('dialog',dialog=>dialog.accept());p.on('console',message=>logs.push(message.text()));p.on('pageerror',error=>errors.push(error.message));p.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:'))remoteRequests.push(request.url().split('?')[0]);});});
      const p=await context.newPage();await p.goto(campaign.server.parentOrigin);await p.waitForFunction(()=>!document.getElementById('campaignStatus').textContent.startsWith('Connecting'));
      await run({...campaign,p,context,privateDirectory});
    } finally {await context?.close();await campaign?.close();await rm(privateDirectory,{recursive:true,force:true});}
  }
  async function prepare(p) {await p.locator('#campaignAck').check();await p.locator('#prepareNext').click();await p.waitForFunction(()=>{const f=document.getElementById('signFrame');return !f.hidden&&f.src.includes('campaign-signer.html');});const frame=p.frameLocator('#signFrame');await frame.locator('#signerSummary').filter({hasText:'Ethereum Mainnet'}).waitFor();return frame;}
  async function sign(frame) {await frame.locator('#path').fill("44'/60'/0'/0/0");await frame.locator('#deviceAck').check();await frame.locator('#signCampaign').click();}
  await test('campaign-two-origin-isolation-and-truthful-qualification',()=>fixture({},async({p,server,counters})=>{
    assert.match(await p.locator('#campaignSummary').textContent(),/USDC · 6 decimals/);assert.match(await p.locator('#qualification').textContent(),/SYNTHETIC_ADAPTER_REAL_BRIDGE_ENGINE/);assert.match(await p.locator('#qualification').textContent(),/false/);
    const frame=await prepare(p);assert.notEqual(server.parentOrigin,server.signerOrigin);assert.equal(await p.evaluate(()=>document.getElementById('signFrame').contentDocument),null);
    const source=await frame.locator('html').evaluate(()=>({origin:location.origin,parentMeta:document.querySelector('meta[name="campaign-parent-origin"]').content}));assert.equal(source.origin,server.signerOrigin);assert.equal(source.parentMeta,server.parentOrigin);
    assert.equal(counters.prepare,1);assert.equal(counters.import,0);assert.equal(counters.relay,0);
  }));
  await test('campaign-signer-csp-denies-parent-api-and-external-egress',()=>fixture({},async({p,server})=>{
    const frame=await prepare(p);
    const value=await frame.locator('html').evaluate(async(_node,parentOrigin)=>{const violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.effectiveDirective));const blocked=[];for(const url of [`${parentOrigin}/api/status`,'https://companion-egress-probe.invalid/never-sent']){try{await fetch(url);blocked.push(false);}catch{blocked.push(true);}}await new Promise(resolve=>setTimeout(resolve,100));return {blocked,violations};},server.parentOrigin);
    assert.deepEqual(value.blocked,[true,true]);assert.ok(value.violations.filter(v=>v==='connect-src').length>=2);
  }));
  await test('campaign-automatic-private-import-no-relay-or-readiness-upgrade',()=>fixture({},async({p,counters,engine,privateDirectory})=>{
    const frame=await prepare(p);await sign(frame);await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Signed capability durably'));
    const status=await engine.status();assert.equal(status.steps[0].state,'signed');assert.equal(counters.import,1);assert.equal(counters.relay,0);assert.deepEqual(status.readiness,{authorityComplete:false,activationReady:false,physicalQualified:false});assert.equal(await p.locator('#relayExact').isDisabled(),true);
    const {readdir}=await import('node:fs/promises');const names=await readdir(privateDirectory);const name=names.find(x=>x.startsWith('signed-step-'));assert.ok(name);const cap=JSON.parse(await readFile(resolve(privateDirectory,name),'utf8'));rawMarkers.add(cap.signedTransaction);assert.equal(await frame.locator('#downloadRecovery').isEnabled(),true);assert.equal(await frame.locator('#signCampaign').isDisabled(),true);
    assert.deepEqual(await p.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
  }));
  await test('campaign-refresh-after-prepare-enters-recovery-without-second-device-prompt',()=>fixture({},async({p,counters,engine})=>{
    const frame=await prepare(p);assert.equal(await frame.locator('#downloadRecovery').isDisabled(),true);await p.reload();await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Existing durable operation'));
    assert.equal(await p.locator('#prepareNext').isDisabled(),true);assert.equal(await p.locator('#signFrame').isHidden(),true);assert.equal(counters.prepare,1);assert.equal(counters.import,0);assert.equal((await engine.status()).steps[0].state,'signing-requested');await p.locator('#recoverCampaign').click();assert.equal(counters.relay,0);assert.equal(counters.import,0);
  }));
  await test('campaign-lost-import-response-keeps-private-capability-and-refresh-recovers',()=>fixture({mode:'lost-import-response'},async({p,counters,engine})=>{
    const frame=await prepare(p);await sign(frame);await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.includes('SYNTHETIC_RESPONSE_LOST'));
    assert.equal(await frame.locator('#downloadRecovery').isEnabled(),true);assert.equal(await frame.locator('#signCampaign').isDisabled(),true);assert.equal((await engine.status()).steps[0].state,'signed');await p.reload();await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Existing durable operation'));assert.equal(await p.locator('#prepareNext').isDisabled(),true);assert.equal(counters.import,1);assert.equal(counters.prepare,1);assert.equal(counters.relay,0);
  }));
  for(const [mode,code] of [['account-mismatch','DEVICE_ADDRESS_MISMATCH'],['account-changed','SIGNER_MISMATCH'],['reject','DEVICE_ACTION_STOPPED_OR_FAILED'],['disconnect','DEVICE_ACTION_FAILED'],['raw-error','OPERATION_STOPPED_RECOVERY_REQUIRED']])await test(`campaign-${mode}-recovery-no-automatic-retry`,()=>fixture({deviceMode:mode},async({p,counters})=>{
    const frame=await prepare(p);await sign(frame);await frame.locator('#signerStatus').evaluate(async(element,code)=>{for(let attempt=0;attempt<100;attempt++){if(element.textContent.includes(code)||element.textContent.includes('CAMPAIGN_STOPPED_RECOVERY_REQUIRED'))return;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('SAFE_STOP_NOT_DISPLAYED');},code);assert.equal(await frame.locator('#downloadRecovery').isDisabled(),true);assert.equal(await frame.locator('#signCampaign').isDisabled(),true);assert.equal(counters.import,0);assert.equal(counters.relay,0);assert.equal((await p.locator('#campaignStatus').textContent()).includes('PRIVATE_DEVICE_RESPONSE'),false);
  }));
  await test('campaign-expired-signature-is-durable-recovery-only',()=>fixture({deviceMode:'expire-after-approval'},async({p,counters,engine})=>{
    const frame=await prepare(p);await sign(frame);await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Signed capability durably'));const status=await engine.status();assert.equal(status.steps[0].state,'recovery-required');assert.equal(status.steps[0].blocker,'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY');assert.equal(await frame.locator('#downloadRecovery').isEnabled(),true);assert.equal(await frame.locator('#downloadImport').isDisabled(),true);assert.equal(counters.import,0);assert.equal(counters.relay,0);
  }));
  await test('campaign-duplicate-click-and-cancel-hold-one-durable-device-attempt',()=>fixture({deviceMode:'wait'},async({p,counters})=>{
    const frame=await prepare(p);await sign(frame);await frame.locator('html').evaluate(()=>{if(__COMPANION_BROWSER_TEST__.calls!==1)throw new Error('SYNTHETIC_REQUEST_NOT_STARTED');});await frame.locator('#signCampaign').dispatchEvent('click');assert.equal(await frame.locator('html').evaluate(()=>__COMPANION_BROWSER_TEST__.calls),1);await frame.locator('#cancelCampaign').click();await frame.locator('#signerStatus').evaluate(async(element)=>{for(let attempt=0;attempt<100;attempt++){if(/DEVICE_ACTION_STOPPED_OR_FAILED|CAMPAIGN_STOPPED_RECOVERY_REQUIRED/.test(element.textContent))return;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('SAFE_STOP_NOT_DISPLAYED');});assert.equal(await frame.locator('#signCampaign').isDisabled(),true);assert.equal(counters.prepare,1);assert.equal(counters.import,0);assert.equal(counters.relay,0);
  }));
  await test('campaign-source-drift-blocks-before-device-or-import',()=>fixture({},async({p,state,counters})=>{
    state.drift=true;await p.locator('#campaignAck').check();await p.locator('#prepareNext').click();await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.includes('SOURCE_DRIFT'));assert.equal(await p.locator('#signFrame').isHidden(),true);assert.equal(counters.import,0);assert.equal(counters.relay,0);
  }));
  await test('campaign-canonical-receipt-change-stops-observation',()=>fixture({mode:'changed-receipt'},async({p,engine,counters})=>{
    const frame=await prepare(p);await sign(frame);await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Signed capability durably'));await p.locator('#recoverCampaign').click();await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.includes('CANONICAL_RESULT_CHANGED'));assert.equal((await engine.status()).steps[0].state,'recovery-required');assert.equal(counters.prepare,1);assert.equal(counters.relay,0);
  }));
  await test('campaign-two-tabs-rotate-auth-session-and-prevent-stale-actions',()=>fixture({},async({p,context,server,counters})=>{
    const second=await context.newPage();await second.goto(server.parentOrigin);await second.waitForFunction(()=>!document.getElementById('campaignStatus').textContent.startsWith('Connecting'));await p.locator('#refreshCampaign').click();await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.includes('SESSION_REQUIRED'));assert.equal(await p.locator('#prepareNext').isDisabled(),true);assert.equal(counters.prepare,0);assert.equal(counters.import,0);assert.equal(counters.relay,0);
  }));
  await test('campaign-click-time-expiry-refuses-device-after-durable-prepare',()=>fixture({},async({p,counters})=>{
    const frame=await prepare(p);await frame.locator('html').evaluate(()=>{__COMPANION_BROWSER_TEST__.now=Date.parse(JSON.parse(document.getElementById('signerSummary').textContent).expiresAt)+1;});await sign(frame);await frame.locator('#signerStatus').evaluate(async(element)=>{for(let attempt=0;attempt<100;attempt++){if(/INTENT_EXPIRED|CAMPAIGN_STOPPED_RECOVERY_REQUIRED/.test(element.textContent))return;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('SAFE_STOP_NOT_DISPLAYED');});assert.equal(counters.import,0);assert.equal(counters.relay,0);assert.equal(await frame.locator('html').evaluate(()=>__COMPANION_BROWSER_TEST__.calls??0),0);
  }));
  await test('campaign-disabled-downloads-keep-durable-recovery-without-new-signature',()=>fixture({downloads:false},async({p,counters})=>{
    const frame=await prepare(p);await sign(frame);await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Signed capability durably'));const event=p.waitForEvent('download');await frame.locator('#downloadRecovery').click();const download=await event;assert.ok(await download.failure());assert.equal(await frame.locator('#downloadRecovery').isEnabled(),true);assert.equal(await frame.locator('#signCampaign').isDisabled(),true);assert.equal(counters.import,1);assert.equal(counters.prepare,1);assert.equal(counters.relay,0);
  }));
  await test('campaign-verified-result-prepares-next-but-every-signature-needs-new-click',()=>fixture({},async({p,state,counters,engine})=>{
    const first=await prepare(p);await sign(first);await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Signed capability durably'));state.verified=true;await p.locator('#recoverCampaign').click();
    const next=p.frameLocator('#signFrame');await next.locator('#signerSummary').filter({hasText:'synthetic-campaign-1'}).waitFor();assert.equal(counters.prepare,2);assert.equal(counters.import,1);assert.equal((await engine.status()).steps[0].state,'verified');assert.equal((await engine.status()).steps[1].state,'signing-requested');
    await sign(next);await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Signed capability durably'));assert.equal(counters.import,2);assert.equal(counters.relay,0);
  }));
  await test('campaign-exact-relay-click-uses-native-ack-once-without-readiness-upgrade',()=>fixture({relayEnabled:true},async({p,counters,engine})=>{
    const frame=await prepare(p);await sign(frame);await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Signed capability durably'));assert.equal(counters.relay,0);assert.equal(await p.locator('#relayExact').isEnabled(),true);assert.match(await p.locator('#relayReview').textContent(),/SYNTHETIC_EXACT_COORDINATOR_ACK_ONLY/);await p.locator('#relayExact').click();await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Exact coordinator relay attempted once'));await p.locator('#relayExact').dispatchEvent('click');assert.equal(counters.relay,1);const status=await engine.status();assert.equal(status.steps[0].relayAttempted,true);assert.equal(status.steps[0].state,'submitted');assert.equal(status.readiness.authorityComplete,false);assert.equal(status.readiness.activationReady,false);assert.equal(await p.locator('#relayExact').isDisabled(),true);
  }));
  await test('campaign-lost-relay-response-is-read-only-recovery-with-no-second-attempt',()=>fixture({relayEnabled:true,mode:'lost-relay-response'},async({p,counters,engine})=>{
    const frame=await prepare(p);await sign(frame);await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Signed capability durably'));await p.locator('#relayExact').click();await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.includes('SYNTHETIC_RELAY_RESPONSE_LOST'));assert.equal(counters.relay,1);assert.equal((await engine.status()).steps[0].relayAttempted,true);assert.equal(await frame.locator('#downloadRecovery').isEnabled(),true);await p.reload();await p.waitForFunction(()=>document.getElementById('campaignStatus').textContent.startsWith('Existing durable operation'));assert.equal(await p.locator('#relayExact').isDisabled(),true);assert.equal(counters.relay,1);
  }));
  await test('campaign-browser-parent-has-no-arbitrary-child-dom-or-api-proxy',()=>fixture({},async({p,server,counters})=>{
    await prepare(p);const result=await p.evaluate(signerOrigin=>{let isolated=false;try{document.getElementById('signFrame').contentWindow.document.body;}catch(e){isolated=e.name==='SecurityError';}document.getElementById('signFrame').contentWindow.postMessage({format:'mainnet-ledger-campaign-channel-v1',nonce:'f'.repeat(64),type:'prepare',prepared:{raw:'PRIVATE_DEVICE_RESPONSE_MUST_NOT_APPEAR_0xdeadbeef'}},signerOrigin);return isolated;},server.signerOrigin);assert.equal(result,true);assert.equal(counters.import,0);assert.equal(counters.relay,0);
  }));
}
