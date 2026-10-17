'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const E=require('ethers');
const {normalizeConfig,settings,qualifiedArtifact,execute,FQN,SCHEMA}=require('../scripts/deploy-job-pages.cjs');
const creator=E.getAddress('0x'+'33'.repeat(20));
const owner=E.getAddress('0x'+'11'.repeat(20)),manager=E.getAddress('0x'+'22'.repeat(20)),hash='0x'+'ab'.repeat(32),txHash='0x'+'cd'.repeat(32);
const config=()=>({schema:'reviewed-job-pages-v2',chainId:1,owner,creator,transactionMode:'eoa-create',manager,managerCodeHash:E.keccak256('0x6002'),buildDigest:'a'.repeat(64),baseMetadataURI:'ipfs://reviewed/',externalUrlBase:'https://example.invalid/'});
const abi=['constructor(string baseMetadataURI_,string externalUrlBase_,address initialGovernor)','function owner() view returns(address)','function jobManager() view returns(address)','function baseMetadataURI() view returns(string)','function externalUrlBase() view returns(string)','function useJobIdJsonSuffix() view returns(bool)','function defaultImageURI() view returns(string)'];
const managerABI=['function owner() view returns(address)','function pendingOwner() view returns(address)','function paused() view returns(bool)','function usdcToken() view returns(address)','function ensJobPages() view returns(address)','function useEnsJobTokenURI() view returns(bool)'];
function fixture(change={}){
 const fixtureAbi=change.legacy?abi.map(entry=>entry.startsWith('constructor')?'constructor(string,string)':entry):abi;
 const txCreator=change.legacy?owner:creator;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'router-check-')),calls=[],address=E.getCreateAddress({from:txCreator,nonce:2});
 const c=config(),artifact={contractName:'AGIJobPages',sourceName:'contracts/periphery/AGIJobPages.sol',abi:fixtureAbi,bytecode:'0x6000',deployedBytecode:'0x6001',linkReferences:{}};
 const buildInfo={solcVersion:'0.8.37',solcLongVersion:'0.8.37+commit.9e61f92b',input:{sources:{[artifact.sourceName]:{content:'fixture only'}},settings:{optimizer: structuredClone(require('../compiler-optimizer.cjs').optimizer),evmVersion:'shanghai',viaIR:true,metadata:{bytecodeHash:'none'},debug:{revertStrings:'strip'}}},output:{contracts:{[artifact.sourceName]:{AGIJobPages:{abi:fixtureAbi,evm:{bytecode:{object:'6000'},deployedBytecode:{object:'6001'}}}}}}};
 if(change.legacy){c.schema='reviewed-job-pages-v1';delete c.creator;delete c.transactionMode;}
 const args=[c.baseMetadataURI,c.externalUrlBase,...(change.legacy?[]:[c.owner])];
 c.buildDigest=qualifiedArtifact(artifact,buildInfo,FQN,change.legacy?['string','string']:['string','string','address']);
 const creationData=E.concat([artifact.bytecode,new E.Interface(fixtureAbi).encodeDeploy(args)]);
 const receipt={status:1,hash:txHash,contractAddress:address,blockNumber:98,blockHash:hash,logs:[],confirmations:async()=>3};
 const tx={hash:txHash,from:txCreator,to:null,data:creationData,value:0n,gasLimit:120000n,chainId:1n,nonce:2};
 const p={async send(method,params){calls.push(method);
  if(method==='eth_chainId')return change.chain||'0x1';
  if(method==='eth_getBlockByNumber')return {number:params[0]==='latest'?'0x64':params[0],hash:change.reorg&&params[0]!=='latest'?'0x'+'ef'.repeat(32):hash,...(params[1]===true?{transactions:change.noCreation?[]:[{...tx,...change.tx}]}:{})};
  if(change.unsupported)throw Error('RPC_SECRET_MUST_NOT_LEAK');
  assert.deepEqual(params.at(-1),{blockHash:hash,requireCanonical:true});
  if(method==='eth_getCode')return params[0]===creator?(change.creatorCode||'0x'):params[0]===manager?(change.managerCode||'0x6002'):(change.runtime||'0x6001');
  if(method==='eth_call'){
   const isManager=params[0].to===manager,iface=new E.Interface(isManager?managerABI:fixtureAbi),parsed=iface.parseTransaction({data:params[0].data});
   if(change.legacy&&parsed.name==='useEnsJobTokenURI')throw Error('Legacy getter does not exist');
   const values=isManager?{owner:change.managerOwner||owner,pendingOwner:change.pendingOwner||E.ZeroAddress,paused:change.unpaused?false:true,usdcToken:change.token||'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',ensJobPages:E.ZeroAddress,useEnsJobTokenURI:false}:{owner:change.routerOwner||owner,jobManager:change.attached?manager:E.ZeroAddress,baseMetadataURI:change.base||c.baseMetadataURI,externalUrlBase:c.externalUrlBase,useJobIdJsonSuffix:true,defaultImageURI:'ipfs://Qmc13BByj8xKnpgQtwBereGJpEXtosLMLq6BCUjK3TtAd1'};
   return iface.encodeFunctionResult(parsed.fragment,[values[parsed.name]]);
  }throw Error('Unexpected method '+method);
 },async getCode(){return change.creatorCode||'0x';},async getTransactionCount(){return 2;},async estimateGas(){calls.push('estimateGas');return change.gas||100000n;},async getTransactionReceipt(){return {...receipt,...change.receipt};},async getTransaction(){return {...tx,...change.tx};}};
 const hre={network:{name:change.network||'mainnet'},config:{verify:{etherscan:{enabled:true,apiKey:change.noKey?'':'fixture'}}},artifacts:{readArtifact:async()=>artifact,getBuildInfo:async()=>buildInfo},ethers:{provider:p,getSigners:async()=>{calls.push('getSigners');return [{provider:p,getAddress:async()=>change.signer||creator,sendTransaction:async()=>{calls.push('sendTransaction');if(change.sendSuccess)return tx;throw Error('ambiguous submission');}}];}},run:async(task,args)=>{calls.push('verify:verify');assert.equal(task,'verify:verify');assert.equal(args.contract,FQN);assert.deepEqual(args.constructorArguments,[c.baseMetadataURI,c.externalUrlBase,c.owner]);return change.verifyResult??true;}};
 const lockDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'creator-lock-'));
 const options={lockDirectory,dryRun:true,recover:false,confirmations:3,journalPath:path.join(dir,'journal.json'),reportPath:path.join(dir,'report.json'),confirmation:'I_UNDERSTAND_MAINNET_DEPLOYMENT'};
 const journal={constructorSchema:'agi-job-pages-constructor-v2',ownershipInitialization:'explicit-constructor',creationIntent:{schema:'creation-intent-v1',chainId:1,creator,transactionMode:'eoa-create',nonce:2,to:null,value:'0',dataHash:E.keccak256(creationData),startBlock:98,address,gasLimit:'120000'},schema:change.legacy?'agi-job-pages-deployment-v1':SCHEMA,config:normalizeConfig(c),buildDigest:c.buildDigest,creationDataHash:E.keccak256(creationData),address,transactionHash:txHash,status:'incomplete'};
 if(change.legacy){delete journal.constructorSchema;delete journal.ownershipInitialization;delete journal.creationIntent;options.legacyArtifactPath=path.join(dir,'legacy-artifact.json');options.legacyBuildInfoPath=path.join(dir,'legacy-build.json');fs.writeFileSync(options.legacyArtifactPath,JSON.stringify(artifact));fs.writeFileSync(options.legacyBuildInfoPath,JSON.stringify(buildInfo));}
 return {dir,calls,c,artifact,buildInfo,hre,options,journal,cleanup:()=>{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(lockDirectory,{recursive:true,force:true});}};
}
async function using(change,fn){const f=fixture(change);try{await fn(f);}finally{f.cleanup();}}
test('default plan is signer-free, explorer-free and writes no journal',()=>using({},async f=>{const r=await execute({hre:f.hre,config:f.c,options:f.options});assert.equal(r.status,'read_only_plan');assert.equal(r.attachmentAuthorized,false);assert.equal(r.blockchainTransactionsBroadcast,0);assert(!f.calls.includes('getSigners'));assert(!f.calls.includes('verify:verify'));assert.deepEqual(fs.readdirSync(f.dir),[]);}));
for(const [name,mutation] of Object.entries({factoryMode:c=>({...c,transactionMode:'factory-create'}),zeroCreator:c=>({...c,creator:E.ZeroAddress}),extra:c=>({...c,unexpected:true}),schema:c=>({...c,schema:'wrong'}),chain:c=>({...c,chainId:2}),zeroOwner:c=>({...c,owner:E.ZeroAddress}),badManager:c=>({...c,manager:'oops'}),missingHash:c=>({...c,managerCodeHash:''}),emptyURI:c=>({...c,baseMetadataURI:''}),oversize:c=>({...c,externalUrlBase:'a'.repeat(2049)}),control:c=>({...c,baseMetadataURI:'bad\n'})}))test('reject configuration '+name,()=>assert.throws(()=>normalizeConfig(mutation(config()))));
for(const [name,env] of Object.entries({missing:{},confirmations:{ROUTER_CONFIG:'x',CONFIRMATIONS:'2'},verifyDisabled:{ROUTER_CONFIG:'x',VERIFY:'0'},noJournal:{ROUTER_CONFIG:'x',DRY_RUN:'0'},recoverDry:{ROUTER_CONFIG:'x',ROUTER_REVERIFY:'1',ROUTER_JOURNAL:'x'},recoverNoOutput:{ROUTER_CONFIG:'x',ROUTER_REVERIFY:'1',DRY_RUN:'0',ROUTER_JOURNAL:'x'},badBoolean:{ROUTER_CONFIG:'x',DRY_RUN:'banana'}}))test('reject settings '+name,()=>assert.throws(()=>settings(env)));
for(const [name,change] of Object.entries({creatorContract:{creatorCode:'0x6000'},delegatedCreator:{creatorCode:'0xef0100'+'12'.repeat(20)},chain:{chain:'0x2'},network:{network:'hardhat'},managerRuntime:{managerCode:'0x6003'},unacceptedOwner:{pendingOwner:manager},wrongOwner:{managerOwner:manager},unpaused:{unpaused:true},wrongToken:{token:manager},unsupportedCanonical:{unsupported:true},reorg:{reorg:true},gasLimit:{gas:16777217n}}))test('plan fails closed '+name,()=>using(change,async f=>{await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}));assert(!f.calls.includes('getSigners'));}));
test('artifact/compiler mismatches rejected',()=>using({},async f=>{f.buildInfo.input.settings.optimizer.runs=200;assert.throws(()=>qualifiedArtifact(f.artifact,f.buildInfo));f.buildInfo.input.settings.optimizer.runs=40;f.artifact.bytecode='0x6009';assert.throws(()=>qualifiedArtifact(f.artifact,f.buildInfo));}));
for(const [name,change] of Object.entries({noExplorerKey:{noKey:true},wrongSigner:{signer:manager}}))test('deployment gate '+name,()=>using(change,async f=>{f.options.dryRun=false;await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}));assert(!f.calls.includes('sendTransaction'));assert(!fs.existsSync(f.options.journalPath));}));
test('mainnet confirmation missing prevents signer lookup',()=>using({},async f=>{f.options.dryRun=false;f.options.confirmation='';await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}));assert(!f.calls.includes('getSigners'));}));
test('ambiguous send retains incomplete journal and original input; retry refuses',()=>using({},async f=>{f.options.dryRun=false;await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}),/Preserve the journal/);const bytes=fs.readFileSync(f.options.journalPath);assert.equal(JSON.parse(bytes).status,'incomplete');assert(fs.existsSync(f.options.journalPath+'.solc-input.json'));await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}),/already exists/);assert.deepEqual(fs.readFileSync(f.options.journalPath),bytes);assert.equal(f.calls.filter(x=>x==='sendTransaction').length,1);}));
test('keyless recovery exact identity, separate receipt and no overwrite',()=>using({},async f=>{fs.writeFileSync(f.options.journalPath,JSON.stringify(f.journal));const original=fs.readFileSync(f.options.journalPath);f.options.recover=true;f.options.dryRun=false;const r=await execute({hre:f.hre,config:f.c,options:f.options});assert.equal(r.status,'verified_unconfigured');assert.equal(r.blockchainTransactionsBroadcast,0);assert(!f.calls.includes('getSigners'));assert.deepEqual(fs.readFileSync(f.options.journalPath),original);assert.equal(fs.statSync(f.options.reportPath).mode&0o777,0o600);await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}),/already exists/);}));
for(const [name,change] of Object.entries({runtime:{runtime:'0x6009'},constructor:{tx:{data:'0x6000'}},sender:{tx:{from:manager}},transactionChain:{tx:{chainId:2n}},transactionGas:{tx:{gasLimit:99999n}},transactionValue:{tx:{value:1n}},callNotCreation:{tx:{to:manager}},transactionHash:{tx:{hash}},nonce:{tx:{nonce:3}},failedReceipt:{receipt:{status:0}},receiptAddress:{receipt:{contractAddress:manager}},confirmations:{receipt:{blockNumber:100}},routerOwner:{routerOwner:manager},alreadyAttached:{attached:true},changedMetadata:{base:'ipfs://changed/'},explorerFalse:{verifyResult:false},noExplorerKey:{noKey:true}}))test('recovery rejects '+name,()=>using(change,async f=>{fs.writeFileSync(f.options.journalPath,JSON.stringify(f.journal));f.options.recover=true;f.options.dryRun=false;await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}));assert(!fs.existsSync(f.options.reportPath));assert(!f.calls.includes('getSigners'));}));
for(const field of ['schema','buildDigest','creationDataHash'])test('recovery rejects journal '+field,()=>using({},async f=>{f.journal[field]='wrong';fs.writeFileSync(f.options.journalPath,JSON.stringify(f.journal));f.options.recover=true;f.options.dryRun=false;await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}),/binding differs/);assert(!f.calls.includes('verify:verify'));}));

