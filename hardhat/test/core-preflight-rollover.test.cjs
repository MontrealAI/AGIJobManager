'use strict';
// Run the real verifier with deterministic read-only dependency observations.
// No production hooks, signer, session mutation or relay are introduced.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const E=require('ethers'),T=require('../scripts/transaction-envelope.cjs');
const ROLLOVER='Latest block changed during preflight; repeat read-only checks.';
function fixture({rollovers=0,failAt=0,failure='policy failure',budget=Infinity}={}){
 const seen={attempts:0,latestPins:0,finalPins:0,plans:0,actors:0,canonical:0,dependencies:0,token:0,estimates:0,rpc:0};
 const creator='0x1111111111111111111111111111111111111111',dependency='0x2222222222222222222222222222222222222222';
 const hash=n=>'0x'+n.toString(16).padStart(64,'0');
 const plan={startNonce:0,config:{block:{number:1,hash:hash(1)},expiresAfterBlock:2049,constructorArgs:{usdcTokenAddress:dependency,ensConfig:[dependency,E.ZeroAddress],settlementWallets:[creator,creator]}},creator,governor:creator,operations:Array.from({length:9},(_,id)=>({predictedAddress:E.getCreateAddress({from:creator,nonce:id}),envelope:{type:2,from:creator,to:null,value:'0',data:'0x6000',gasLimit:'100000',maxFeePerGas:'100',maxPriorityFeePerGas:'1',nonce:id,accessList:[]}}))};
 const A={pin:async(_rpc,tag)=>{if(tag==='finalized'){seen.attempts++;seen.finalPins++;return {number:2,hash:hash(2)};}seen.latestPins++;const end=seen.latestPins%2===0;return {number:10+seen.attempts,hash:hash(100+seen.attempts+(end&&seen.attempts<=rollovers?1:0)),gasLimit:'1000000',baseFeePerGas:'1'};},observeActor:async()=>{seen.actors++;},canonicalCheck:async()=>{seen.canonical++;}};
 const rpc=async(method)=>{if(++seen.rpc>budget)throw Error('RPC budget or deadline exhausted.');if(method==='eth_chainId')return '0x1';if(method==='eth_getTransactionCount')return '0x0';if(method==='eth_getCode')return '0x';if(method==='eth_estimateGas'){seen.estimates++;if(seen.attempts===failAt)throw Error(failure);return '0x100';}throw Error('Unexpected RPC method '+method);};
 const dependencies={ethers:E,'./transaction-envelope.cjs':T,'./actor-policy.cjs':A,'./core-creation-plan.cjs':{checkPlan:()=>{seen.plans++;}},'./canonical-state.cjs':{createCanonicalReader:()=>({getCode:async()=>{seen.dependencies++;return '0x01';},contract:()=>({}),at:{}})},'./deployment-safety.cjs':{requireArtifactMatch(){throw Error('Unexpected runtime check');},USDC_ABI:[],requireOperationalUSDC:async()=>{seen.token++;}}};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scripts/core-creation-verifier.cjs'),'utf8'),{module,require:name=>{assert(Object.hasOwn(dependencies,name));return dependencies[name];}});
 return {seen,run:()=>module.exports.preflight(plan,{}, {},rpc),plan};
}
test('stable block returns after one complete read-only attempt',async()=>{const f=fixture(),result=await f.run();assert.equal(result.preflightPassed,true);assert.equal(f.seen.attempts,1);assert.equal(f.seen.estimates,1);});
test('rollovers re-pin and repeat every guard before accepting the fifth attempt',async()=>{const f=fixture({rollovers:4}),result=await f.run();assert.equal(result.preflightPassed,true);assert.equal(f.seen.attempts,5);assert.equal(f.seen.finalPins,5);assert.equal(f.seen.latestPins,10);assert.equal(f.seen.actors,15);assert.equal(f.seen.canonical,10);assert.equal(f.seen.dependencies,10);assert.equal(f.seen.token,5);assert.equal(f.seen.estimates,5);assert.equal(f.seen.plans,11);});
test('persistent rollover stops after exactly five complete attempts',async()=>{const f=fixture({rollovers:100});await assert.rejects(f.run(),new RegExp(ROLLOVER));assert.equal(f.seen.attempts,5);assert.equal(f.seen.estimates,5);});
test('policy failure after a rollover stops without a third attempt',async()=>{const f=fixture({rollovers:1,failAt:2});await assert.rejects(f.run(),/policy failure/);assert.equal(f.seen.attempts,2);});
test('provider exception with identical rollover text cannot request a retry',async()=>{const f=fixture({failAt:1,failure:ROLLOVER});await assert.rejects(f.run(),new RegExp(ROLLOVER));assert.equal(f.seen.attempts,1);});
test('transport budget remains cumulative and cannot be reset by a retry',async()=>{const f=fixture({rollovers:100,budget:25});await assert.rejects(f.run(),/RPC budget/);assert.equal(f.seen.rpc,26);assert.equal(f.seen.attempts,2);});
test('nonce failure is not retried',async()=>{const f=fixture();f.plan.startNonce=1;await assert.rejects(f.run(),/nonce drift/);assert.equal(f.seen.attempts,1);});
test('expiry failure is not retried',async()=>{const f=fixture();f.plan.config.expiresAfterBlock=1;await assert.rejects(f.run(),/validity expired/);assert.equal(f.seen.attempts,1);});
