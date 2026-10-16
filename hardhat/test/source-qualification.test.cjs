'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const T=require('../scripts/transaction-envelope.cjs'),A=require('../scripts/actor-policy.cjs'),P=require('../scripts/core-creation-plan.cjs');
const creator='0x1111111111111111111111111111111111111111',target='0x2222222222222222222222222222222222222222';
const kinds=['consensusEvidenceSha256','forkEvidenceSha256','delegateReviewSha256'];
function qualification(){
 const policy={mode:A.DELEGATED,delegationCode:'0xef0100'+target.slice(2),target,targetCodeHash:'0x'+'ab'.repeat(32),stateChecks:[{to:target,data:'0x12345678',resultHash:'0x'+'cd'.repeat(32)}],qualification:Object.fromEntries(kinds.map(k=>[k,'e'.repeat(64)]))};
 const context={source:{commit:'a'.repeat(40),tree:'b'.repeat(40),rootLockSha256:'c'.repeat(64),hardhatLockSha256:'d'.repeat(64)},buildId:'reviewed-test-build',buildDigest:'e'.repeat(64),catalogSha256:'f'.repeat(64),block:{number:100,hash:'0x'+'12'.repeat(32)},executionHardfork:'osaka'};
 const scope=A.qualificationScope(policy,creator,context),reports=Object.fromEntries(kinds.map((kind,index)=>[kind,{scope,disposition:'pass',reviewReference:'disposable-test-only',kind:index}]));
 policy.qualification=Object.fromEntries(kinds.map(kind=>[kind,T.digest(reports[kind])]));
 return {policy,context,evidence:{schema:'manager-delegated-qualification-evidence-v2',scope,reports}};
}
test('qualification v2 binds reviewed full source/build/block/fork/state scope and accepts empty EOA independently',()=>{
 const {policy,context,evidence}=qualification();assert.doesNotThrow(()=>A.validateEvidence(policy,creator,evidence,context));
 assert.equal(evidence.scope.executionHardfork,'osaka');assert.deepEqual(evidence.scope.stateChecks,policy.stateChecks);
 assert.doesNotThrow(()=>A.validateEvidence({mode:A.EMPTY},creator,null));
 assert.throws(()=>A.validateEvidence(policy,creator,evidence),/Missing or unsupported fields/);
});
for(const key of ['commit','tree','rootLockSha256','hardhatLockSha256','buildId','buildDigest','catalogSha256','blockNumber','blockHash','executionHardfork'])test(`qualification reports reject transplanted ${key}`,()=>{
 const {policy,context,evidence}=qualification();
 if(Object.hasOwn(context.source,key))context.source[key]='9'.repeat(key.endsWith('Sha256')?64:40);
 else if(key==='blockNumber')context.block.number++;
 else if(key==='blockHash')context.block.hash='0x'+'34'.repeat(32);
 else if(key==='executionHardfork')context.executionHardfork='shanghai';
 else context[key]=key==='buildId'?'other-reviewed-build':'9'.repeat(64);
 assert.throws(()=>A.validateEvidence(policy,creator,evidence,context),/scope differs|Osaka/);
});
for(const key of ['to','data','resultHash'])test(`qualification reports reject changed delegate state-check ${key}`,()=>{
 const {policy,context,evidence}=qualification();policy.stateChecks[0][key]=key==='to'?creator:key==='data'?'0x87654321':'0x'+'ef'.repeat(32);
 assert.throws(()=>A.validateEvidence(policy,creator,evidence,context),/scope differs/);
});
test('rehashing a stale report does not replace the expected scope and old evidence versions reject',()=>{
 const {policy,context,evidence}=qualification();
 const old=structuredClone(evidence);old.schema='manager-delegated-qualification-evidence-v1';assert.throws(()=>A.validateEvidence(policy,creator,old,context),/scope differs/);
 const stale=structuredClone(evidence);stale.reports.delegateReviewSha256.scope=structuredClone(stale.reports.delegateReviewSha256.scope);stale.reports.delegateReviewSha256.scope.block.number=99;
 policy.qualification.delegateReviewSha256=T.digest(stale.reports.delegateReviewSha256);
 assert.throws(()=>A.validateEvidence(policy,creator,stale,context),/another source\/build\/block/);
});
function repo(t,label='source'){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),`manager-${label}-qualification-`));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('GIT_')));
 const git=(...args)=>cp.execFileSync('git',args,{cwd:directory,encoding:'utf8',env,stdio:['ignore','pipe','pipe']}).trim();
 git('init','--quiet');fs.mkdirSync(path.join(directory,'hardhat'));fs.writeFileSync(path.join(directory,'package-lock.json'),'{}\n');fs.writeFileSync(path.join(directory,'hardhat/package-lock.json'),'{}\n');fs.writeFileSync(path.join(directory,'tracked.txt'),`${label}\n`);
 git('add','.');git('-c','user.name=Disposable Test','-c','user.email=test@example.invalid','commit','--quiet','-m','Disposable source observation fixture');
 return {directory,git};
}
function withGitEnv(values,fn){const saved=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));Object.assign(process.env,values);try{return fn();}finally{for(const [key,value] of Object.entries(saved))if(value===undefined)delete process.env[key];else process.env[key]=value;}}
test('source observation hashes exact clean tracked files and lockfiles',t=>{
 const r=repo(t);const source=P.observedRevision(r.directory);assert.equal(source.commit,r.git('rev-parse','HEAD'));assert.equal(source.tree,r.git('rev-parse','HEAD^{tree}'));assert.equal(source.rootLockSha256,T.digest('{}\n'));
});
test('Git repository/config/index environment injection cannot replace requested source',t=>{
 const intended=repo(t,'intended'),other=repo(t,'unrelated');
 const source=withGitEnv({GIT_DIR:path.join(other.directory,'.git'),GIT_WORK_TREE:other.directory,GIT_INDEX_FILE:path.join(other.directory,'.git/index'),GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.worktree',GIT_CONFIG_VALUE_0:other.directory},()=>P.observedRevision(intended.directory));
 assert.equal(source.commit,intended.git('rev-parse','HEAD'));assert.notEqual(source.commit,other.git('rev-parse','HEAD'));
 const absent=fs.mkdtempSync(path.join(os.tmpdir(),'manager-no-git-source-'));t.after(()=>fs.rmSync(absent,{recursive:true,force:true}));
 assert.throws(()=>withGitEnv({GIT_DIR:path.join(other.directory,'.git'),GIT_WORK_TREE:other.directory},()=>P.observedRevision(absent)));
});
test('a source subdirectory cannot stand in for the repository root',t=>{
 const r=repo(t);assert.throws(()=>P.observedRevision(path.join(r.directory,'hardhat')),/toplevel differs/);
});
for(const flag of ['--assume-unchanged','--skip-worktree'])test(`source observation rejects hidden tracked changes with ${flag}`,t=>{
 const r=repo(t);r.git('update-index',flag,'tracked.txt');fs.writeFileSync(path.join(r.directory,'tracked.txt'),'hidden change\n');assert.equal(r.git('status','--porcelain'),'');
 assert.throws(()=>P.observedRevision(r.directory),/assume-unchanged or skip-worktree/);
});
test('tracked bytes are compared to Git blobs even when line-ending normalization hides raw byte changes',t=>{
 const r=repo(t);
 fs.writeFileSync(path.join(r.directory,'.gitattributes'),'tracked.txt text eol=lf\n');r.git('add','.gitattributes');r.git('-c','user.name=Disposable Test','-c','user.email=test@example.invalid','commit','--quiet','-m','Disposable normalization fixture');
 fs.writeFileSync(path.join(r.directory,'tracked.txt'),'source\r\n');r.git('add','tracked.txt');assert.equal(r.git('status','--porcelain'),'');
 assert.throws(()=>P.observedRevision(r.directory),/Tracked source bytes differ/);
});
test('source observation catches executable mode drift hidden by core.filemode=false',t=>{
 const r=repo(t);r.git('config','core.filemode','false');fs.chmodSync(path.join(r.directory,'tracked.txt'),0o755);assert.equal(r.git('status','--porcelain'),'');
 assert.throws(()=>P.observedRevision(r.directory),/executable mode changed/);
});
test('source observation does not execute repository-local clean filters',t=>{
 const r=repo(t),sentinel=path.join(r.directory,'FILTER_EXECUTED');
 fs.writeFileSync(path.join(r.directory,'.gitattributes'),'tracked.txt filter=sentinel\n');r.git('add','.gitattributes');r.git('-c','user.name=Disposable Test','-c','user.email=test@example.invalid','commit','--quiet','-m','Disposable filter declaration');
 r.git('config','filter.sentinel.clean',`touch '${sentinel}'; cat`);fs.writeFileSync(path.join(r.directory,'tracked.txt'),'changed working content\n');
 assert.throws(()=>P.observedRevision(r.directory),/Tracked source bytes differ/);assert.equal(fs.existsSync(sentinel),false);
});
test('source observation rejects staged changes and untracked files without content-filter execution',t=>{
 const staged=repo(t);fs.writeFileSync(path.join(staged.directory,'tracked.txt'),'staged change\n');staged.git('add','tracked.txt');assert.throws(()=>P.observedRevision(staged.directory),/index differs/);
 const untracked=repo(t);fs.writeFileSync(path.join(untracked.directory,'new.txt'),'unreviewed');assert.throws(()=>P.observedRevision(untracked.directory),/untracked files/);
});
