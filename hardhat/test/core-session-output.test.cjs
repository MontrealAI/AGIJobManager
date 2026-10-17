'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {reserveOutput,flags}=require('../scripts/core-session.cjs');
test('output is reserved exclusively and durably before a one-time operation',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'core-output-'));try{const file=path.join(dir,'out.json');assert.equal(reserveOutput(file,'handoff'),file);assert.equal(JSON.parse(fs.readFileSync(file)).status,'RESERVED_BEFORE_ACTION');assert.equal(fs.statSync(file).mode&0o777,0o600);assert.throws(()=>reserveOutput(file,'relay'),/EEXIST/);assert.equal(JSON.parse(fs.readFileSync(file)).command,'handoff');}finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('symlinked or nonexistent output parent fails before any operation',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'core-output-'));try{fs.mkdirSync(path.join(dir,'actual'));fs.symlinkSync(path.join(dir,'actual'),path.join(dir,'alias'));assert.throws(()=>reserveOutput(path.join(dir,'alias','out.json'),'handoff'),/symlinks/);assert.throws(()=>reserveOutput(path.join(dir,'missing','out.json'),'handoff'),/ENOENT/);assert.deepEqual(fs.readdirSync(path.join(dir,'actual')),[]);}finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('CLI rejects duplicate malformed flags; no hidden trust/signer flags are parsed as policy',()=>{assert.deepEqual(flags(['--catalog','p','--build-id','x']),{catalog:'p','build-id':'x'});for(const args of [['--out'],['out','p'],['--out','a','--out','b']])assert.throws(()=>flags(args));});

// Real CLI orchestration and filesystem with synthetic read-only chain/build
// observations. No provider, transaction, hardware or genuine-source claim.
const vm=require('node:vm'),{createRequire}=require('node:module');
async function runOutputCase(mutate,inspect=()=>{}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'core-output-await-')),parent=path.join(root,'reports'),output=path.join(parent,'report.json');fs.mkdirSync(parent);
 const filename=path.resolve(__dirname,'../scripts/core-session.cjs'),real=createRequire(filename),module={exports:{}};
 const mocks={'./core-creation-plan.cjs':{createSourceGuard:()=>({source:{},assertUnchanged:()=>true}),checkPlan(){}},'./qualified-build-catalog.cjs':{loadQualifiedBuild:()=>({assertUnchanged:()=>true})},'./deployment-session.cjs':{readJson:()=>({})},'./core-creation-verifier.cjs':{preflight:async()=>{await Promise.resolve();await mutate({root,parent,output});return {scope:'synthetic-preflight-result'};}},'./deployment-rpc.cjs':{createReadRpc:()=>()=>{throw Error('No provider');},scopeFor:()=>({})}};
 function request(name){return mocks[name]||real(name);}request.main=null;
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,require:request,process:{env:{}},console:{log(){}}});
 try{return await module.exports.main(['preflight','--catalog','synthetic','--catalog-sha','a'.repeat(64),'--build-id','synthetic','--plan','synthetic-plan','--out',output]);}finally{try{inspect({root,parent,output});}finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(root+'.preserved',{recursive:true,force:true});}}
}
for(const target of ['parent','ancestor','file','bytes','parent-symlink','file-symlink'])test(`CLI preserves ${target} replacement at awaited report boundary`,async()=>{
 let paths,expected;
 await assert.rejects(runOutputCase(async f=>{paths=f;
  if(target==='parent'||target==='ancestor'){const entry=target==='parent'?f.parent:f.root;fs.renameSync(entry,entry+'.preserved');fs.mkdirSync(entry);if(target==='ancestor')fs.mkdirSync(f.parent);fs.copyFileSync(path.join(entry+'.preserved',target==='parent'?'report.json':'reports/report.json'),f.output);}
  if(target==='file'){fs.renameSync(f.output,f.output+'.preserved');fs.copyFileSync(f.output+'.preserved',f.output);}
  if(target==='bytes')fs.appendFileSync(f.output,' ');
  if(target==='parent-symlink'){fs.renameSync(f.parent,f.parent+'.preserved');fs.symlinkSync(f.parent+'.preserved',f.parent);}
  if(target==='file-symlink'){fs.renameSync(f.output,f.output+'.preserved');fs.symlinkSync(f.output+'.preserved',f.output);}
  expected=fs.readFileSync(f.output);
 },f=>{assert.deepEqual(fs.readFileSync(f.output),expected);assert.equal(JSON.parse(fs.readFileSync(f.output)).status,'RESERVED_BEFORE_ACTION');if(target==='parent')assert(fs.existsSync(f.parent+'.preserved/report.json'));if(target==='ancestor')assert(fs.existsSync(f.root+'.preserved/reports/report.json'));if(target==='file'||target==='file-symlink')assert(fs.existsSync(f.output+'.preserved'));}),/Output (parent identity|reservation identity|reservation must retain)/);
 assert(paths&&expected);
});
test('CLI replaces an unchanged reservation after awaited success',async()=>{await runOutputCase(async()=>{},f=>assert.equal(JSON.parse(fs.readFileSync(f.output)).scope,'synthetic-preflight-result'));});
