'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const packageRoot = path.resolve(__dirname,'..');
const candidate = fs.readFileSync(path.join(packageRoot,'scripts/check-readiness.cjs'),'utf8');
const policySource = fs.readFileSync(path.join(packageRoot,'scripts/nft-policy.cjs'),'utf8');
const A='0x'+'1'.repeat(40), B='0x'+'2'.repeat(40), C='0x'+'3'.repeat(40), Z='0x'+'0'.repeat(40), H='0x'+'1'.repeat(64), ZH='0x'+'0'.repeat(64);
function fixture() {
  const state={owner:A,pendingOwner:Z,paused:true,settlementPaused:false,balance:0n,reserves:[0n,0n,0n,0n,0n],changedBlock:false,changedCode:false,issuerFailure:false};
  const libraries=['UriUtils','TransferUtils','BondMath','ReputationMath','ENSOwnership','NftEligibility','JobSettlement','JobValidation'];
  const fqns=Object.fromEntries([...libraries,'AGIJobManager'].map(n=>[n,`${n}.sol:${n}`]));
  const receipt={status:'awaiting_readiness_review',chainId:1,network:'mainnet',finalOwner:A,configHash:H,
    constructorArgs:{usdcTokenAddress:C,baseIpfsUrl:'ipfs://',ensConfig:[B,Z],rootNodes:[ZH,ZH,ZH,ZH],merkleRoots:[ZH,ZH],settlementWallets:[A,B]},
    contracts:Object.fromEntries([...libraries,'AGIJobManager'].map(n=>[n,{address:B,runtimeCodeHash:H,txHash:H,blockNumber:1}])),
    libraries:Object.fromEntries(libraries.map(n=>[fqns[n],B])),verification:Object.fromEntries([...libraries,'AGIJobManager'].map(n=>[n,{status:'verified'}]))};
  const expectedPolicy={agentNftRequired:false,agiTypes:[]};
  const snapshot={agentNftRequired:false,agiTypes:[],evidence:{count:0,slot:'77',blockNumber:44,transactionsBroadcast:0}};
  const trace=[], writes=[], logs=[];
  const manager={usdcToken:async()=>C,owner:async()=>state.owner,pendingOwner:async()=>state.pendingOwner,paused:async()=>state.paused,settlementPaused:async()=>state.settlementPaused,
    wallet30:async()=>A,wallet10:async()=>B,ens:async()=>B,nameWrapper:async()=>Z};
  for(const name of ['clubRootNode','agentRootNode','alphaClubRootNode','alphaAgentRootNode','validatorMerkleRoot','agentMerkleRoot'])manager[name]=async()=>ZH;
  for(const [i,name] of ['lockedEscrow','lockedAgentBonds','lockedValidatorBonds','lockedDisputeBonds','lockedClaims'].entries())manager[name]=async()=>state.reserves[i];
  const provider={getNetwork:async()=>({chainId:1n}),getBlock:async which=>({number:44,hash:state.changedBlock&&which!=='latest'?ZH:H})};
  const ethers={provider,ZeroAddress:Z,isAddress:x=>typeof x==='string'&&/^0x[a-fA-F0-9]{40}$/.test(x),
    isHexString:(x,n)=>typeof x==='string'&&new RegExp(`^0x[a-fA-F0-9]{${n*2}}$`).test(x),
    toUtf8Bytes:x=>Buffer.from(x),keccak256:()=>H,getContractAt:async()=>manager,Contract:function(){this.balanceOf=async()=>state.balance;}};
  function load(source, injected) {
    const mod={exports:{}};
    const requireMock=id=>{if(Object.hasOwn(injected,id))return injected[id];throw new Error('Unexpected require '+id);};
    vm.runInNewContext(source,{module:mod,exports:mod.exports,require:requireMock,process:{env:{DEPLOYMENT_RECEIPT:'receipt.json',READINESS_NFT_CONFIG:'policy.json'},cwd:()=>'/virtual'},
      console:{log:x=>logs.push(x),error:x=>logs.push(x)},Buffer}, {timeout:1000});
    return mod.exports;
  }
  const policy=load(policySource,{'ethers':ethers,'../../scripts/lib/operations':{fetchAgiTypes:()=>{throw new Error('Old sentinel reader must not be used');}}});
  const safety={USDC_ABI:[],describeMembershipConfig:()=>({}),requireDeploymentNetwork:(name,id)=>assert.equal(id,1),
    requireCode:async()=>{trace.push('code');return '0x6000';},requireArtifactMatch:()=>{if(state.changedCode)throw new Error('runtime differs');},
    requireVerified:verification=>{trace.push('verification');if(Object.values(verification).some(x=>x.status!=='verified'))throw new Error('verification incomplete');},
    requireReadinessState:s=>{trace.push('ownership/accounting');
      if(s.owner.toLowerCase()!==s.finalOwner.toLowerCase())throw new Error('Final owner has not accepted ownership.');
      if(BigInt(s.pendingOwner)!==0n)throw new Error('pending ownership');
      if(!s.paused||s.settlementPaused)throw new Error('pause state');
      const reserved=s.reserves.reduce((x,y)=>x+BigInt(y),0n);
      if(reserved!==0n||s.balance<reserved)throw new Error('reserved balances');
      return {reserved:String(reserved),balance:String(s.balance)};},
    requireOperationalUSDC:async()=>{trace.push('issuer');if(state.issuerFailure)throw new Error('USDC issuer check');return {paused:false};}};
  const main=load(candidate,{'fs':{readFileSync:file=>JSON.stringify(file.endsWith('policy.json')?expectedPolicy:receipt),writeFileSync:(file,text,options)=>writes.push({file,text,options})},
    'path':path,'crypto':crypto,'./runtime.cjs':{getRuntime:async()=>({ethers,network:{name:'mainnet'},artifacts:{readArtifact:async()=>({})}})},
    'ethers':ethers,'./deploy.cjs':{qualifiedBuild:async()=>({buildInfo:{}}),FQNS:fqns,LIBRARIES:libraries},'./deployment-safety.cjs':safety,
    './nft-policy.cjs':policy,'./nft-registry-snapshot.cjs':{readRegistrySnapshot:async options=>{trace.push('registry');assert.equal(options.calls.blockTag,44);if(state.snapshotError)throw state.snapshotError;return snapshot;}}}).main;
  return {main,state,receipt,expectedPolicy,snapshot,trace,writes};
}
test('standard full checker completes with empty observed registry, accepted owner, paused intake and original gates',async()=>{
  const f=fixture();await f.main();assert.equal(f.writes.length,1);
  const r=JSON.parse(f.writes[0].text);assert.equal(r.checksPassed,true);assert.equal(r.intakePaused,true);assert.equal(r.transactionsBroadcast,0);
  assert.equal(r.nftPolicy.enumeration.count,0);assert.equal(r.nftPolicy.enumeration.slot,'77');assert.equal(f.writes[0].options.flag,'wx');
  assert.equal(f.trace.filter(x=>x==='code').length,9);
  assert(f.trace.indexOf('ownership/accounting')<f.trace.indexOf('registry'));assert(f.trace.indexOf('registry')<f.trace.indexOf('issuer'));
});
for(const [label,mutate,pattern] of [
 ['unaccepted owner',f=>f.state.owner=B,/owner/],['pending proposal',f=>f.state.pendingOwner=B,/pending/],
 ['open intake',f=>f.state.paused=false,/pause/],['paused settlement',f=>f.state.settlementPaused=true,/pause/],
 ['pending USDC claim',f=>f.state.reserves[4]=1n,/reserved/],['changed runtime',f=>f.state.changedCode=true,/runtime/],
 ['failed verification receipt',f=>f.receipt.verification.AGIJobManager.status='failed',/verification/],
 ['issuer failure',f=>f.state.issuerFailure=true,/issuer/],['block changed',f=>f.state.changedBlock=true,/block changed/],
 ['unexpected NFT collection',f=>f.snapshot.agiTypes=[{nftAddress:A,payoutPercentage:'1'}],/policy differs/],
 ['disabled unreviewed collection',f=>f.snapshot.agiTypes=[{nftAddress:A,payoutPercentage:'0'}],/policy differs/],
 ['required but empty registry',f=>f.snapshot.agentNftRequired=true,/no collection/],
 ['registry transport failure',f=>f.state.snapshotError=Object.assign(new Error('transport failure'),{code:3}),/transport/]])
 test(`no readiness report for ${label}`,async()=>{const f=fixture();mutate(f);await assert.rejects(f.main(),pattern);assert.equal(f.writes.length,0);});
