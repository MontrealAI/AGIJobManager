'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const E=require('ethers'),I=require('../../scripts/commissioning/lib/io.cjs'),C=require('../scripts/check-ens-usdc-connection.cjs');
const {inventory}=require('../../scripts/commissioning/lib/approvals.cjs'),{inspect,ABI,RESERVES,POLICY,ROOTS}=require('../../scripts/commissioning/lib/inspect.cjs');
const A=require('../../scripts/commissioning/lib/activation.cjs');
const hash='0x'+'ab'.repeat(32),otherHash='0x'+'cd'.repeat(32),wallet=C.P.rootOwner,wrapper=C.P.wrapper,operator=C.P.helper;
const snapshot={number:10,hash,timestampSeconds:'1791720000',tag:'0xa'};
function log(n=3){return {address:wrapper,removed:false,blockNumber:E.toQuantity(n),blockHash:hash,transactionHash:otherHash,transactionIndex:'0x0',logIndex:'0x0',topics:[E.id('ApprovalForAll(address,address,bool)'),E.zeroPadValue(wallet,32).toLowerCase(),E.zeroPadValue(operator,32).toLowerCase()],data:E.zeroPadValue('0x01',32)};}
function inventoryFixture(change=()=>{}){
 const logs=[log()],requests=[],reader={contract:()=>({isApprovedForAll:async()=>true}),getCode:async()=> '0x1234'};
 const rpc=async(method,params)=>{requests.push([method,params]);if(method==='eth_getBlockByNumber')return {hash};
   if(method==='eth_getLogs')return logs.filter(l=>Number(BigInt(l.blockNumber))>=Number(BigInt(params[0].fromBlock))&&Number(BigInt(l.blockNumber))<=Number(BigInt(params[0].toBlock)));throw Error('unexpected');};
 const f={E,rpc,reader,wallet,wrapper,snapshot,startBlock:0,rangeSize:5,logs,requests};change(f);return f;
}
test('approval inventory covers contiguous ranges and reconciles active state without claiming independent completeness',async()=>{
 const f=inventoryFixture(),r=await inventory(f);assert.equal(r.status,'PASS');assert.deepEqual(r.ranges.map(x=>[x.from,x.to]),[[0,4],[5,9],[10,10]]);assert.equal(r.operators[0].active,true);assert.equal(r.completeHistory,'PROVIDER_ASSERTED_FROM_GENESIS_ONLY');
});
for(const [name,change] of [
 ['removed',f=>f.logs[0].removed=true],['duplicate',f=>f.logs.push({...f.logs[0]})],['wrong owner',f=>f.logs[0].topics[1]=hash],['wrong contract',f=>f.logs[0].address=wallet],
 ['malformed bool',f=>f.logs[0].data='0x02'],['missing log index',f=>delete f.logs[0].logIndex],['state mismatch',f=>f.reader.contract=()=>({isApprovedForAll:async()=>false})],
 ['provider rejection',f=>f.rpc=async()=>{throw new I.Stop('RPC_PROVIDER_REJECTED_READ');}],['reorg',f=>{const old=f.rpc;f.rpc=(m,p)=>m==='eth_getBlockByNumber'?{hash:otherHash}:old(m,p);}]
])test('approval enumeration refuses '+name,async()=>{const f=inventoryFixture(change);await assert.rejects(inventory(f));});
test('log cap splits ranges and refuses a possibly truncated single block',async()=>{const f=inventoryFixture();f.logCap=1;await assert.rejects(inventory(f),{code:'APPROVAL_POSSIBLE_TRUNCATION'});});
test('explicit bounded start never becomes full-history claim',async()=>{const f=inventoryFixture();f.startBlock=2;assert.equal((await inventory(f)).completeHistory,false);});
function coreFixture(){
 const iface=new E.Interface(ABI),tokenIface=new E.Interface(['function balanceOf(address) view returns(uint256)','function decimals() view returns(uint8)','function paused() view returns(bool)','function isBlacklisted(address) view returns(bool)']);
 const values={owner:C.P.administrator,pendingOwner:C.ZERO,paused:true,settlementPaused:false,usdcToken:C.P.usdc,wallet30:wallet,wallet10:'0x'+'34'.repeat(20),agentNftRequired:false,ens:C.P.registry,nameWrapper:wrapper,lockIdentityConfig:false,
   ...Object.fromEntries([...POLICY,...RESERVES].map(k=>[k,0n])),...Object.fromEntries(ROOTS.map(k=>[k,hash]))};
 const calls=[];let snapshots=0;
 const rpc=async(method,p)=>{
  calls.push([method,p]);if(method==='eth_chainId')return '0x1';
  if(method==='eth_getBlockByNumber'){snapshots++;return {number:'0xa',hash,timestamp:E.toQuantity(snapshot.timestampSeconds)};}
  if(['eth_getCode','eth_getStorageAt','eth_call'].includes(method))assert.deepEqual(p.at(-1),{blockHash:hash,requireCanonical:true});
  if(method==='eth_getStorageAt')return E.zeroPadValue(operator,32);if(method==='eth_getCode')return '0x1234';
  if(method==='eth_call'){const token=p[0].to.toLowerCase()===C.P.usdc.toLowerCase(),abi=token?tokenIface:iface,parsed=abi.parseTransaction({data:p[0].data});
   const v=token?({balanceOf:3940000n,decimals:6n,paused:false,isBlacklisted:false}[parsed.name]):values[parsed.name];
   return abi.encodeFunctionResult(parsed.fragment,[v]);}
  throw Error('unexpected');
 };return {rpc,calls,values};
}
test('core and ENS share a canonical block; missing NFT build remains missing; surplus is solvent',async()=>{
 const old=C.collect;C.collect=async(_e,rpc,report)=>{const b=await rpc('eth_getBlockByNumber',['latest',false]);report.snapshot=C.blockInfo(b);await rpc('eth_getCode',[C.P.helper,b.number]);report.status='ENS_CONNECTION_CHECK_PASSED_INTAKE_PAUSED';return report;};
 try{const f=coreFixture(),r=await inspect({rpc:f.rpc,now:Number(snapshot.timestampSeconds)*1000});assert.equal(r.sections.core.accounting.solvent,true);assert.equal(r.sections.core.nft.status,'NOT_RUN');assert.equal(r.status,'NEEDS_OPERATOR_INPUT');assert.equal(r.sections.ens.status,'PASS');assert.match(r.sections.ens.message,/no deployment needed/);}finally{C.collect=old;}
});
test('snapshot reorg and stale latest blocks cannot produce combined PASS',async()=>{
 const f=coreFixture();await assert.rejects(inspect({rpc:f.rpc,now:Number(snapshot.timestampSeconds)*1000+900001}),{code:'RPC_LATEST_BLOCK_STALE_OR_FUTURE'});
 const old=C.collect;C.collect=async()=>({});let count=0;const rpc=async(m,p)=>m==='eth_getBlockByNumber'&&++count>1?{number:'0xa',hash:otherHash,timestamp:E.toQuantity(snapshot.timestampSeconds)}:f.rpc(m,p);
 try{await assert.rejects(inspect({rpc,mode:'ens',now:Number(snapshot.timestampSeconds)*1000}),{code:'SNAPSHOT_REORG'});}finally{C.collect=old;}
});
test('current observation rejects stale, conflicting, dirty-source and escalated records',()=>{
 const base={schema:'agijobmanager-current-observation-v1',chainId:1,manager:C.P.manager,helper:C.P.helper,namespace:C.P.root,snapshot,
   intakeActivationAuthorized:false,productionReadinessCertified:false,publicTransactionsBroadcast:0,sections:{ens:{historicalSchemaReport:{snapshot}}},source:{commit:'a'.repeat(40),worktreeChanged:false}};
 const now=Number(snapshot.timestampSeconds)*1000;A.validateObservation(base,now);
 for(const change of [x=>x.intakeActivationAuthorized=true,x=>x.source.worktreeChanged=true,x=>x.sections.ens.historicalSchemaReport.snapshot={...snapshot,hash:otherHash},x=>x.manager=C.P.helper]){const x=structuredClone(base);change(x);assert.throws(()=>A.validateObservation(x,now));}
 assert.throws(()=>A.validateObservation(base,now+900001));
});
test('evidence digest mismatch never becomes a closed activation group',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agi-review-'));fs.chmodSync(dir,0o700);I.write(path.join(dir,'obs.json'),{});const x=A.template();x.observation={file:'obs.json',sha256:'a'.repeat(64)};
 assert.throws(()=>A.review(x,{base:dir}),{code:'EVIDENCE_HASH_MISMATCH'});fs.rmSync(dir,{recursive:true});
});
test('generic namespace planning reuses fresh derivation and refuses an attached manager',async()=>{
 const {plan}=require('../../scripts/commissioning/lib/namespace.cjs'),{deriveJobsRootName}=require('../scripts/deploy-ens-job-pages.cjs');
 const f=coreFixture(),manager=new E.Interface(ABI),registry=new E.Interface(C.ABI.registry);
 f.values.ensJobPages=C.ZERO;f.values.nextJobId=0n;
 const base=f.rpc;
 const rpc=async(m,p)=>{
   if(m==='eth_call'&&p[0].to.toLowerCase()===C.P.registry.toLowerCase()){const fn=registry.parseTransaction({data:p[0].data});return registry.encodeFunctionResult(fn.fragment,[C.ZERO]);}
   return base(m,p);
 };
 const config={schema:'agijobmanager-ens-namespace-plan-v1',mode:'fresh',manager:C.P.manager};
 const r=await plan({rpc,config});assert.equal(r.root,deriveJobsRootName(1,C.P.manager));assert.equal(r.helperDeploymentAuthorized,false);
 f.values.ensJobPages=C.P.helper;await assert.rejects(plan({rpc,config}),{code:'EXISTING_INSTANCE_USE_INSPECTION_OR_REPLACEMENT'});
});
