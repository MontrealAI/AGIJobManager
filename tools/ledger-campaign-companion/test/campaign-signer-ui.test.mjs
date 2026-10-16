import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { SigningKey, Transaction, computeAddress } from 'ethers';
import { policyDigest, attachAndValidateSignature } from '../src/envelope.mjs';
import { CHANNEL_FORMAT } from '../src/campaign-protocol.mjs';
const bundle = await build({entryPoints:[new URL('../src/campaign-signer.mjs',import.meta.url).pathname],write:false,bundle:true,platform:'browser',format:'iife',plugins:[{name:'synthetic-campaign-device',setup(b){b.onResolve({filter:/^\.\/device\.mjs$/},()=>({path:'synthetic',namespace:'test-only'}));b.onLoad({filter:/.*/,namespace:'test-only'},()=>({contents:`export const makeCampaignUsbSigner=()=>({sign:p=>globalThis.synthetic(p),cancel(){},close(){}})`,loader:'js'}));}}]});
function harness({late=false,error=false}={}) {
 const key=new SigningKey(`0x${'11'.repeat(32)}`),expiry=Date.parse('2030-01-01T00:00:00.000Z'),clock={now:expiry-60000};
 const tx=Transaction.from({type:2,chainId:1,nonce:0,to:null,data:'0x60006000f3',gasLimit:500000,maxFeePerGas:1000000000n,maxPriorityFeePerGas:1n});
 const review={chainId:'1',expectedSender:computeAddress(key.publicKey),expiresAt:new Date(expiry).toISOString(),maxGasLimit:'500000',maxFeePerGas:'1000000000',maxPriorityFeePerGas:'1',maxTotalFeeWei:'500000000000000',maxValueWei:'0',operationId:'synthetic-child-ui',sourceSha256:`0x${'42'.repeat(32)}`};
 const packet={unsignedHex:tx.unsignedSerialized,expectedUnsignedHash:tx.unsignedHash,expectedPolicyHash:policyDigest(review,tx.unsignedHash),review};
 const names=['signerStatus','signerSummary','path','deviceAck','signCampaign','cancelCampaign','downloadRecovery','downloadImport'];
 const elements=Object.fromEntries(names.map(id=>[id,{textContent:'',value:'',checked:false,disabled:true,addEventListener(type,fn){this[type]=fn}}]));
 const events={},messages=[],files=[],urls=new Map();let calls=0;
 const parent={},window={parent,location:{origin:'http://127.0.0.1:4174'},addEventListener(type,fn){events[type]=fn}};
 const context={document:{getElementById:id=>elements[id],querySelector:()=>({content:'http://127.0.0.1:4173'}),createElement:()=>({click(){files.push(urls.get(this.href))}})},window,TextEncoder,Blob,Date:class extends Date{static now(){return clock.now}},setTimeout(fn){fn()},URL:class extends URL{static createObjectURL(blob){urls.set('private:blob',blob);return'private:blob'}static revokeObjectURL(){}},synthetic(prepared){calls++;if(error)throw new Error('PRIVATE_DEVICE_RESPONSE_MUST_NOT_APPEAR_0xdeadbeef');if(late)clock.now=expiry;return Promise.resolve(attachAndValidateSignature(prepared,key.sign(prepared.expectedUnsignedHash),clock.now))}};
 runInNewContext(bundle.outputFiles[0].text,context);
 const port={postMessage(value){messages.push(value)},start(){},close(){}};const nonce='ab'.repeat(32);
 const connect=(origin='http://127.0.0.1:4173')=>events.message({source:parent,origin,data:{format:CHANNEL_FORMAT,type:'connect',nonce},ports:[port]});
 const send=(type,extra={})=>port.onmessage({data:{format:CHANNEL_FORMAT,type,nonce,...extra}});
 return{elements,packet,clock,expiry,messages,files,connect,send,port,calls:()=>calls};
}
const ready=h=>{h.connect();h.send('prepare',{prepared:h.packet});h.elements.path.value="44'/60'/0'/0/0";h.elements.deviceAck.checked=true;h.elements.deviceAck.change()};
test('child rejects sibling/foreign parent origins before authenticated cross-origin channel',()=>{const h=harness();h.connect('http://127.0.0.1:4174');assert.equal(h.messages.length,0);h.connect('https://example.com');assert.equal(h.messages.length,0);h.connect();assert.equal(h.messages[0].type,'ready')});
test('child preserves private signed result and prevents second prompt until durable canonical advance',async()=>{const h=harness();ready(h);await h.elements.signCampaign.onclick();assert.equal(h.calls(),1);const signed=h.messages.find(x=>x.type==='signed');assert.ok(signed.capability.signedTransaction);assert.equal(h.elements.downloadRecovery.disabled,false);assert.ok(!Object.values(h.elements).map(x=>x.textContent).join('').includes(signed.capability.signedTransaction));h.send('prepare',{prepared:h.packet});await h.elements.signCampaign.onclick();assert.equal(h.calls(),1);h.elements.downloadRecovery.onclick();assert.equal(h.files.length,1);assert.equal(JSON.parse(await h.files[0].text()).format,'mainnet-ledger-signed-capability-v1');h.send('advance',{identity:signed.identity,verified:true});assert.match(h.elements.signerStatus.textContent,/VERIFIED_ADVANCE_REQUIRED/);h.send('durable',{identity:signed.identity,transactionHash:signed.capability.transactionHash});h.send('advance',{identity:signed.identity,verified:true});h.send('prepare',{prepared:h.packet});assert.equal(h.elements.deviceAck.checked,false)});
test('late signature reaches durable handoff but import export stays refused and full recovery survives',async()=>{const h=harness({late:true});ready(h);await h.elements.signCampaign.onclick();const signed=h.messages.find(x=>x.type==='signed');assert.equal(signed.capability.status,'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY');assert.equal(signed.importAvailable,false);assert.equal(h.elements.downloadRecovery.disabled,false);assert.equal(h.elements.downloadImport.disabled,true)});
test('raw device error is redacted and a failed attempt cannot reprompt',async()=>{const h=harness({error:true});ready(h);await h.elements.signCampaign.onclick();assert.equal(h.calls(),1);assert.doesNotMatch(h.elements.signerStatus.textContent,/PRIVATE_DEVICE_RESPONSE|deadbeef/);assert.match(h.elements.signerStatus.textContent,/OPERATION_STOPPED_RECOVERY_REQUIRED/);await h.elements.signCampaign.onclick();assert.equal(h.calls(),1)});
test('click-time expiry stops before device access',async()=>{const h=harness();ready(h);h.clock.now=h.expiry;await h.elements.signCampaign.onclick();assert.equal(h.calls(),0);assert.match(h.elements.signerStatus.textContent,/INTENT_EXPIRED/);assert.equal(h.elements.signCampaign.disabled,true)});

