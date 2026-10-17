// Disposable wrapper integration. Synthetic signer and consensus adapter only;
// this does not exercise a real key/TTY, provider, or the selected public account.
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import * as E from 'ethers';import solc from 'solc';
import runtime from '../scripts/runtime.cjs';
import W from '../scripts/deploy-core-tty.cjs';import P from '../scripts/core-creation-plan.cjs';import T from '../scripts/transaction-envelope.cjs';import A from '../scripts/actor-policy.cjs';import S from '../scripts/deployment-session.cjs';import F from './helpers/core-session-fixture.cjs';
const {ethers}=await runtime.getRuntime(),local=ethers.provider;
async function rpc(method,params){
 if(method==='eth_getBlockByNumber'&&params[0]==='finalized')params=['latest',params[1]];
 const at=params.at(-1);if(at?.requireCanonical){const b=await local.send('eth_getBlockByHash',[at.blockHash,false]);assert(b);assert.equal((await local.send('eth_getBlockByNumber',[b.number,false])).hash,at.blockHash);const result=await local.send(method,[...params.slice(0,-1),b.number]);assert.equal((await local.send('eth_getBlockByNumber',[b.number,false])).hash,at.blockHash);return result;}return local.send(method,params);
}
const suite=(await local.getNetwork()).chainId===1n?describe:describe.skip;
suite('Ubuntu Hardhat ephemeral creator wrapper on disposable Osaka',function(){
 this.timeout(180000);
 for(const marker of [false,true])it(`runs nine exact CREATEs, explicit four roots and paused d76 (${marker?'marker with lost-response resume':'empty account'})`,async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'manager-tty-evm-'));
  try{
   const wallet=E.Wallet.createRandom(),registry='0x2222222222222222222222222222222222222222',target='0x5555555555555555555555555555555555555555',markerCode='0xef0100'+target.slice(2),targetCode='0xfe';
   await local.send('hardhat_setBalance',[wallet.address,E.toQuantity(E.parseEther('10'))]);await local.send('hardhat_setCode',[registry,'0x00']);
   if(marker){await local.send('hardhat_setCode',[target,targetCode]);await local.send('hardhat_setCode',[wallet.address,markerCode]);}
   const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'Token.sol':{content:'pragma solidity ^0.8.20; contract Token { function decimals() external pure returns(uint8){return 6;} function paused() external pure returns(bool){return false;} function isBlacklisted(address) external pure returns(bool){return false;} }'}},settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['evm.deployedBytecode.object']}}}})));
   await local.send('hardhat_setCode',[F.config(wallet.address).constructorArgs.usdcTokenAddress,'0x'+compiled.contracts['Token.sol'].Token.evm.deployedBytecode.object]);await local.send('hardhat_mine',['0x1']);
   const qualified=F.actualCatalog(directory),block=await A.pin(rpc),config=F.config(wallet.address,{registry,block:{number:block.number,hash:block.hash}});config.constructorArgs.rootNodes=['club.agi.eth','agent.agi.eth','alpha.club.agi.eth','alpha.agent.agi.eth'].map(E.namehash);
   if(marker){
    const operations=P.makePlan(config,qualified,F.source).operations,policy={mode:A.MARKER,delegationCode:markerCode,target,targetCodeHash:E.keccak256(targetCode),qualification:{consensusEvidenceSha256:'1'.repeat(64),directExecutionEvidenceSha256:'2'.repeat(64)}};
    const scope=A.qualificationScope(policy,wallet.address,{source:F.source,buildId:qualified.id,buildDigest:qualified.buildDigest,catalogSha256:qualified.catalogSha256,block:config.block,executionHardfork:'osaka',operations});
    const reports={consensusEvidenceSha256:{schema:'manager-direct-consensus-report-v1',disposition:'direct-type2-create-does-not-invoke-origin-code',scope,reviewReference:'SYNTHETIC WRAPPER FIXTURE; NOT ACTUAL ACCOUNT QUALIFICATION',artifacts:{consensusSourceSha256:'3'.repeat(64),analysisSha256:'4'.repeat(64)}},directExecutionEvidenceSha256:{schema:'manager-direct-execution-report-v1',disposition:'nine-direct-creates-no-creator-or-target-invocation',scope,reviewReference:'SYNTHETIC WRAPPER FIXTURE; PRIOR RETAINED TRACE PROOF IS SEPARATE',artifacts:{sourceCallGraphSha256:'5'.repeat(64),initcodeCallGraphSha256:'6'.repeat(64),traceSha256:'7'.repeat(64)},invocations:{creator:0,target:0}}};
    policy.qualification=Object.fromEntries(Object.entries(reports).map(([name,report])=>[name,T.digest(report)]));config.creatorPolicy=policy;config.qualificationEvidence={schema:'manager-marker-direct-qualification-evidence-v1',scope,reports};
   }
   const plan=P.makePlan(config,qualified,F.source),lockDirectory=path.join(directory,'locks');fs.mkdirSync(lockDirectory);
   const run={mode:'new',session:path.join(directory,'session'),lockDirectory,finalityTimeoutSeconds:10,pollIntervalSeconds:5},context={directory:run.session,source:F.source,qualified,revalidateSource:()=>true};
   let prompts=0,signatures=0,sends=0,closed=0,lost=marker;const records=[];
   const inputs={run,plan,context,freshRpc:()=>rpc,confirm:async p=>{assert.equal(p.payloadSha256,plan.payloadSha256);return true;},openSigner:async creator=>{prompts++;const signer=await W.ephemeralSigner(creator,async()=>wallet.privateKey);return {address:signer.address,async signExact(envelope){signatures++;return signer.signExact(envelope);},close(){closed++;signer.close();}};},relay:(ctx,acknowledgement)=>S.submit(ctx,{acknowledgement,transmit:async raw=>{const decoded=E.Transaction.from(raw);assert.equal(decoded.type,2);assert.equal(decoded.to,null);assert.equal(decoded.authorizationList,null);assert.equal(decoded.from,wallet.address);sends++;const result=await local.send('eth_sendRawTransaction',[raw]);if(lost){lost=false;throw Error('synthetic lost response');}return result;}}),emit:x=>records.push(x)};
   if(marker){await assert.rejects(W.runCampaign(inputs),/lost response/);assert.equal(signatures,1);assert.equal(sends,1);assert.equal(closed,1);assert.equal(S.readSession(run.session).state[0].status,'submission-attempted');run.mode='resume';}
   const result=await W.runCampaign(inputs);assert.equal(result.proofs.length,9);assert.equal(result.activationAuthorized,false);assert.equal(signatures,9);assert.equal(sends,9);assert.equal(prompts,marker?2:1);assert.equal(closed,prompts);assert.equal(S.readSession(run.session).released,true);assert.equal(fs.readdirSync(lockDirectory).length,0);
   const manager=new E.Contract(plan.operations[8].predictedAddress,qualified.records.AGIJobManager.artifact.abi,local);assert.equal(await manager.owner(),P.GOVERNOR);assert.equal(await manager.pendingOwner(),E.ZeroAddress);assert.equal(await manager.paused(),true);for(const name of ['moderators','additionalAgents','additionalValidators'])assert.equal(await manager[name](wallet.address),false);for(const [i,name] of ['clubRootNode','agentRootNode','alphaClubRootNode','alphaAgentRootNode'].entries())assert.equal(await manager[name](),config.constructorArgs.rootNodes[i]);
   if(marker){assert.equal(await local.getCode(wallet.address),markerCode);assert.equal(await local.getCode(target),targetCode);}assert.equal(await local.getTransactionCount(wallet.address),9);
   const report={scope:'DISPOSABLE WRAPPER FUNCTIONAL PROOF; SYNTHETIC SOURCE IDENTITY AND FINALITY ADAPTER; NO REAL KEY OR PROVIDER',mode:config.creatorPolicy.mode,planSha256:plan.payloadSha256,governor:P.GOVERNOR,manager:plan.operations[8].predictedAddress,signatures,sends,prompts,paused:true,receiptProofs:result.proofs,sourceContractBuildDigest:qualified.buildDigest};
   if(process.env.MANAGER_TTY_TEST_REPORT){fs.appendFileSync(process.env.MANAGER_TTY_TEST_REPORT,JSON.stringify(report)+'\n');}console.log('MANAGER_TTY_DISPOSABLE_RESULT '+JSON.stringify(report));
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
 });
});
