'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const E=require('ethers');
const {durableWrite,requireCreatorProfile,reserveCreator,releaseCreator,planCreation,requireCreationTransaction,recoverCreation}=require('../scripts/creator-transaction.cjs');
const creator=E.getAddress('0x'+'12'.repeat(20)),chainId=1,transactionMode='eoa-create';
const provider={getCode:async()=> '0x',getTransactionCount:async()=>7};
const request={provider,chainId,creator,transactionMode,creationData:'0x6000',gasLimit:100000n,startBlock:99};
test('nonce intent binds independent creator, chain, constructor data, exact gas and predicted address',async()=>{
 const intent=await planCreation(request);assert.equal(intent.nonce,7);assert.equal(intent.address,E.getCreateAddress({from:creator,nonce:7}));
 const tx={from:creator,chainId:1n,nonce:7,to:null,value:0n,data:'0x6000',gasLimit:100000n};assert.equal(requireCreationTransaction(tx,intent),tx);
 for(const altered of [{...tx,nonce:8},{...tx,chainId:2n},{...tx,from:E.ZeroAddress},{...tx,value:1n},{...tx,to:creator},{...tx,data:'0x6001'},{...tx,gasLimit:99999n}])assert.throws(()=>requireCreationTransaction(altered,intent));
 for(const altered of [{...intent,schema:'old'},{...intent,to:creator},{...intent,value:'1'},{...intent,transactionMode:'factory'},{...intent,address:creator}])assert.throws(()=>requireCreationTransaction(tx,altered));
});
test('pending or changed nonce refuses an intent and never selects another sender',async()=>{
 await assert.rejects(planCreation({...request,provider:{...provider,getTransactionCount:async(_address,tag)=>tag==='latest'?7:8}}),/pending/);
});
for(const code of ['0x6000','0xef0100'+'11'.repeat(20)])test('creator code requires separate transport qualification '+code,async()=>{
 await assert.rejects(requireCreatorProfile({...request,provider:{getCode:async()=>code}}),/not qualified/);
});
test('unsupported factory, smart account and delegated modes fail closed',async()=>{
 for(const mode of ['factory','smart-account','delegated-eoa-create',''])await assert.rejects(requireCreatorProfile({...request,transactionMode:mode}),/Unsupported/);
});
test('shared atomic signer lock blocks another repository and never auto-breaks stale evidence',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nonce-protocol-'));
 try{
  const lock=reserveCreator({directory,chainId,creator,journalPath:path.join(directory,'manager.json')});
  assert.equal(path.basename(lock.path),`${chainId}-${creator.toLowerCase()}`);assert.equal(fs.statSync(path.join(lock.path,'owner.json')).mode&0o777,0o600);
  assert.throws(()=>reserveCreator({directory,chainId,creator,journalPath:path.join(directory,'jobs.json')}),/already exists/);
  assert.throws(()=>releaseCreator({...lock,token:'different'}),/differs/);assert(fs.existsSync(lock.path));
  releaseCreator(lock);assert(!fs.existsSync(lock.path));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('journals use exclusive creation and atomically replace only the intended local file',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'durable-intent-')),file=path.join(dir,'journal.json');
 try{durableWrite(file,{phase:1},{exclusive:true});assert.throws(()=>durableWrite(file,{phase:0},{exclusive:true}),/EEXIST/);durableWrite(file,{phase:2});assert.deepEqual(JSON.parse(fs.readFileSync(file)),{phase:2});assert.deepEqual(fs.readdirSync(dir),['journal.json']);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('hashless recovery is bounded and never invents an automatic resend',async()=>{
 const intent=await planCreation(request),p={send:async(method)=>method==='eth_chainId'?'0x1':{number:'0x1000',hash:'0x'+'aa'.repeat(32)}};
 await assert.rejects(recoverCreation({provider:p,intent}),/bounded canonical scan/);
 await assert.rejects(recoverCreation({provider:p,intent,maxBlocks:3000}),/1..2048/);
});
