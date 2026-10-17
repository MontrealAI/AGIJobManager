import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import runtime from '../scripts/runtime.cjs';
import core from '../scripts/deploy.cjs';
import router from '../scripts/deploy-job-pages.cjs';
import ensDeployment from '../scripts/deploy-ens-job-pages.cjs';
const native = await runtime.getRuntime(), {ethers,artifacts}=native;
const USDC='0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
// EDR has no EIP-1898 object-tag support. This test-only adapter verifies the
// requested canonical hash, makes genuine EVM reads at that block number, and
// checks the hash again. Production code has no number fallback.
const provider=new Proxy(ethers.provider,{get(target,key){
 if(key==='send')return async(method,params)=>{
  const ref=params.at(-1);
  if(ref&&typeof ref==='object'&&ref.requireCanonical===true){
   const block=await target.send('eth_getBlockByHash',[ref.blockHash,false]);assert(block);
   const before=await target.send('eth_getBlockByNumber',[block.number,false]);assert.equal(before.hash,ref.blockHash);
   const answer=await target.send(method,[...params.slice(0,-1),block.number]);
   const after=await target.send('eth_getBlockByNumber',[block.number,false]);assert.equal(after.hash,ref.blockHash);return answer;
  }return target.send(method,params);
 };
 const value=target[key];return typeof value==='function'?value.bind(target):value;
}});

