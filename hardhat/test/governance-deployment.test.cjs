'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('ethers');
const g=require('../scripts/governance-deployment.cjs');
const f=require('../scripts/finalize-authority.cjs');
const A='0x'+'11'.repeat(20),B='0x'+'22'.repeat(20),C='0x'+'33'.repeat(20);
const constructorArgs={usdcTokenAddress:A,baseIpfsUrl:'ipfs://',ensConfig:[B,E.ZeroAddress],rootNodes:Array(4).fill(E.ZeroHash),merkleRoots:Array(2).fill(E.ZeroHash),settlementWallets:[B,C]};
const artifact=n=>({abi:[{type:'constructor',inputs:['address','string','address[2]','bytes32[4]','bytes32[2]','address[2]',...(n===7?['address']:[])].map(type=>({type}))}]});
const legacy=()=>({constructorArgs:structuredClone(constructorArgs),finalOwner:C});
const modern=()=>({...legacy(),schema:g.SCHEMA,ownershipInitialization:'explicit-constructor',constructorArgs:{...constructorArgs,initialGovernor:C}});
test('old six-argument receipts remain six-argument and cannot be silently reinterpreted against a new artifact',()=>{
 assert.equal(g.requireDeploymentSchema(legacy()),false);assert.equal(g.deploymentConstructor(legacy(),artifact(6)).length,6);
 assert.throws(()=>g.deploymentConstructor(legacy(),artifact(7)),/original six-argument build/);
 assert.equal(g.deploymentConstructor(modern(),artifact(7)).at(-1),C);assert.throws(()=>g.deploymentConstructor(modern(),artifact(6)),/schema differs/);
});
test('new ownership schema rejects missing/zero/substituted governor and ambiguous unversioned records',()=>{
 for(const change of [{schema:'unknown'},{ownershipInitialization:'deployer'},{constructorArgs:{...constructorArgs,initialGovernor:E.ZeroAddress}},{finalOwner:B}])assert.throws(()=>g.requireDeploymentSchema({...modern(),...change}));
 assert.throws(()=>g.requireDeploymentSchema({...legacy(),constructorArgs:{...constructorArgs,initialGovernor:C}}));
});
test('source binding includes full compiler input and exact compiler long version',()=>{
 const build={solcLongVersion:'0.8.37+commit.f401782d',input:{sources:{x:{content:'contract X{}'}},settings:{viaIR:true}}};
 assert.equal(g.buildDigest(build).length,64);assert.notEqual(g.buildDigest(build),g.buildDigest({...build,solcLongVersion:'other'}));
 assert.notEqual(g.buildDigest(build),g.buildDigest({...build,input:{...build.input,sources:{x:{content:'contract Y{}'}}}}));
});
const state=()=>({owner:async()=>C,pendingOwner:async()=>E.ZeroAddress,paused:async()=>true,moderators:async()=>false,additionalAgents:async()=>false,additionalValidators:async()=>false,ensJobPages:async()=>E.ZeroAddress,useEnsJobTokenURI:async()=>false,wallet30:async()=>B,wallet10:async()=>C});
test('direct authority fails closed on creator roles, wrong owner, pending transfer, activation and missing metadata getter',async()=>{
 for(const [key,value] of [['owner',A],['pendingOwner',B],['paused',false],['moderators',true],['additionalAgents',true],['additionalValidators',true],['ensJobPages',B],['useEnsJobTokenURI',true]]){
  const manager={...state(),[key]:async()=>value};await assert.rejects(g.readCreationAuthority(manager,{governor:C,creator:A}));
 }
 const manager=state();delete manager.useEnsJobTokenURI;await assert.rejects(g.readCreationAuthority(manager,{governor:C,creator:A}));
 const result=await g.readCreationAuthority(state(),{governor:C,creator:A});assert.equal(result.activationAuthorized,false);
});
test('direct finalization cannot claim complete ENS or setup-history clearance',async()=>{
 const receipt={...modern(),deployer:A,buildDigest:'a'.repeat(64),contracts:{AGIJobManager:{address:B}}};
 const review=f.normalizeReview({schema:'manager-direct-authority-review-v1',manager:B,governor:C,creator:A,buildDigest:receipt.buildDigest,
  roleSubjects:[A,C].map(address=>({address,moderator:false,agentException:false,validatorException:false})),metadata:{kind:'none',address:E.ZeroAddress,useEnsJobTokenURI:false}},receipt);
 const result=await f.inspectDirectAuthority({manager:state(),review,receipt});assert.equal(result.finalized,false);assert.equal(result.activationAuthorized,false);assert.equal(result.blockers.length,3);
 assert.throws(()=>f.normalizeReview({...review,roleSubjects:review.roleSubjects.slice(1)},receipt),/include creator/);
 await assert.rejects(f.inspectDirectAuthority({manager:{...state(),wallet30:async()=>A},review,receipt}),/Fee recipients changed/);
});
