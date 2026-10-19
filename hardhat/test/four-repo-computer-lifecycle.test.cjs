'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assertDisposableConfig,assertFixtureAmount,readBoundedFixtureFile,assertPinnedSourceCheckout,loadReviewedSourceModules,prepareReviewedSourceModules}=require('../scripts/four-repo-computer-lifecycle.cjs');
const fixture=()=>({networks:{hardhat:{type:'edr-simulated',chainId:31337,accounts:{mnemonic:'test test test test test test test test test test test junk',count:10}}}});
test('only isolated EDR chain with known fixture accounts passes the signing boundary',()=>{assert.doesNotThrow(()=>assertDisposableConfig(fixture()));});
for(const [name,mutate] of Object.entries({
  mainnet:v=>v.networks.hardhat.chainId=1,
  http:v=>v.networks.hardhat.type='http',
  url:v=>v.networks.hardhat.url='https://public-network.invalid',
  fork:v=>v.networks.hardhat.forking={url:'https://public-network.invalid'},
  additionalNetwork:v=>v.networks.mainnet={type:'http',chainId:1},
  privateAccountSelection:v=>v.networks.hardhat.accounts=[{privateKey:'PUBLIC_TEST_SENTINEL_NOT_A_KEY'}],
}))test('refuses '+name+' before creating a provider or signer',()=>{const value=fixture();mutate(value);assert.throws(()=>assertDisposableConfig(value));});

test('bounded demonstration accepts both exact qualified amount boundaries',()=>{assert.equal(assertFixtureAmount('25000000'),25000000n);assert.equal(assertFixtureAmount('100000000'),100000000n);});
for(const amount of ['0','1','24999999','100000001','500000001',((1n<<128n)-1n).toString()])test('out-of-range demo amount '+amount+' is refused before provider/signers exist',()=>assert.throws(()=>assertFixtureAmount(amount),/FIXTURE_BUDGET|canonical/));


test('fixture input reads at most maximum+1 bytes when a small file grows after fstat',()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'manager-bounded-read-')),file=path.join(directory,'public.json');
  fs.writeFileSync(file,'{}');const fstat=fs.fstatSync,read=fs.readSync,readFile=fs.readFileSync;let first=true,bytesRead=0;
  fs.fstatSync=descriptor=>{const info=fstat(descriptor);if(first){first=false;fs.appendFileSync(file,' '.repeat(32));}return info;};
  fs.readSync=(descriptor,buffer,offset,length,position)=>{assert(buffer.length<=17);assert(length<=17);const count=read(descriptor,buffer,offset,length,position);bytesRead+=count;return count;};
  fs.readFileSync=(...args)=>{assert.notEqual(typeof args[0],'number','Unbounded descriptor reads are forbidden');return readFile(...args);};
  try{assert.throws(()=>readBoundedFixtureFile(file,16),/Bounded regular input/);assert.equal(bytesRead,17);}
  finally{fs.fstatSync=fstat;fs.readSync=read;fs.readFileSync=readFile;fs.rmSync(directory,{recursive:true,force:true});}
});
test('fixture rejects a small size-changing append even below the maximum and preserves ordinary UTF-8 bytes',()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'manager-bounded-size-')),file=path.join(directory,'public.json');
  fs.writeFileSync(file,'{}');const fstat=fs.fstatSync;let first=true;
  fs.fstatSync=descriptor=>{const info=fstat(descriptor);if(first){first=false;fs.appendFileSync(file,'  ');}return info;};
  try{assert.throws(()=>readBoundedFixtureFile(file,16),/Fixture input changed/);}
  finally{fs.fstatSync=fstat;}
  try{fs.writeFileSync(file,'{"public":"Ω"}');assert.equal(readBoundedFixtureFile(file,64),'{"public":"Ω"}');}
  finally{fs.rmSync(directory,{recursive:true,force:true});}
});

