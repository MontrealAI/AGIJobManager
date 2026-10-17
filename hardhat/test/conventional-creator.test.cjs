'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),E=require('ethers');
const A=require('../scripts/actor-policy.cjs'),P=require('../scripts/core-creation-plan.cjs'),T=require('../scripts/deploy-core-tty.cjs'),R=require('../scripts/deployment-rpc.cjs'),F=require('./helpers/core-session-fixture.cjs');
const creator=new E.Wallet('0x'+'01'.repeat(32)).address,policy={mode:A.CONVENTIONAL};
test('conventional policy takes no qualification or target fields',()=>{
 assert.equal(A.validatePolicy(policy,creator),policy);assert.doesNotThrow(()=>A.validateEvidence(policy,creator,null));
 for(const evidence of [{},[],undefined])assert.throws(()=>A.validateEvidence(policy,creator,evidence));
 for(const key of ['target','targetCodeHash','delegationCode','qualification','stateChecks'])assert.throws(()=>A.validatePolicy({...policy,[key]:null},creator));
 assert.throws(()=>A.qualificationScope(policy,creator,{}));assert.throws(()=>A.markerQualificationScope(policy,creator,{}));
});
for(const code of ['0x','0xef0100'+'22'.repeat(20),'0xef0100'+creator.slice(2).toLowerCase(),'0x6000'])test(`conventional origin code is observation only: ${code}`,async()=>{
 const calls=[],block={number:1,hash:'0x'+'12'.repeat(32)};
 const rpc=async(method,args)=>{calls.push([method,args]);if(method==='eth_chainId')return '0x1';if(method==='eth_getBlockByNumber')return {...block,number:'0x1',gasLimit:'0x1000000',baseFeePerGas:'0x1'};if(method==='eth_getCode'){assert([creator,P.GOVERNOR].includes(args[0]));return args[0]===creator?code:'0x';}throw Error('Unexpected target/state request');};
 const result=await A.observeActor(rpc,{creator,governor:P.GOVERNOR,creatorPolicy:policy},block);assert.equal(result.creatorCodeHash,E.keccak256(code));assert.equal(calls.filter(([m])=>m==='eth_getCode').length,2);
 // This layer does not claim arbitrary contract code can originate: node validation remains authoritative.
 if(code!=='0x')await assert.rejects(A.observeActor(rpc,{creator,governor:P.GOVERNOR,creatorPolicy:{mode:A.EMPTY}},block),/Empty-code/);
});
test('conventional real-artifact plan preserves exact envelopes, governance, budget and narrow output',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'conventional-plan-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const build=F.actualCatalog(dir),config=F.config(creator);config.creatorPolicy=policy;
 const plan=P.makePlan(config,build,F.source);assert.equal(T.requireCreatorPlan(plan),true);assert.equal(P.checkPlan(plan,build,F.source),plan);assert.equal(R.scopeFor(plan).length,new Set(R.scopeFor(plan)).size);
 assert.match(T.publicReview(plan).assurance,/Conventional transaction correctness only/);assert.match(T.publicReview(plan).assurance,/No wallet qualification/);
 assert.equal(T.publicReview(P.makePlan(F.config(creator),build,F.source)).assurance,undefined);
 for(const operation of plan.operations){assert.equal(operation.envelope.type,2);assert.equal(operation.envelope.to,null);assert.equal(operation.envelope.value,'0');assert.deepEqual(operation.envelope.accessList,[]);assert.equal(operation.envelope.authorizationList,undefined);}
 assert.throws(()=>P.makePlan({...config,qualificationEvidence:{}},build,F.source));assert.throws(()=>P.makePlan({...config,maximumTotalFeeWei:'1'},build,F.source));
 assert.throws(()=>T.requireCreatorPlan(P.makePlan({...config,creator:P.GOVERNOR},build,F.source)),/different accounts/);
 for(const change of [p=>p.operations[0].envelope.to=creator,p=>p.operations[0].envelope.type=4,p=>p.operations[0].envelope.authorizationList=[],p=>p.operations[0].envelope.value='1']){const bad=structuredClone(plan);change(bad);assert.throws(()=>T.requireCreatorPlan(bad));}
});
