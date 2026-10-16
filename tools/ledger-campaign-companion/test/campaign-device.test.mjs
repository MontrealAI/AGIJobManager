import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { SigningKey, Transaction, computeAddress, keccak256 } from 'ethers';
import { policyDigest, validateIntent } from '../src/envelope.mjs';
const modules = {
  '@ledgerhq/device-management-kit': `export const DeviceActionStatus={Completed:'completed',Error:'error',Stopped:'stopped',Pending:'pending'}; export const DeviceStatus={NOT_CONNECTED:'NOT CONNECTED'}; export class DeviceManagementKitBuilder { addTransport(){return this} build(){globalThis.fixture.builds++;return {startDiscovering(){globalThis.fixture.pickers++;return{pipe(){return{}}}},async stopDiscovering(){},async connect(){globalThis.fixture.connects++;return 'session'},getDeviceSessionState(){return {subscribe(observer){globalThis.fixture.observer=observer;observer.next({deviceStatus:'CONNECTED'});return{unsubscribe(){}}}}},async disconnect(){globalThis.fixture.disconnects++},close(){globalThis.fixture.closes++}}}}`,
  '@ledgerhq/device-signer-kit-ethereum': `export class SignerEthBuilder { constructor(args){globalThis.fixture.builderArgs.push(Object.keys(args));} build(){const action=output=>({cancel(){globalThis.fixture.cancels++},observable:{subscribe(observer){observer.next({status:'completed',output});return{unsubscribe(){}}}}});return {getAddress(path,opts){globalThis.fixture.addresses.push({path,opts});return action({address:globalThis.fixture.address()})},signTransaction(path,bytes){globalThis.fixture.signatures++;return action(globalThis.fixture.signature(bytes))}}}}`,
  '@ledgerhq/device-transport-kit-web-hid': `export const webHidTransportFactory={};`,
  rxjs: `export const take=()=>x=>x; export const firstValueFrom=async()=>({});`
};
const bundle = await build({ entryPoints: [new URL('../src/device.mjs', import.meta.url).pathname], bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'DeviceModule', plugins: [{ name: 'synthetic-ledger-sdk-only', setup(b) { b.onResolve({ filter: /^(?:@ledgerhq\/|rxjs$)/ }, args => ({path:args.path,namespace:'synthetic-sdk'})); b.onLoad({filter:/.*/,namespace:'synthetic-sdk'}, args => ({contents:modules[args.path],loader:'js'})); } }] });
function harness() {
  const f = { builds:0,pickers:0,connects:0,disconnects:0,closes:0,cancels:0,signatures:0,addresses:[],builderArgs:[],key:new SigningKey(`0x${'11'.repeat(32)}`) };
  f.address=()=>computeAddress(f.key.publicKey); f.signature=bytes=>f.key.sign(keccak256(bytes));
  const context = { fixture:f,navigator:{hid:{}},isSecureContext:true,setTimeout,clearTimeout,queueMicrotask,Uint8Array,TextEncoder,TextDecoder,console:{log(){throw new Error('SDK log forbidden')}} };
  context.window = context; context.self = context; runInNewContext(bundle.outputFiles[0].text, context); return {f,module:context.DeviceModule};
}
function intent(f, nonce=1) {
  const tx=Transaction.from({type:2,chainId:1,nonce,to:null,data:'0x60006000f3',gasLimit:500000,maxFeePerGas:1000000000n,maxPriorityFeePerGas:1n});
  const review={chainId:'1',expectedSender:f.address(),expiresAt:'2030-01-01T00:00:00.000Z',maxGasLimit:'500000',maxFeePerGas:'1000000000',maxPriorityFeePerGas:'1',maxTotalFeeWei:'500000000000000',maxValueWei:'0',operationId:`synthetic-session-${nonce}`,sourceSha256:`0x${'42'.repeat(32)}`};
  return validateIntent(tx.unsignedSerialized,tx.unsignedHash,review,policyDigest(review,tx.unsignedHash));
}
const path="44'/60'/0'/0/0";
test('campaign retains same actor/path session but every operation asks for device transaction approval', async()=>{
  const {f,module}=harness(), signer=module.makeCampaignUsbSigner(()=>{});
  await signer.sign(intent(f),path); await signer.sign(intent(f,2),path);
  assert.equal(f.pickers,1); assert.equal(f.signatures,2); assert.deepEqual(f.addresses.map(x=>x.opts.checkOnDevice),[true,false]); assert.equal(f.disconnects,0);
  assert.deepEqual(f.builderArgs.map(x=>Array.from(x).sort()),[['dmk','sessionId']]); await signer.close(); assert.equal(f.disconnects,1);
});
test('owner-selected path change requires new physical address confirmation',async()=>{
  const {f,module}=harness(),signer=module.makeCampaignUsbSigner(()=>{}); await signer.sign(intent(f),path); await signer.sign(intent(f,2),"44'/60'/1'/0/0");
  assert.equal(f.pickers,2); assert.deepEqual(f.addresses.map(x=>x.opts.checkOnDevice),[true,true]); await signer.close();
});
test('actor change requires new connection and on-device address confirmation',async()=>{
  const {f,module}=harness(),signer=module.makeCampaignUsbSigner(()=>{}); await signer.sign(intent(f),path); f.key=new SigningKey(`0x${'22'.repeat(32)}`); await signer.sign(intent(f,2),path);
  assert.equal(f.pickers,2); assert.deepEqual(f.addresses.map(x=>x.opts.checkOnDevice),[true,true]); await signer.close();
});
test('observed disconnect invalidates retained account session',async()=>{
  const {f,module}=harness(),signer=module.makeCampaignUsbSigner(()=>{}); await signer.sign(intent(f),path); f.observer.next({deviceStatus:'NOT CONNECTED'}); await signer.sign(intent(f,2),path);
  assert.equal(f.pickers,2); assert.deepEqual(f.addresses.map(x=>x.opts.checkOnDevice),[true,true]); await signer.close();
});
test('changed account from off-device recheck stops before second signature and closes session',async()=>{
  const {f,module}=harness(),signer=module.makeCampaignUsbSigner(()=>{}); const pinned=intent(f,2); await signer.sign(intent(f),path); f.key=new SigningKey(`0x${'22'.repeat(32)}`);
  await assert.rejects(signer.sign(pinned,path),e=>e.code==='DEVICE_ADDRESS_MISMATCH'); assert.equal(f.signatures,1); assert.equal(f.disconnects,1);
});
test('standalone signer retains disconnect-after-each-sign behavior',async()=>{
  const {f,module}=harness(),signer=module.makeUsbSigner(()=>{}); await signer.sign(intent(f),path); await signer.sign(intent(f,2),path);
  assert.equal(f.pickers,2); assert.equal(f.disconnects,2); assert.deepEqual(f.addresses.map(x=>x.opts.checkOnDevice),[true,true]);
});