const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
function sourceFixture(base,name,kind){
  const root=path.join(base,name);fs.mkdirSync(root);
  const relative=kind==='alpha'?'examples/successor-alpha/computer.mjs':'integrations/alpha-agent/four-repo-computer-receipt.mjs';
  fs.mkdirSync(path.dirname(path.join(root,relative)),{recursive:true});
  fs.writeFileSync(path.join(root,relative),`export const kind=${JSON.stringify(name)};\n`);
  fs.mkdirSync(path.join(root,'shared'));fs.writeFileSync(path.join(root,'shared/engine.mjs'),'export const engine=1;\n');
  const git=(...args)=>execFileSync('/usr/bin/git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  git('init','-q');git('add','.');git('-c','user.name=Public fixture','-c','user.email=fixture@example.invalid','commit','-qm','public source fixture');
  return {root,commit:git('rev-parse','HEAD').trim(),relative,git};
}
test('reviewed full source pin refuses masked transitive bytes, changed executable mode and untracked source',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'manager-source-'));
  try{
    const value=sourceFixture(base,'alpha','alpha');assert.deepEqual(assertPinnedSourceCheckout(value.root,value.commit),{root:value.root,commit:value.commit});
    value.git('update-index','--assume-unchanged','shared/engine.mjs');fs.writeFileSync(path.join(value.root,'shared/engine.mjs'),'export const engine=2;\n');
    assert.throws(()=>assertPinnedSourceCheckout(value.root,value.commit),/bytes or mode differ/);
    fs.writeFileSync(path.join(value.root,'shared/engine.mjs'),'export const engine=1;\n');fs.chmodSync(path.join(value.root,'shared/engine.mjs'),0o755);
    assert.throws(()=>assertPinnedSourceCheckout(value.root,value.commit),/bytes or mode differ/);
    fs.chmodSync(path.join(value.root,'shared/engine.mjs'),0o644);fs.writeFileSync(path.join(value.root,'shared/untracked.mjs'),'export const unexpected=true;\n');
    assert.throws(()=>assertPinnedSourceCheckout(value.root,value.commit),/untracked source/);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});
test('reviewed source refuses linked tracked files before opening external bytes',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'manager-source-link-'));
  try{
    const value=sourceFixture(base,'alpha','alpha'),target=path.join(base,'outside.mjs');fs.writeFileSync(target,'export const outside=true;\n');
    fs.unlinkSync(path.join(value.root,'shared/engine.mjs'));fs.symlinkSync(target,path.join(value.root,'shared/engine.mjs'));
    assert.throws(()=>assertPinnedSourceCheckout(value.root,value.commit),/tracked source differs|regular file/);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});