const describeOptional=(await ethers.provider.getNetwork()).chainId===1n?describe:describe.skip;
describeOptional('Optional deployment scripts with genuine Manager/helper/router',function(){
 this.timeout(120000);
 let creator,governor,wallet30,wallet10,manager,registry,wrapper,resolver,links,dir,checkedSources;
 const localHre={...native,network:{name:'mainnet'},ethers:{...ethers,provider,getSigners:async()=>{throw Error('Keyless plan/recovery must not request a signer');}},config:{verify:{etherscan:{enabled:true,apiKey:'local-test-no-network'}}},run:async(task,args)=>{assert.equal(task,'verify:verify');checkedSources.push(args);return true;}};
 before(async()=>{
  assert.equal((await ethers.provider.getNetwork()).chainId,1n,'Use hardhat.optional-governance.config.mjs; no public provider');
  [creator,governor,wallet30,wallet10]=await ethers.getSigners();
  const token=await(await ethers.getContractFactory('MockERC20')).deploy();await token.waitForDeployment();
  await ethers.provider.send('hardhat_setCode',[USDC,await ethers.provider.getCode(await token.getAddress())]);
  links={};for(const name of core.LIBRARIES){const lib=await(await ethers.getContractFactory(name,{libraries:links})).deploy();await lib.waitForDeployment();links[core.FQNS[name]]=await lib.getAddress();}
  manager=await(await ethers.getContractFactory('AGIJobManager',{libraries:links})).deploy(USDC,'ipfs://',[ethers.ZeroAddress,ethers.ZeroAddress],Array(4).fill(ethers.ZeroHash),Array(2).fill(ethers.ZeroHash),[wallet30.address,wallet10.address],governor.address);await manager.waitForDeployment();
  registry=await(await ethers.getContractFactory('MockENSRegistry')).deploy();wrapper=await(await ethers.getContractFactory('MockNameWrapper')).deploy();resolver=await(await ethers.getContractFactory('MockPublicResolver')).deploy();await Promise.all([registry.waitForDeployment(),wrapper.waitForDeployment(),resolver.waitForDeployment()]);
 });
 beforeEach(()=>{dir=fs.mkdtempSync(path.join(os.tmpdir(),'real-optional-governance-'));checkedSources=[];});
 afterEach(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const options=()=>({dryRun:true,recover:false,confirmations:3,journalPath:path.join(dir,'original.json'),reportPath:path.join(dir,'recovery.json')});
 async function config(){const artifact=await artifacts.readArtifact(router.FQN),build=await artifacts.getBuildInfo(router.FQN);return {schema:'reviewed-job-pages-v2',chainId:1,owner:governor.address,creator:creator.address,transactionMode:'eoa-create',manager:await manager.getAddress(),managerCodeHash:ethers.keccak256(await ethers.provider.getCode(await manager.getAddress())),buildDigest:router.qualifiedArtifact(artifact,build),baseMetadataURI:'ipfs://reviewed/',externalUrlBase:'https://example.invalid/'};}
 async function deployedRouter(){
  const c=await config(),instance=await(await ethers.getContractFactory('AGIJobPages')).deploy(c.baseMetadataURI,c.externalUrlBase,c.owner);await instance.waitForDeployment();const tx=instance.deploymentTransaction(),receipt=await tx.wait();
  await ethers.provider.send('hardhat_mine',['0x2']);
  const journal={schema:router.SCHEMA,constructorSchema:'agi-job-pages-constructor-v2',ownershipInitialization:'explicit-constructor',config:c,buildDigest:c.buildDigest,creationDataHash:ethers.keccak256(tx.data),address:await instance.getAddress(),transactionHash:tx.hash,status:'incomplete',creationIntent:{schema:'creation-intent-v1',chainId:1,creator:c.creator,transactionMode:c.transactionMode,nonce:tx.nonce,to:null,value:'0',dataHash:ethers.keccak256(tx.data),startBlock:receipt.blockNumber,address:await instance.getAddress(),gasLimit:String(tx.gasLimit)}};
  const o=options();o.dryRun=false;o.recover=true;fs.writeFileSync(o.journalPath,JSON.stringify(journal));return {c,instance,journal,o};
 }
 it('dry-runs against the actual new Manager getter, distinct owner and sender, without keys or writes',async()=>{
  const c=await config(),result=await router.execute({hre:localHre,config:c,options:options()});
  assert.equal(result.status,'read_only_plan');assert.equal(result.managerState.owner,governor.address);assert.equal(result.managerState.useEnsJobTokenURI,false);assert.deepEqual(fs.readdirSync(dir),[]);assert.equal(checkedSources.length,0);
 });
 it('rejects real wrong-owner, wrong-source and wrong-chain plans',async()=>{
  const c=await config();for(const changed of [{...c,owner:creator.address},{...c,managerCodeHash:ethers.ZeroHash},{...c,chainId:11155111}])await assert.rejects(router.execute({hre:localHre,config:changed,options:options()}));
  assert.deepEqual(fs.readdirSync(dir),[]);
 });
 it('recovers an actual constructor-governed creation without redeployment or activation',async()=>{
  const {c,instance,journal,o}=await deployedRouter(),original=fs.readFileSync(o.journalPath),nonce=await ethers.provider.getTransactionCount(creator.address);
  const result=await router.execute({hre:localHre,config:c,options:o});assert.equal(result.status,'verified_unconfigured');assert.equal(result.owner,governor.address);assert.equal(result.jobManager,ethers.ZeroAddress);assert.equal(result.blockchainTransactionsBroadcast,0);
  assert.equal(await ethers.provider.getTransactionCount(creator.address),nonce);assert.deepEqual(fs.readFileSync(o.journalPath),original);assert.equal(await manager.paused(),true);assert.equal(await manager.ensJobPages(),ethers.ZeroAddress);assert.equal(await instance.owner(),governor.address);assert.deepEqual(checkedSources[0].constructorArguments,[c.baseMetadataURI,c.externalUrlBase,c.owner]);
  await assert.rejects(instance.connect(creator).setJobManager(c.manager));assert.equal(journal.creationIntent.creator,creator.address);
 });
 it('reconciles actual hashless creation from its saved nonce and refuses interrupted governor configuration',async()=>{
  const {c,instance,journal,o}=await deployedRouter();delete journal.transactionHash;fs.writeFileSync(o.journalPath,JSON.stringify(journal));
  assert.equal((await router.execute({hre:localHre,config:c,options:o})).status,'verified_unconfigured');
  await(await instance.connect(governor).setJobManager(c.manager)).wait();o.reportPath=path.join(dir,'partial.json');const nonce=await ethers.provider.getTransactionCount(creator.address);
  await assert.rejects(router.execute({hre:localHre,config:c,options:o}),/unconfigured constructor state/);assert.equal(await ethers.provider.getTransactionCount(creator.address),nonce);assert(!fs.existsSync(o.reportPath));assert.equal(await manager.ensJobPages(),ethers.ZeroAddress);assert.equal(await manager.paused(),true);
 });
 it('verifies the actual ENS helper unconfigured and emits only governor calldata; partial setup cannot become deployment success',async()=>{
  const root=ensDeployment.deriveJobsRootName(1,await manager.getAddress()),node=ethers.namehash(root),args=[await registry.getAddress(),await wrapper.getAddress(),await resolver.getAddress(),node,root,governor.address];
  const instance=await(await ethers.getContractFactory('ENSJobPages')).deploy(...args);await instance.waitForDeployment();const tx=instance.deploymentTransaction(),receipt=await tx.wait();await ethers.provider.send('hardhat_mine',['0x2']);
  const artifact=await artifacts.readArtifact(ensDeployment.FQN),buildInfo=await artifacts.getBuildInfo(ensDeployment.FQN);
  const journal={schema:ensDeployment.SCHEMA,constructorSchema:'ens-job-pages-constructor-v2',ownershipInitialization:'explicit-constructor',chainId:1,constructorArgs:args,finalOwner:governor.address,deployer:creator.address,transactionMode:'eoa-create',jobManager:await manager.getAddress(),managerCodeHash:ethers.keccak256(await ethers.provider.getCode(await manager.getAddress())),lockConfig:true,buildDigest:router.qualifiedArtifact(artifact,buildInfo,ensDeployment.FQN,['address','address','address','bytes32','string','address']),creationDataHash:ethers.keccak256(tx.data),address:await instance.getAddress(),transactionHash:tx.hash,status:'incomplete',namespace:{previousHelper:ethers.ZeroAddress,jobsRootName:root,jobsRootNode:node,jobLabelPrefix:'job-',rootOwner:ethers.ZeroAddress,rootResolver:ethers.ZeroAddress},creationIntent:{schema:'creation-intent-v1',chainId:1,creator:creator.address,transactionMode:'eoa-create',nonce:tx.nonce,to:null,value:'0',dataHash:ethers.keccak256(tx.data),startBlock:receipt.blockNumber,address:await instance.getAddress(),gasLimit:String(tx.gasLimit)}};
  const result=await ensDeployment.verifyEnsCreation({hre:localHre,journal,artifact,buildInfo,confirmations:3});assert.equal(result.status,'verified_unconfigured');assert.equal(result.configLocked,false);assert.equal(result.configuredManager,ethers.ZeroAddress);assert.equal(result.governorActionPlan.actions.length,3);assert.equal(await registry.owner(node),ethers.ZeroAddress);
  await assert.rejects(instance.connect(creator).setJobManager(await manager.getAddress()));await(await instance.connect(governor).setJobManager(await manager.getAddress())).wait();
  await assert.rejects(ensDeployment.verifyEnsCreation({hre:localHre,journal,artifact,buildInfo,confirmations:3}),/partial governor configuration/);assert.equal(await manager.ensJobPages(),ethers.ZeroAddress);assert.equal(await manager.paused(),true);
 });
});
