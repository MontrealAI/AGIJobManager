const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../ui/agijobmanager-usdc.html'), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert(a >= 0 && b > a); return html.slice(a, b);
}
function harness() {
  const nodes = {}, stored = new Map(), requests = [], notices = [];
  const el = id => nodes[id] ||= {value:'', checked:false, disabled:false, textContent:'', classList:{add(){}, remove(){}}, setAttribute(){}, focus(){}};
  const storage = {getItem:key=>stored.get(key) ?? null, setItem:(key,value)=>stored.set(key,String(value)), removeItem:key=>stored.delete(key), key:i=>[...stored.keys()][i], get length(){return stored.size;}};
  el('ipfsMode').value = 'custom-json-endpoint'; el('ipfsEndpoint').value = 'https://upload.example/public'; el('jobTitle').value = 'Reviewed job';
  const ctx = vm.createContext({URL, el, localStorage:storage, document:{activeElement:null},
    setToast:(...args)=>notices.push(args), slugify:value=>value,
    buildJobMetadata:async()=>({name:el('jobTitle').value, properties:{title:el('jobTitle').value}}),
    updateMetadataPreview(){}, lastGeneratedMetadata:{name:'stale preview'}, lastUploadedMetadataURI:'',
    fetch:async(url, options)=>{requests.push({url,options}); return {ok:true,json:async()=>({cid:'bafy-public-receipt'})};},
    AGI_JOB_MANAGER:'manager-a', userAccount:'account-a'});
  vm.runInContext(section('function reviewedUploadEndpoint(', 'function fillDetailsFromBuilder('), ctx);
  vm.runInContext(section('const completionDrafts =', 'function runBondMathSelfTests('), ctx);
  return {ctx,el,stored,requests,notices};
}
const tick = () => new Promise(resolve=>setImmediate(resolve));

describe('USDC console privacy boundaries', () => {
  it('does not upload before a fresh explicit content review, including a forged confirm call', async () => {
    const h=harness(), pending=h.ctx.uploadMetadataToIPFS(); await tick();
    assert.equal(h.el('publicUploadReviewAccepted').checked,false);
    h.ctx.closePublicUploadReview(true); await tick();
    assert.equal(h.requests.length,0);
    h.ctx.closePublicUploadReview(false); await pending;
    assert.equal(h.requests.length,0);
  });
  it('sends exactly the fresh reviewed JSON and endpoint even when fields change during review', async () => {
    const h=harness(), pending=h.ctx.uploadMetadataToIPFS(); await tick();
    const reviewed=h.el('publicUploadReviewPayload').textContent;
    assert.equal(JSON.parse(reviewed).name,'Reviewed job');
    h.el('jobTitle').value='Unreviewed replacement'; h.el('ipfsEndpoint').value='https://different.example/upload';
    h.el('publicUploadReviewAccepted').checked=true; h.ctx.closePublicUploadReview(true); await pending;
    assert.equal(h.requests.length,1);
    assert.equal(h.requests[0].url,'https://upload.example/public');
    assert.equal(h.requests[0].options.body,reviewed);
    assert.equal(h.requests[0].options.credentials,'omit');
    assert.equal(h.requests[0].options.referrerPolicy,'no-referrer');
    assert.equal(h.requests[0].options.redirect,'error');
    assert.equal(h.requests[0].options.headers.Authorization,undefined);
    const next=h.ctx.uploadMetadataToIPFS(); await tick();
    assert.equal(h.el('publicUploadReviewAccepted').checked,false);
    h.ctx.closePublicUploadReview(); await next;
    assert.equal(h.requests.length,1);
  });
  it('rejects unsafe or wrong-provider credential endpoints before any request', async () => {
    for(const endpoint of ['http://api.pinata.cloud/upload','https://user:pass@api.pinata.cloud/upload','https://api.pinata.cloud/upload?token=secret','https://attacker.example/upload']){
      const h=harness(); h.el('ipfsMode').value='pinata-jwt'; h.el('ipfsJwt').value='test-credential'; h.el('ipfsEndpoint').value=endpoint;
      await assert.rejects(h.ctx.uploadMetadataToIPFS());
      assert.equal(h.requests.length,0); assert.equal(h.el('ipfsJwt').value,'');
    }
  });
  it('never places the JWT in the review payload and clears it after the authorized upload', async () => {
    const h=harness(); h.el('ipfsMode').value='pinata-jwt'; h.el('ipfsEndpoint').value='https://api.pinata.cloud/pinning/pinJSONToIPFS'; h.el('ipfsJwt').value='test-credential';
    const pending=h.ctx.uploadMetadataToIPFS(); await tick();
    assert.equal(h.el('publicUploadReviewPayload').textContent.includes('test-credential'),false);
    h.el('publicUploadReviewAccepted').checked=true; h.ctx.closePublicUploadReview(true); await pending;
    assert.equal(h.requests[0].options.headers.Authorization,'Bearer test-credential');
    assert.equal(h.el('ipfsJwt').value,''); assert.equal(h.stored.size,0);
  });
  it('removes legacy saved credentials and persists only the chosen endpoint settings', () => {
    const h=harness(), key='agijobmanager_usdc_v096_ipfs_prefs_v11';
    h.stored.set(key,JSON.stringify({mode:'pinata-jwt',endpoint:'https://api.pinata.cloud/pinning/pinJSONToIPFS',jwt:'old-secret',pinName:'old-private-name'}));
    h.ctx.loadIpfsPrefs(); assert.equal(h.el('ipfsJwt').value,'');
    assert.equal(h.stored.get(key).includes('old-secret'),false); assert.equal(h.stored.get(key).includes('old-private-name'),false);
    h.el('ipfsJwt').value='new-secret'; h.ctx.saveIpfsPrefs(); assert.equal(h.stored.get(key).includes('new-secret'),false);
  });
  it('keeps completion drafts in memory and isolates account, manager and job', () => {
    const h=harness(); h.el('completionUriInput').value='ipfs://receipt'; h.ctx.saveCompletionDraft(0);
    assert.equal(h.ctx.loadCompletionDraft(0).uri,'ipfs://receipt'); assert.equal(h.stored.size,0);
    h.ctx.userAccount='account-b'; assert.equal(h.ctx.loadCompletionDraft(0).uri,undefined);
    h.ctx.userAccount='account-a'; h.ctx.AGI_JOB_MANAGER='manager-b'; assert.equal(h.ctx.loadCompletionDraft(0).uri,undefined);
    h.ctx.AGI_JOB_MANAGER='manager-a'; assert.equal(h.ctx.loadCompletionDraft(1).uri,undefined);
    assert.equal(h.ctx.loadCompletionDraft(0).uri,'ipfs://receipt');
  });
});