test('successful deployment records one transaction and remains unattached',()=>using({sendSuccess:true},async f=>{f.options.dryRun=false;const r=await execute({hre:f.hre,config:f.c,options:f.options});assert.equal(r.status,'verified_unconfigured');assert.equal(r.blockchainTransactionsBroadcast,1);assert.equal(r.jobManager,E.ZeroAddress);assert.equal(f.calls.filter(x=>x==='sendTransaction').length,1);assert.equal(JSON.parse(fs.readFileSync(f.options.journalPath)).transactionHash,txHash);}));
test('explorer failure after broadcast preserves transaction for keyless recovery',()=>using({sendSuccess:true,verifyResult:false},async f=>{f.options.dryRun=false;await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}));const j=JSON.parse(fs.readFileSync(f.options.journalPath));assert.equal(j.transactionHash,txHash);assert.equal(j.status,'incomplete');assert.equal(j.blockchainTransactionsBroadcast,1);assert.equal(j.verification.status,'pending');}));

test('unreviewed compiler-input binding cannot proceed',()=>using({},async f=>{f.c.buildDigest='b'.repeat(64);await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}),/explicitly reviewed buildDigest/);assert.equal(f.calls.length,0);}));

test('recovery clears stale failure text and refreshes manager state without editing history',()=>using({},async f=>{f.journal.error='Historical failure retained only in original';f.journal.managerState={owner:manager,pendingOwner:manager,intakePaused:false,ensJobPages:owner,useEnsJobTokenURI:true};fs.writeFileSync(f.options.journalPath,JSON.stringify(f.journal));const original=fs.readFileSync(f.options.journalPath);f.options.recover=true;f.options.dryRun=false;const r=await execute({hre:f.hre,config:f.c,options:f.options});assert.equal(r.status,'verified_unconfigured');assert.equal(r.priorJournalStatus,'incomplete');assert.equal(Object.hasOwn(r,'error'),false);assert.deepEqual(r.managerState,{owner,pendingOwner:E.ZeroAddress,intakePaused:true,ensJobPages:E.ZeroAddress,useEnsJobTokenURI:false});assert.deepEqual(fs.readFileSync(f.options.journalPath),original);}));

