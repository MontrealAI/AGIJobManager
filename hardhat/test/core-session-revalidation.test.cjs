'use strict';
// Boundary tests stub chain observations only. Native regression evidence uses the
// genuine CLI/HTTPS/EVM, a real Git checkout and the original frozen failure run.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),E=require('ethers');
const P=require('../scripts/core-creation-plan.cjs'),S=require('../scripts/deployment-session.cjs'),V=require('../scripts/core-creation-verifier.cjs'),T=require('../scripts/transaction-envelope.cjs'),F=require('./helpers/core-session-fixture.cjs');
const wallet=new E.Wallet('0x'+'03'.repeat(32));
async function fixture(run){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'core-revalidation-')),original={...V};
 let sourceChanged=false,guards=0;
 try{
  const qualified=F.actualCatalog(dir),plan=P.makePlan(F.config(wallet.address),qualified,F.source);
  const context={directory:path.join(dir,'session'),qualified,source:F.source,rpc:()=>{throw Error('No provider in unit boundary test.');},revalidateSource(){guards++;assert.equal(sourceChanged,false,'test source checkout drift');return true;}};
  V.preflight=async()=>({latest:{number:1},preflightPassed:true});
  V.recoverHash=async(plan,index,rpc,start,known)=>known;
  V.verifyPrefix=async(plan,q,source,rpc,hashes)=>({proofs:hashes.map((hash,index)=>({index,transactionHash:hash})),finalBlock:{number:2}});
  fs.mkdirSync(path.join(dir,'locks'));await S.initialize({...context,plan,lockDirectory:path.join(dir,'locks')});
  const mutateCatalog=()=>fs.appendFileSync(path.join(dir,'catalog.json'),' ');
  const sign=async()=>{const h=await S.handoff(context),raw=await wallet.signTransaction(T.unsignedTransaction(h.envelope));return S.importSigned(context,raw);};
  await run({dir,qualified,plan,context,mutateCatalog,sign,markSourceChanged:()=>{sourceChanged=true;},guards:()=>guards});
 }finally{Object.assign(V,original);fs.rmSync(dir,{recursive:true,force:true});}
}
for(const drift of ['catalog','checkout'])test(`handoff rejects ${drift} drift after awaited preflight without a handoff capability`,async()=>fixture(async f=>{
 V.preflight=async()=>{await Promise.resolve();(drift==='catalog'?f.mutateCatalog:f.markSourceChanged)();return {latest:{number:1}};};
 await assert.rejects(S.handoff(f.context),/drift/i);const s=S.readSession(f.context.directory);
 assert.equal(s.state[0].status,'planned');assert.equal(s.sequence,1);assert.equal(fs.readdirSync(path.join(f.context.directory,'signed')).length,0);assert.equal(fs.readdirSync(path.join(f.context.directory,'attempts')).length,0);
}));
for(const drift of ['catalog','checkout'])test(`relay rejects ${drift} drift after awaited preflight before attempt marker or send`,async()=>fixture(async f=>{
 const imported=await f.sign();let sends=0;
 V.preflight=async()=>{await Promise.resolve();(drift==='catalog'?f.mutateCatalog:f.markSourceChanged)();return {latest:{number:1}};};
 await assert.rejects(S.submit(f.context,{acknowledgement:imported.relayAcknowledgement,transmit:()=>{sends++;}}),/drift/i);
 assert.equal(sends,0);assert.equal(S.readSession(f.context.directory).state[0].status,'signed');assert.equal(fs.readdirSync(path.join(f.context.directory,'attempts')).length,0);
}));
test('reconciliation rejects late catalog drift without a finalized event',async()=>fixture(async f=>{
 const imported=await f.sign();V.verifyPrefix=async()=>{await Promise.resolve();f.mutateCatalog();return {proofs:[{index:0,transactionHash:imported.transactionHash}],finalBlock:{number:2}};};
 await assert.rejects(S.reconcile(f.context),/drift/i);assert.equal(S.readSession(f.context.directory).state[0].status,'signed');
}));
test('completion rejects late catalog drift without release event or creator-lock cleanup',async()=>fixture(async f=>{
 for(let i=0;i<9;i++){await f.sign();await S.reconcile(f.context);}
 const verify=V.verifyPrefix;V.verifyPrefix=async(...args)=>{const evidence=await verify(...args);f.mutateCatalog();return evidence;};
 const before=S.readSession(f.context.directory);await assert.rejects(S.complete(f.context),/drift/i);
 const after=S.readSession(f.context.directory);assert.equal(after.released,false);assert.equal(after.sequence,before.sequence);assert(fs.existsSync(after.meta.creatorLock.path));
}));
test('missing explicit source guard fails before initializing operator state',async()=>fixture(async f=>{
 const dir=path.join(f.dir,'missing-guard');await assert.rejects(S.initialize({directory:dir,plan:f.plan,qualified:f.qualified,source:F.source,rpc:f.context.rpc,lockDirectory:path.join(f.dir,'locks')}),/source revalidation guard/);assert.equal(fs.existsSync(dir),false);
}));
test('source guard actually reobserves raw Git bytes and refuses later source changes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'core-source-guard-'));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('GIT_')));Object.assign(env,{GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0'});
 const git=(...args)=>cp.execFileSync('git',['-c','protocol.allow=never','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args],{cwd:root,env,stdio:'pipe'});
 try{fs.mkdirSync(path.join(root,'hardhat'));for(const name of ['package-lock.json','hardhat/package-lock.json','README.md'])fs.writeFileSync(path.join(root,name),'{}\n');git('init','--quiet');git('add','.');git('-c','user.name=Disposable Test','-c','user.email=test.invalid@example.invalid','commit','--quiet','-m','Disposable source guard fixture');const guard=P.createSourceGuard(root);assert(Object.isFrozen(guard));assert(Object.isFrozen(guard.source));assert.equal(guard.assertUnchanged(),true);fs.appendFileSync(path.join(root,'README.md'),'changed\n');assert.throws(()=>guard.assertUnchanged(),/Tracked source bytes differ/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});

// These module fixtures deliberately replace local filesystem objects during an
// awaited observation. They do not claim protection against swaps between checks.
function swapFile(file){const saved=file+'.preserved';fs.renameSync(file,saved);fs.copyFileSync(saved,file);return saved;}
function swapDirectory(directory){const saved=directory+'.preserved';fs.renameSync(directory,saved);fs.cpSync(saved,directory,{recursive:true});return saved;}
for(const target of ['session','active-directory','active-owner','creator-directory','creator-owner','head-inode','head-bytes','events-directory','event-inode','event-extra','signed-directory','attempts-directory']){
 test(`handoff preserves changed ${target} identity and refuses journal/capability writes`,async()=>fixture(async f=>{
  const dir=f.context.directory,lock=S.readSession(dir).meta.creatorLock.path;let preserved;
  V.preflight=async()=>{await Promise.resolve();
   if(target==='session')preserved=swapDirectory(dir);
   if(target==='active-directory')preserved=swapDirectory(path.join(dir,'active-command'));
   if(target==='active-owner')preserved=swapFile(path.join(dir,'active-command','owner.json'));
   if(target==='creator-directory')preserved=swapDirectory(lock);
   if(target==='creator-owner')preserved=swapFile(path.join(lock,'owner.json'));
   if(target==='head-inode')preserved=swapFile(path.join(dir,'head.json'));
   if(target==='head-bytes')fs.appendFileSync(path.join(dir,'head.json'),' ');
   if(target==='events-directory')preserved=swapDirectory(path.join(dir,'events'));
   if(target==='event-inode')preserved=swapFile(path.join(dir,'events','000000.json'));
   if(target==='event-extra')fs.writeFileSync(path.join(dir,'events','000001.json'),'{}');
   if(target==='signed-directory')preserved=swapDirectory(path.join(dir,'signed'));
   if(target==='attempts-directory')preserved=swapDirectory(path.join(dir,'attempts'));
   return {latest:{number:1}};
  };
  await assert.rejects(S.handoff(f.context),/identity changed|bytes changed|membership changed|contents changed/);
  assert.equal(fs.readdirSync(path.join(dir,'signed')).length,0);assert.equal(fs.readdirSync(path.join(dir,'attempts')).length,0);
  assert.equal(fs.existsSync(path.join(dir,'events','000001.json')),target==='event-extra');
  assert(fs.existsSync(path.join(dir,'active-command','owner.json')),'Changed-state command gate must survive for manual reconciliation.');
  assert(fs.existsSync(path.join(lock,'owner.json')));if(preserved)assert(fs.existsSync(preserved));
  if(target==='session')assert(fs.existsSync(path.join(preserved,'active-command','owner.json')));
 }));
}
for(const target of ['session','active-owner','creator-directory','head-inode']){
 test(`relay refuses ${target} replacement before attempt or send`,async()=>fixture(async f=>{
  const imported=await f.sign(),dir=f.context.directory,lock=S.readSession(dir).meta.creatorLock.path;let sends=0;
  V.preflight=async()=>{await Promise.resolve();if(target==='session')swapDirectory(dir);if(target==='active-owner')swapFile(path.join(dir,'active-command','owner.json'));if(target==='creator-directory')swapDirectory(lock);if(target==='head-inode')swapFile(path.join(dir,'head.json'));return {latest:{number:1}};};
  await assert.rejects(S.submit(f.context,{acknowledgement:imported.relayAcknowledgement,transmit(){sends++;}}),/identity changed|contents changed/);
  assert.equal(sends,0);assert.equal(S.readSession(dir).state[0].status,'signed');assert.equal(fs.readdirSync(path.join(dir,'attempts')).length,0);assert(fs.existsSync(path.join(dir,'active-command','owner.json')));
 }));
}
for(const target of ['creator-directory','creator-owner','creator-parent','new-tombstone','head-inode']){
 test(`completion preserves ${target} replacement without release or cleanup`,async()=>fixture(async f=>{
  for(let i=0;i<9;i++){await f.sign();await S.reconcile(f.context);}
  const before=S.readSession(f.context.directory),lock=before.meta.creatorLock.path,tombstone=lock+'.released-'+before.meta.creatorLock.token,verify=V.verifyPrefix;let preserved;
  V.verifyPrefix=async(...args)=>{const evidence=await verify(...args);if(target==='creator-directory')preserved=swapDirectory(lock);if(target==='creator-owner')preserved=swapFile(path.join(lock,'owner.json'));if(target==='creator-parent')preserved=swapDirectory(path.dirname(lock));if(target==='new-tombstone')fs.mkdirSync(tombstone);if(target==='head-inode')preserved=swapFile(path.join(f.context.directory,'head.json'));return evidence;};
  await assert.rejects(S.complete(f.context),/identity changed|membership changed|contents changed/);
  const after=S.readSession(f.context.directory);assert.equal(after.released,false);assert.equal(after.sequence,before.sequence);assert(fs.existsSync(path.join(lock,'owner.json')));if(preserved)assert(fs.existsSync(preserved));if(target==='new-tombstone')assert(fs.existsSync(tombstone));assert(fs.existsSync(path.join(f.context.directory,'active-command','owner.json')));
 }));
}
test('successful command and complete cleanup still work with identity pins',async()=>fixture(async f=>{
 for(let i=0;i<9;i++){await f.sign();await S.reconcile(f.context);}
 const lock=S.readSession(f.context.directory).meta.creatorLock.path;assert.equal((await S.complete(f.context)).activationAuthorized,false);assert.equal(fs.existsSync(lock),false);assert.equal(fs.existsSync(path.join(f.context.directory,'active-command')),false);assert.equal((await S.complete(f.context)).activationAuthorized,false);
}));
for(const target of ['tombstone-directory','tombstone-owner','new-original-lock']){
 test(`resumed completion preserves ${target} created or replaced during verification`,async()=>fixture(async f=>{
  for(let i=0;i<9;i++){await f.sign();await S.reconcile(f.context);}const meta=S.readSession(f.context.directory).meta;await S.complete(f.context);
  const lock=meta.creatorLock,tombstone=lock.path+'.released-'+lock.token;let preserved;
  if(target!=='new-original-lock'){fs.mkdirSync(tombstone);fs.writeFileSync(path.join(tombstone,'owner.json'),JSON.stringify(lock));}
  const verify=V.verifyPrefix;V.verifyPrefix=async(...args)=>{const evidence=await verify(...args);if(target==='tombstone-directory')preserved=swapDirectory(tombstone);if(target==='tombstone-owner')preserved=swapFile(path.join(tombstone,'owner.json'));if(target==='new-original-lock'){fs.mkdirSync(lock.path);fs.writeFileSync(path.join(lock.path,'owner.json'),JSON.stringify(lock));}return evidence;};
  await assert.rejects(S.complete(f.context),/identity changed|membership changed|contents changed/);
  const owner=path.join(target==='new-original-lock'?lock.path:tombstone,'owner.json');assert(fs.existsSync(owner));if(preserved)assert(fs.existsSync(preserved));assert(fs.existsSync(path.join(f.context.directory,'active-command','owner.json')));
 }));
}
test('head replacement after durable attempt preserves ambiguity and prevents relay',async()=>fixture(async f=>{
 const imported=await f.sign(),original=f.context.revalidateSource;let checks=0,sends=0;
 f.context.revalidateSource=()=>{original();if(++checks===3)swapFile(path.join(f.context.directory,'head.json'));return true;};
 await assert.rejects(S.submit(f.context,{acknowledgement:imported.relayAcknowledgement,transmit(){sends++;}}),/identity changed/);
 assert.equal(sends,0);assert.equal(S.readSession(f.context.directory).state[0].status,'submission-attempted');assert(fs.existsSync(path.join(f.context.directory,'attempts','0.json')));assert(fs.existsSync(path.join(f.context.directory,'active-command','owner.json')));
}));