test('reviewed source bounded read refuses growth after fstat without reading beyond a fixed chunk',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'manager-source-growth-')),fstat=fs.fstatSync,read=fs.readSync;
  try{
    const value=sourceFixture(base,'alpha','alpha'),jobs=sourceFixture(base,'jobs','jobs'),limit=fs.statSync(path.join(value.root,value.relative)).size+1;let first=true,bytesRead=0;
    fs.fstatSync=descriptor=>{const stat=fstat(descriptor);if(first){first=false;fs.appendFileSync(path.join(value.root,value.relative),' '.repeat(32));}return stat;};
    fs.readSync=(descriptor,buffer,offset,length,position)=>{assert(buffer.length<=limit);assert(length<=limit);const count=read(descriptor,buffer,offset,length,position);bytesRead+=count;return count;};
    assert.throws(()=>prepareReviewedSourceModules({alphaRoot:value.root,jobsRoot:jobs.root,alphaCommit:value.commit,jobsCommit:jobs.commit}),/grew or changed/);assert.equal(bytesRead,limit);
  }finally{fs.fstatSync=fstat;fs.readSync=read;fs.rmSync(base,{recursive:true,force:true});}
});
test('configured root retarget between validation and actual imports cannot execute replacement modules',async()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'manager-source-import-')),realpath=fs.realpathSync;
  try{
    const alpha=sourceFixture(base,'reviewed-alpha','alpha'),jobs=sourceFixture(base,'reviewed-jobs','jobs');
    const badAlpha=sourceFixture(base,'unreviewed-alpha','alpha'),badJobs=sourceFixture(base,'unreviewed-jobs','jobs'),marker=path.join(base,'unreviewed-executed');
    for(const value of [badAlpha,badJobs])fs.writeFileSync(path.join(value.root,value.relative),`import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(marker)},'EXECUTED');export const kind='unreviewed';\n`);
    const alphaLink=path.join(base,'configured-alpha'),jobsLink=path.join(base,'configured-jobs');fs.symlinkSync(alpha.root,alphaLink);fs.symlinkSync(jobs.root,jobsLink);let retargeted=false;
    fs.realpathSync=(file,...args)=>{const result=realpath(file,...args);if(file===jobsLink&&!retargeted){retargeted=true;fs.unlinkSync(alphaLink);fs.symlinkSync(badAlpha.root,alphaLink);fs.unlinkSync(jobsLink);fs.symlinkSync(badJobs.root,jobsLink);}return result;};
    const loaded=await loadReviewedSourceModules({alphaRoot:alphaLink,jobsRoot:jobsLink,alphaCommit:alpha.commit,jobsCommit:jobs.commit});
    try{assert(retargeted);assert.equal(loaded.alpha.kind,'reviewed-alpha');assert.equal(loaded.jobs.kind,'reviewed-jobs');assert.equal(loaded.alphaSource.root,alpha.root);assert.equal(loaded.jobsSource.root,jobs.root);assert.equal(fs.existsSync(marker),false);}finally{loaded.dispose();}
  }finally{fs.realpathSync=realpath;fs.rmSync(base,{recursive:true,force:true});}
});
function sourceGraph(base,name,kind){
  const value=sourceFixture(base,name,kind),companion=path.join(path.dirname(value.relative),'companion.mjs');
  fs.writeFileSync(path.join(value.root,value.relative),`import {value} from './companion.mjs';export const checked=value;export const kind=${JSON.stringify(name)};\n`);
  fs.writeFileSync(path.join(value.root,companion),'export const value=1;\n');value.git('add','.');value.git('-c','user.name=Public fixture','-c','user.email=fixture@example.invalid','commit','-qm','public module graph');
  return {...value,commit:value.git('rev-parse','HEAD').trim(),companion};
}
for(const kind of ['alpha','jobs'])for(const edge of ['entry','transitive'])test('immutable '+kind+' '+edge+' load ignores same-path replacement restored before recheck',async()=>{
  const {registerHooks}=require('node:module'),base=fs.mkdtempSync(path.join(os.tmpdir(),'manager-memory-source-'));let prepared,hook;
  try{
    const alpha=sourceGraph(base,'alpha','alpha'),jobs=sourceGraph(base,'jobs','jobs'),target=kind==='alpha'?alpha:jobs,relative=edge==='entry'?target.relative:target.companion,file=path.join(target.root,relative),before=fs.readFileSync(file);
    prepared=prepareReviewedSourceModules({alphaRoot:alpha.root,jobsRoot:jobs.root,alphaCommit:alpha.commit,jobsCommit:jobs.commit});let replaced=0;
    hook=registerHooks({load(url,context,nextLoad){if(url.includes('/'+target.commit+'/')&&url.endsWith('/'+relative)){
      replaced++;fs.writeFileSync(file,`export const value=9;export const checked=9;export const kind='unreviewed';\n`);
      try{return nextLoad(url,context);}finally{fs.writeFileSync(file,before);}
    }return nextLoad(url,context);}});
    const loaded=await prepared.load();assert.equal(replaced,1);assert.equal(loaded[kind].checked,1);assert.equal(loaded[kind].kind,kind);assert.deepEqual(fs.readFileSync(file),before);assertPinnedSourceCheckout(target.root,target.commit);
  }finally{hook?.deregister();prepared?.dispose();fs.rmSync(base,{recursive:true,force:true});}
});
test('counterfactual origin-path import executes replacement even after bytes are restored before evaluation',async()=>{
  const {registerHooks}=require('node:module'),{pathToFileURL}=require('node:url'),base=fs.mkdtempSync(path.join(os.tmpdir(),'manager-origin-race-'));let hook;
  try{
    const alpha=sourceGraph(base,'alpha','alpha'),file=path.join(alpha.root,alpha.relative),before=fs.readFileSync(file),url=pathToFileURL(file).href;assertPinnedSourceCheckout(alpha.root,alpha.commit);
    hook=registerHooks({load(selected,context,nextLoad){if(selected===url){fs.writeFileSync(file,`export const checked=9;\n`);try{return nextLoad(selected,context);}finally{fs.writeFileSync(file,before);}}return nextLoad(selected,context);}});
    const loaded=await import(url);assert.equal(loaded.checked,9);assertPinnedSourceCheckout(alpha.root,alpha.commit);
  }finally{hook?.deregister();fs.rmSync(base,{recursive:true,force:true});}
});
for(const specifier of ['node:fs','unexpected-package','file:///unreviewed-module.mjs','../../../../outside.mjs'])test('captured module graph refuses '+specifier+' without filesystem fallback',async()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'manager-memory-denial-'));let prepared;
  try{
    const alpha=sourceFixture(base,'alpha','alpha'),jobs=sourceFixture(base,'jobs','jobs');fs.writeFileSync(path.join(alpha.root,alpha.relative),`import ${JSON.stringify(specifier)};export const kind='alpha';\n`);alpha.git('add','.');alpha.git('-c','user.name=Public fixture','-c','user.email=fixture@example.invalid','commit','-qm','denied import fixture');
    prepared=prepareReviewedSourceModules({alphaRoot:alpha.root,jobsRoot:jobs.root,alphaCommit:alpha.git('rev-parse','HEAD').trim(),jobsCommit:jobs.commit});await assert.rejects(prepared.load(),/Reviewed/);
  }finally{prepared?.dispose();fs.rmSync(base,{recursive:true,force:true});}
});
test('captured lazy imports stay bound to verified memory through inspector calls',async()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'manager-memory-lazy-'));let prepared;
  try{
    const alpha=sourceGraph(base,'alpha','alpha'),jobs=sourceFixture(base,'jobs','jobs'),file=path.join(alpha.root,alpha.companion),before=fs.readFileSync(file);
    fs.writeFileSync(path.join(alpha.root,alpha.relative),"export const late=()=>import('./companion.mjs');\n");alpha.git('add','.');alpha.git('-c','user.name=Public fixture','-c','user.email=fixture@example.invalid','commit','-qm','lazy pure import fixture');
    prepared=prepareReviewedSourceModules({alphaRoot:alpha.root,jobsRoot:jobs.root,alphaCommit:alpha.git('rev-parse','HEAD').trim(),jobsCommit:jobs.commit});const loaded=await prepared.load();
    fs.writeFileSync(file,'export const value=9;\n');try{assert.equal((await loaded.alpha.late()).value,1);}finally{fs.writeFileSync(file,before);}
    assertPinnedSourceCheckout(alpha.root,alpha.git('rev-parse','HEAD').trim());
  }finally{prepared?.dispose();fs.rmSync(base,{recursive:true,force:true});}
});
test('a virtual parent cannot promote its own relative module to an absolute virtual import',async()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'manager-memory-absolute-'));let prepared;
  try{
    const alpha=sourceGraph(base,'alpha','alpha'),jobs=sourceFixture(base,'jobs','jobs');
    fs.writeFileSync(path.join(alpha.root,alpha.relative),"export const late=()=>import(new URL('./companion.mjs',import.meta.url).href);\n");alpha.git('add','.');alpha.git('-c','user.name=Public fixture','-c','user.email=fixture@example.invalid','commit','-qm','absolute virtual import refusal');
    prepared=prepareReviewedSourceModules({alphaRoot:alpha.root,jobsRoot:jobs.root,alphaCommit:alpha.git('rev-parse','HEAD').trim(),jobsCommit:jobs.commit});const loaded=await prepared.load();await assert.rejects(loaded.alpha.late(),/only captured relative imports/);
  }finally{prepared?.dispose();fs.rmSync(base,{recursive:true,force:true});}
});
test('missing or wrong explicit source pins fail before any configured module can evaluate',async()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'manager-source-pin-'));
  try{
    const alpha=sourceFixture(base,'alpha','alpha'),jobs=sourceFixture(base,'jobs','jobs');
    await assert.rejects(loadReviewedSourceModules({alphaRoot:alpha.root,jobsRoot:jobs.root,alphaCommit:alpha.commit,jobsCommit:undefined}),/explicit full commit/);
    await assert.rejects(loadReviewedSourceModules({alphaRoot:alpha.root,jobsRoot:jobs.root,alphaCommit:'0'.repeat(40),jobsCommit:jobs.commit}),/commit differs/);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});