test('artifact FQN and compiler input source cannot select another same-named contract',()=>using({},async f=>{f.artifact.sourceName='contracts/Other.sol';assert.throws(()=>qualifiedArtifact(f.artifact,f.buildInfo),/source identity/);f.artifact.sourceName='contracts/periphery/AGIJobPages.sol';f.artifact.inputSourceName='contracts/Other.sol';assert.throws(()=>qualifiedArtifact(f.artifact,f.buildInfo),/source identity/);}));

test('legacy two-argument recovery uses explicit original artifacts and never calls missing manager getter',()=>using({legacy:true},async f=>{
 fs.writeFileSync(f.options.journalPath,JSON.stringify(f.journal));const original=fs.readFileSync(f.options.journalPath);f.options.recover=true;f.options.dryRun=false;
 const r=await execute({hre:f.hre,config:f.c,options:f.options,verifyLegacy:async args=>{assert.equal(args.constructorArguments.length,2);assert.deepEqual(args.artifact,f.artifact);return true;}});
 assert.equal(r.managerState.useEnsJobTokenURI,'not_observed_legacy_abi');assert.equal(r.governorActionPlan,null);assert.deepEqual(fs.readFileSync(f.options.journalPath),original);assert(!f.calls.includes('getSigners'));
}));
test('legacy schema cannot create or silently recover with current artifacts',()=>using({legacy:true},async f=>{
 await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}),/recovery-only/);
 f.options.recover=true;f.options.dryRun=false;delete f.options.legacyBuildInfoPath;
 await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}),/original artifact/);
}));
test('hashless interrupted creation recovers canonical sender and nonce without another deployment',()=>using({},async f=>{
 delete f.journal.transactionHash;fs.writeFileSync(f.options.journalPath,JSON.stringify(f.journal));const original=fs.readFileSync(f.options.journalPath);f.options.recover=true;f.options.dryRun=false;
 const r=await execute({hre:f.hre,config:f.c,options:f.options});assert.equal(r.transactionHash,txHash);assert.equal(r.blockchainTransactionsBroadcast,0);
 assert(!f.calls.includes('getSigners'));assert(!f.calls.includes('sendTransaction'));assert.deepEqual(fs.readFileSync(f.options.journalPath),original);
}));
test('unresolved interrupted creation remains blocked and never broadcasts',()=>using({noCreation:true},async f=>{
 delete f.journal.transactionHash;fs.writeFileSync(f.options.journalPath,JSON.stringify(f.journal));f.options.recover=true;f.options.dryRun=false;
 await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}),/do not retry/);assert(!f.calls.includes('sendTransaction'));assert(!fs.existsSync(f.options.reportPath));
}));
test('ambiguous send preserves locked creator and durable exact nonce intent',()=>using({},async f=>{
 f.options.dryRun=false;await assert.rejects(execute({hre:f.hre,config:f.c,options:f.options}));
 const saved=JSON.parse(fs.readFileSync(f.options.journalPath));assert.equal(saved.creationIntent.nonce,2);assert.equal(saved.creationIntent.creator,creator);assert.equal(saved.creationIntent.address,saved.address);
 assert.equal(saved.creationIntent.dataHash,saved.creationDataHash);assert(fs.existsSync(path.join(saved.creatorLock.path,'owner.json')));
 const {reserveCreator}=require('../scripts/creator-transaction.cjs');
 assert.throws(()=>reserveCreator({directory:f.options.lockDirectory,chainId:1,creator,journalPath:path.join(f.dir,'another.json')}),/already exists/);
}));
test('creation result includes data-only governor actions without manager attachment or intake calls',()=>using({sendSuccess:true},async f=>{
 f.options.dryRun=false;const r=await execute({hre:f.hre,config:f.c,options:f.options});
 assert.equal(r.owner,owner);assert.notEqual(owner,creator);assert.equal(r.governorActionPlan.from,owner);assert.equal(r.governorActionPlan.actions.length,1);
 assert.equal(r.governorActionPlan.status,'requires_separate_governor_authorization');assert.equal(r.governorActionPlan.managerAttachmentAuthorized,false);
 assert.equal(r.governorActionPlan.intakeActivationAuthorized,false);assert.equal(fs.existsSync(r.creatorLock.path),false);
}));
