'use strict';
// Disposable simulated-chain acceptance only. Never selects a URL, real wallet or live authority.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,(_,item)=>typeof item==='bigint'?item.toString():item,2)+'\n';
function bounded(file,maximum=8_388_608){
  const descriptor=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  try{const info=fs.fstatSync(descriptor);assert(info.isFile()&&info.size<=maximum,'Bounded regular input required');const bytes=fs.readFileSync(descriptor);assert(bytes.length<=maximum);return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}finally{fs.closeSync(descriptor);}
}
function assertDisposableConfig(config){
  assert.deepEqual(Object.keys(config.networks),['hardhat'],'Only the in-process fixture network may exist');
  const network=config.networks.hardhat;
  assert.equal(network.type,'edr-simulated');assert.equal(network.chainId,31337);assert.equal(network.forking,undefined);assert.equal(network.url,undefined);
  assert.equal(network.accounts?.mnemonic,'test test test test test test test test test test test junk','Only known disposable fixture accounts may sign');
}
async function main(){
  const input=process.env.FQR_DRAFT_FILE,alphaRoot=process.env.FQR_ALPHA_SOURCE,jobsRoot=process.env.FQR_JOBS_SOURCE,output=process.env.FQR_EVIDENCE_FILE;
  for(const file of [input,alphaRoot,jobsRoot,output])assert(path.isAbsolute(file??''),'Explicit absolute draft, reviewed source roots and absent evidence output required');
  assert(!fs.existsSync(output),'Refuse to overwrite retained evidence');
  assert(!fs.existsSync(path.join(ROOT,'hardhat/.env')),'Use a disposable checkout without an operator .env');
  const load=(root,relative)=>import(pathToFileURL(path.join(root,relative)).href);
  const alpha=await load(alphaRoot,'examples/successor-alpha/computer.mjs'),jobs=await load(jobsRoot,'integrations/alpha-agent/four-repo-computer-receipt.mjs');
  const adapter=await load(ROOT,'scripts/integrations/four-repo-computer-receipt.mjs'),raw=bounded(input);
  const options={inspectAlphaReturn:alpha.inspectComputerReturn,inspectComputerEvidence:jobs.inspectComputerReceiptEvidence};
  const draft=await adapter.inspectComputerReceiptDraft(raw,options);
  const corrupted=JSON.parse(draft.original.returnRaw);corrupted.observedText+=' altered';
  await assert.rejects(adapter.createComputerReceiptDraft({...draft.original,returnRaw:JSON.stringify(corrupted)},{...options,budgetUSDC:draft.planning.budgetUSDC,createdAt:draft.createdAt}));
  const started=performance.now(),{createHardhatRuntimeEnvironment}=await import('hardhat/hre');
  const {default:base}=await load(ROOT,'hardhat.config.mjs');
  const config={...base,networks:{hardhat:{...base.networks.hardhat}}};
  assertDisposableConfig(config);
  if(process.env.FQR_ARTIFACTS_DIR){assert(path.isAbsolute(process.env.FQR_ARTIFACTS_DIR));config.paths={...config.paths,artifacts:process.env.FQR_ARTIFACTS_DIR};}
  const hre=await createHardhatRuntimeEnvironment(config,{config:path.join(ROOT,'hardhat.config.mjs')},ROOT),chain=await hre.network.connect('hardhat');
  try{
    const E=chain.ethers;assert.equal((await E.provider.getNetwork()).chainId,31337n);
    const rpc=(method,params=[])=>chain.provider.request({method,params}),send=async transaction=>(await transaction).wait();
    const [owner,employer,agent,v1,v2,v3,wallet30,wallet10]=await E.getSigners(),reviewers=[v1,v2,v3];
    const libraries={},deployments=[],receipts=[];
    const managerArtifact=await hre.artifacts.readArtifact('AGIJobManager'),buildId=await hre.artifacts.getBuildInfoId('AGIJobManager');
    const buildPath=await hre.artifacts.getBuildInfoPath(buildId),build=JSON.parse(fs.readFileSync(buildPath,'utf8'));
    const invert=Object.fromEntries(Object.entries(build.userSourceNameMap).map(([user,compiled])=>[compiled,user]));
    const sourceHashes={};
    for(const [name,entry] of Object.entries(build.input.sources)){
      let relative=invert[name];
      if(!relative&&name.startsWith('npm/@openzeppelin/contracts@4.9.6/'))relative='node_modules/@openzeppelin/contracts/'+name.slice('npm/@openzeppelin/contracts@4.9.6/'.length);
      assert(relative,'Every compiled input requires a current installed source');
      const bytes=fs.readFileSync(path.join(ROOT,relative));assert.equal(bytes.toString('utf8'),entry.content,'Compiled input differs: '+relative);sourceHashes[relative]=sha(bytes);
    }
    assert.equal(build.solcVersion,'0.8.37');assert.equal(build.input.settings.viaIR,true);
    assert.deepEqual(build.input.settings.optimizer,require('../compiler-optimizer.cjs').optimizer);
    async function deploy(name,args=[]){
      const artifact=await hre.artifacts.readArtifact(name),links={};
      for(const [source,names] of Object.entries(artifact.linkReferences??{}))for(const name of Object.keys(names)){assert(libraries[name]);links[source+':'+name]=libraries[name];}
      const factory=await E.getContractFactory(name,{libraries:links}),transaction=await factory.getDeployTransaction(...args);
      assert(E.dataLength(transaction.data)<=49152,'EIP-3860 remains enforced');
      const contract=await factory.deploy(...args);await contract.waitForDeployment();
      const receipt=await contract.deploymentTransaction().wait(),code=await E.provider.getCode(contract.target);assert(E.dataLength(code)<=24576,'EIP-170 remains enforced');
      deployments.push({name,address:contract.target,transactionHash:receipt.hash,runtimeSha256:sha(Buffer.from(code.slice(2),'hex')),runtimeBytes:E.dataLength(code)});return contract;
    }
    for(const name of ['UriUtils','TransferUtils','BondMath','ReputationMath','ENSOwnership','NftEligibility','JobSettlement','JobValidation'])libraries[name]=(await deploy(name)).target;
    const token=await deploy('MockERC20'),manager=await deploy('AGIJobManager',[token.target,'ipfs://',[E.ZeroAddress,E.ZeroAddress],Array(4).fill(E.ZeroHash),Array(2).fill(E.ZeroHash),[wallet30.address,wallet10.address],owner.address]);
    assert.equal(await token.decimals(),6n);assert.equal(await manager.paused(),true);
    await send(manager.addAdditionalAgent(agent.address));for(const reviewer of reviewers)await send(manager.addAdditionalValidator(reviewer.address));
    await send(manager.setCompletionReviewPeriod(60));await send(manager.setChallengePeriodAfterApproval(1));await send(manager.setDisputeReviewPeriod(60));await send(manager.unpauseIntake());
    for(const account of [employer,agent,...reviewers]){await send(token.mint(account.address,E.parseUnits('1000',6)));await send(token.connect(account).approve(manager.target,E.MaxUint256));}
    const payout=BigInt(draft.planning.amountBaseUnits),specURI='ipfs://four-repo-spec/sha256-'+sha(Buffer.from(draft.jobSpecification.raw)),completionURI='ipfs://four-repo-result/sha256-'+sha(Buffer.from(draft.original.returnRaw));
    const balances=async()=>Object.fromEntries(await Promise.all([employer,agent,...reviewers,wallet30,wallet10].map(async account=>[account.address,await token.balanceOf(account.address)])));
    const settlementTransfers=[];
    const record=(label,receipt)=>{receipts.push({label,transactionHash:receipt.hash,status:receipt.status,blockNumber:receipt.blockNumber,gasUsed:receipt.gasUsed.toString()});
      for(const log of receipt.logs)if(log.address.toLowerCase()===token.target.toLowerCase()){let event;try{event=token.interface.parseLog(log);}catch{continue;}if(event?.name==='Transfer')settlementTransfers.push({label,from:event.args.from,to:event.args.to,amountBaseUnits:event.args.value.toString()});}
    };
    const before=await balances();
    for(let jobId=0;jobId<2;jobId++){
      record('create-'+jobId,await send(manager.connect(employer).createJob(specURI,payout,3600,'Disposable computer receipt '+sha(Buffer.from(raw)))));
      assert.equal(await manager.getJobSpecURI(jobId),specURI);assert.equal((await manager.getJobCore(jobId)).payout,payout);
      record('apply-'+jobId,await send(manager.connect(agent).applyForJob(jobId,'fixture',[])));
      record('submit-'+jobId,await send(manager.connect(agent).requestJobCompletion(jobId,jobId===0?completionURI:completionURI+'-forged')));
      assert.equal(await manager.getJobCompletionURI(jobId),jobId===0?completionURI:completionURI+'-forged');
      for(const reviewer of reviewers)record((jobId===0?'approve-':'reject-')+jobId,await send(manager.connect(reviewer)[jobId===0?'validateJob':'disapproveJob'](jobId,'fixture',[])));
      if(jobId===0){await rpc('evm_increaseTime',[61]);await rpc('evm_mine');record('finalize-approved',await send(manager.finalizeJob(jobId)));assert.equal((await manager.getJobCore(jobId)).completed,true);}
      else{assert.equal((await manager.getJobCore(jobId)).disputed,true);await rpc('evm_increaseTime',[61]);await rpc('evm_mine');record('resolve-rejected-refund',await send(manager.resolveStaleDispute(jobId,true)));}
      if(jobId===0)var afterSuccess=await balances();
    }
    const after=await balances();assert(afterSuccess[agent.address]>before[agent.address],'Accepted fixture work must actually receive mock USDC');assert(after[agent.address]<=afterSuccess[agent.address],'Rejected fixture work must receive no net worker payout');
    assert(after[employer.address]>=afterSuccess[employer.address],'Rejected escrow must actually return to mock buyer');
    const rejectedTransfers=settlementTransfers.filter(t=>t.label==='resolve-rejected-refund');
    assert(rejectedTransfers.some(t=>t.to.toLowerCase()===employer.address.toLowerCase()&&BigInt(t.amountBaseUnits)>=payout),'Actual rejected settlement must transfer at least the complete escrow to the mock buyer');
    assert(!rejectedTransfers.some(t=>t.to.toLowerCase()===agent.address.toLowerCase()&&BigInt(t.amountBaseUnits)>0n),'Rejected settlement must have zero mock token transfer to worker');
    assert.equal(await manager.lockedEscrow(),0n);assert.equal(await manager.lockedAgentBonds(),0n);assert.equal(await manager.lockedValidatorBonds(),0n);
    const evidence={schema:'agijobmanager/four-repository-local-lifecycle/v1',scope:'DISPOSABLE_EDR_CHAIN_WITH_MOCK_USDC_AND_CONTROLLED_REVIEWER_VOTES',chainId:31337,publicNetwork:false,realWallets:false,fork:false,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),fixtureSha256:sha(fs.readFileSync(__filename)),draftSha256:sha(Buffer.from(raw)),project:draft.project,bindings:draft.bindings,specURI,completionURI,payoutBaseUnits:payout.toString(),decimals:6,deployments,sourceHashes,receipts,settlementTransfers,before,afterSuccess,after,invalidNativeReturnRejectedBeforeTransactions:true,successfulMockPayoutObserved:true,rejectedWorkRefunded:true,rejectedWorkerNetPayout:false,actualNativeBrowserClaim:false,controlledEconomicReview:true,independentEconomicReview:false,elapsedMilliseconds:performance.now()-started,productionApproved:false,settlementApproved:false,authority:'none'};
    fs.writeFileSync(output,json(evidence),{flag:'wx',mode:0o600});console.log(json({schema:evidence.schema,chainId:31337,transactions:receipts.length,successfulMockPayoutObserved:true,rejectedWorkRefunded:true,realWallets:false,elapsedMilliseconds:evidence.elapsedMilliseconds,evidenceFile:output}));
  }finally{await chain.close();}
}
module.exports={assertDisposableConfig};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