test('parent stop message disables a prepared child before device access while retaining its intent',async()=>{const h=harness();ready(h);h.send('block',{code:'CAMPAIGN_STOPPED_RECOVERY_REQUIRED'});assert.equal(h.elements.signCampaign.disabled,true);await h.elements.signCampaign.onclick();assert.equal(h.calls(),0);assert.match(h.elements.signerStatus.textContent,/CAMPAIGN_STOPPED_RECOVERY_REQUIRED/)});

for (const [format, schema, mime] of [['manager-json','manager-external-signing-handoff-v1','application/json'], ['alpha-raw','agialpha.external-signing-handoff.v1','text/plain']]) {
 test(`campaign download uses exact ${schema} private import bytes`, async()=>{
  const h=harness(); h.connect();h.send('prepare',{prepared:h.packet,importFormat:format});h.elements.path.value="44'/60'/0'/0/0";h.elements.deviceAck.checked=true;h.elements.deviceAck.change();
  await h.elements.signCampaign.onclick();h.elements.downloadImport.onclick();
  const cap=h.messages.find(x=>x.type==='signed').capability;assert.equal(h.files.length,1);assert.equal(h.files[0].type,mime);
  const text=await h.files[0].text();assert.equal(format==='alpha-raw'?text:JSON.parse(text).raw,cap.signedTransaction);
  h.clock.now=h.expiry;h.elements.downloadImport.onclick();assert.equal(h.files.length,1);assert.match(h.elements.signerStatus.textContent,/EXPIRED/);
 });
}
test('unqualified download format remains unavailable and unknown format is rejected',async()=>{
 const h=harness();ready(h);await h.elements.signCampaign.onclick();assert.equal(h.elements.downloadImport.disabled,true);h.elements.downloadImport.onclick();assert.equal(h.files.length,0);
 const other=harness();other.connect();other.send('prepare',{prepared:other.packet,importFormat:'jobs-raw'});assert.match(other.elements.signerStatus.textContent,/CHANNEL_MESSAGE_REJECTED/);assert.equal(other.calls(),0);
});
