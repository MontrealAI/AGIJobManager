// Disposable preparation acceptance. Actual native code; no device or public RPC.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { Wallet, Transaction, keccak256 } from 'ethers';
import manager, { MANAGER_CURRENT, MANAGER_CORRECTED } from '../coordinators/manager.mjs';
import alpha, { ALPHA_CURRENT } from '../coordinators/alpha.mjs';
import { execute, observeSource, privateWrite, readJson, sha256, canonical } from '../coordinators/common.mjs';
import { policyDigest } from '../src/envelope.mjs';
import { nativeSelectionQualification, deriveSelectedCampaign } from '../trust/prepare-campaign.mjs';
import { assertCampaignUnstartedForReplacement } from '../trust/local-build.mjs';

const id=process.env.SELECTION_ACCEPT_ADAPTER,root=process.env.SELECTION_ACCEPT_CHECKOUT,output=process.env.SELECTION_ACCEPT_REPORT;
assert.ok(['manager','alpha'].includes(id)&&path.isAbsolute(root)&&path.isAbsolute(output));
const managerProfile=process.env.SELECTION_ACCEPT_MANAGER_PROFILE||'current';assert.ok(['current','corrected'].includes(managerProfile));
const supported=id==='manager'?(managerProfile==='corrected'?MANAGER_CORRECTED:MANAGER_CURRENT):ALPHA_CURRENT,base=id==='manager'?manager:alpha,source=observeSource({checkout:root},supported),load=createRequire(path.join(root,id==='manager'?'package.json':'tests/contracts/package.json'));
const native=load(path.join(root,id==='manager'?'hardhat/scripts/core-creation-plan.cjs':'tests/contracts/scripts/mainnet-authority.js'));
const {ethers}=id==='manager'?await load(path.join(root,'hardhat/scripts/runtime.cjs')).getRuntime():load('hardhat');
const provider=ethers.provider,temp=fs.mkdtempSync(path.join(os.tmpdir(),'companion-selection-'+id+'-'));fs.chmodSync(temp,0o700);
const governor='0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99',creator=Wallet.createRandom().address,selected=Wallet.createRandom().address;
const report={schema:'manual-ledger-native-creator-selection-acceptance-v1',adapter:id,source,node:process.versions.node,platform:process.platform,scope:'Disposable unforked Osaka; mock dependencies; finalized=latest and EIP1898 fixture adaptation; actual fixed native planner/read-only HTTPS subprocess. Not Mac production, device, provider or consensus acceptance.',checks:[],publicProvider:false,physicalQualified:false,broadcasts:0,activationAuthorized:false};
const codeHashes=()=>Object.fromEntries(['../trust/prepare-campaign.mjs','../test/trusted-mac-selection.test.mjs','./accept-prepare-campaign.mjs'].map(name=>[name,sha256(fs.readFileSync(new URL(name,import.meta.url)))]));report.acceptanceCodeSha256=codeHashes();
let server,pendingConflict=false,reads=0,stage='fixture';
const write=(filename,value)=>fs.writeFileSync(filename,JSON.stringify(value),{flag:'wx',mode:0o600});
try{
  assert.equal((await provider.getNetwork()).chainId,1n);
  await provider.send('hardhat_setBalance',[selected,ethers.toQuantity(ethers.parseEther('20'))]);await provider.send('hardhat_setNonce',[selected,'0x7']);
  await provider.send('hardhat_setBalance',[governor,ethers.toQuantity(ethers.parseEther('20'))]);await provider.send('hardhat_setNonce',[governor,'0x4']);
  const cert=path.join(temp,'ca.pem'),key=path.join(temp,'key.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-sha256','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=Disposable creator preparation','-addext','subjectAltName=IP:127.0.0.1','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'ignore'});
  let plan,catalogFields={};
  if(id==='manager'){
    const F=load(path.join(root,'hardhat/test/helpers/core-session-fixture.cjs')),C=load(path.join(root,'hardhat/scripts/qualified-build-catalog.cjs')),solc=load('solc');
    const fixture=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'F.sol':{content:'pragma solidity ^0.8.20;contract F{function decimals()external pure returns(uint8){return 6;}function paused()external pure returns(bool){return false;}function isBlacklisted(address)external pure returns(bool){return false;}}'}},settings:{outputSelection:{'*':{'*':['evm.deployedBytecode.object']}}}})));
    const code='0x'+fixture.contracts['F.sol'].F.evm.deployedBytecode.object,registry='0x2222222222222222222222222222222222222222';
    await provider.send('hardhat_setCode',[F.config(creator).constructorArgs.usdcTokenAddress,code]);await provider.send('hardhat_setCode',[registry,code]);await provider.send('hardhat_mine',['0x1']);
    F.actualCatalog(temp);const catalogPath=path.join(temp,'catalog.json'),catalog=readJson(catalogPath),entry=Object.values(catalog.builds)[0],buildId='creator-selection-real-current-source';
    entry.source=native.observedRevision();catalog.builds={[buildId]:entry};fs.writeFileSync(catalogPath,JSON.stringify(catalog));
    const catalogSha256=sha256(fs.readFileSync(catalogPath)),qualified=C.loadQualifiedBuild({catalogPath,catalogSha256,buildId,expectedRevision:entry.source}),block=await provider.send('eth_getBlockByNumber',['latest',false]);
    const config=F.config(creator,{block:{number:Number(BigInt(block.number)),hash:block.hash},registry});
    if(managerProfile==='corrected')config.constructorArgs.rootNodes=['club.agi.eth','agent.agi.eth','alpha.club.agi.eth','alpha.agent.agi.eth'].map(ethers.namehash);
    plan=native.makePlan(config,qualified,entry.source);catalogFields={catalogPath,catalogSha256,buildId};
  }else{
    const legacy=load(path.join(root,'tests/contracts/scripts/mainnet.js'));await load(path.join(root,'tests/contracts/test/utils/token.js')).installToken();
    for(const[name,address]of[['MockAscensionENS',legacy.ENS],['MockAscensionWrapper',legacy.WRAPPER]]){const deployed=await(await ethers.getContractFactory(name)).deploy();await provider.send('hardhat_setCode',[address,await provider.getCode(deployed.target)]);}
    const ens=await ethers.getContractAt('MockAscensionENS',legacy.ENS);for(const name of legacy.roots)await(await ens.setOwner(ethers.namehash(name),governor)).wait();
    const block=await provider.send('eth_getBlockByNumber',['latest',false]),config={schema:'agialpha.mainnet.config.v2',chainId:1,deployer:creator,nonce:0,block:{number:Number(BigInt(block.number)),hash:block.hash},governor:{kind:'ledger-eoa',address:governor,addressAcknowledgement:governor},dependencies:{},rootOwners:Object.fromEntries(legacy.roots.map(name=>[name,governor])),parameters:{minimumValidatorStake:'10000000000000000000',minimumAgentStake:'10000000000000000000',quorum:2,maximumRiskBps:2000},sender:{mode:'empty-eoa-direct-create.v1'},envelope:{gasLimit:'8000000',maxFeePerGas:'10000000000',maxPriorityFeePerGas:'1000000000',accessList:[]}};
    for(const[name,address]of Object.entries({token:load(path.join(root,'token.config')).AGIALPHA_ADDRESS,ens:legacy.ENS,wrapper:legacy.WRAPPER}))config.dependencies[name]={address,codeHash:keccak256(await provider.getCode(address))};
    const journal={schema:'ethereum.cross-project-nonce-journal.v1',journalId:'DISPOSABLE-SELECTION-ONLY',revision:1,chainId:1,sender:creator,scope:['alpha','jobs','manager'],block:config.block,latestNonce:0,pendingNonce:0,allocations:[{project:'alpha',startNonce:0,count:5}]},revision=load(path.join(root,'tests/contracts/scripts/authority-revision.js')).reviewedRevision();
    plan=await native.makePlan(config,native.compiledContracts(),revision,journal);
  }
  const planPath=privateWrite(temp,plan),originalPlanHash=sha256(fs.readFileSync(planPath)),lockDirectory=path.join(temp,'locks');fs.mkdirSync(lockDirectory,{mode:0o700});
  const allowed=new Set(['eth_chainId','eth_getCode','eth_getTransactionCount','eth_getBlockByNumber','eth_call','eth_estimateGas','eth_getBalance','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getLogs']);
  server=https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert),minVersion:'TLSv1.2'},(request,response)=>{
    const chunks=[];let size=0;request.on('data',bytes=>{size+=bytes.length;if(size>262144)request.destroy();else chunks.push(bytes);});
    request.on('end',async()=>{try{
      const body=JSON.parse(Buffer.concat(chunks));assert.equal(request.method,'POST');assert.equal(request.url,'/read');assert.ok(allowed.has(body.method));reads++;
      let params=body.params;if(body.method==='eth_getBlockByNumber'&&params[0]==='finalized')params=['latest',params[1]];
      const at=params.at(-1);if(at?.requireCanonical){const block=await provider.send('eth_getBlockByHash',[at.blockHash,false]);assert.equal((await provider.send('eth_getBlockByNumber',[block.number,false])).hash,at.blockHash);params=[...params.slice(0,-1),block.number];}
      let result=await provider.send(body.method,params);if(pendingConflict&&body.method==='eth_getTransactionCount'&&params[0].toLowerCase()===selected.toLowerCase()&&params[1]==='pending')result='0x8';
      response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({jsonrpc:'2.0',id:body.id,result}));
    }catch{response.writeHead(400);response.end('{"error":"DISPOSABLE_READ_ONLY_FIXTURE"}');}});
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const config={checkout:root,nodePath:fs.realpathSync(process.execPath),nodeVersion:process.versions.node,nodeSha256:sha256(fs.readFileSync(fs.realpathSync(process.execPath))),planPath,sessionPath:path.join(temp,'unstarted-native-session'),lockDirectory,readRpcUrl:'https://127.0.0.1:'+server.address().port+'/read',extraCaCertificates:cert,...catalogFields};
  const expiresAt=new Date(Date.now()+3600000).toISOString(),sourceSha256='0x'+sha256(JSON.stringify(canonical(source))),creations=id==='manager'?plan.operations:plan.transactions;
  const envelopes=[...creations.map(operation=>operation.envelope),...(id==='alpha'?plan.governanceCalls.map((call,index)=>({type:2,chainId:1,from:governor,nonce:4+index,to:call.to,value:'0',data:call.data,gasLimit:'1000000',maxFeePerGas:'10000000000',maxPriorityFeePerGas:'1000000000',accessList:[]})):[])];
  const manifest=envelopes.map((envelope,index)=>{const{from,...fields}=envelope,unsignedHex=Transaction.from(fields).unsignedSerialized,expectedUnsignedHash=keccak256(unsignedHex),review={chainId:'1',expectedSender:from,expiresAt,maxGasLimit:envelope.gasLimit,maxFeePerGas:envelope.maxFeePerGas,maxPriorityFeePerGas:envelope.maxPriorityFeePerGas,maxTotalFeeWei:(BigInt(envelope.gasLimit)*BigInt(envelope.maxFeePerGas)).toString(),maxValueWei:'0',operationId:'original-'+index,sourceSha256};return{operationId:review.operationId,unsignedHex,expectedUnsignedHash,expectedPolicyHash:policyDigest(review,expectedUnsignedHash),review};});
  const campaign={format:'manual-ledger-campaign-v1',campaignId:'DISPOSABLE-ORIGINAL',adapter:id,packetSchema:supported.packetSchema,expiresAt,reviewedManifest:{source,sourceSha256,planSha256:plan.payloadSha256,operations:manifest},coordinator:{...config,...(id==='alpha'?{mode:'raw-relay'}:{})},network:{chainId:'1'},actors:{creator,governor,feeRecipients:[],treasuries:[]},route:{symbol:id==='manager'?'USDC':'AGIALPHA',decimals:id==='manager'?6:18,token:id==='manager'?plan.config.constructorArgs.usdcTokenAddress:plan.config.dependencies.token.address},operations:manifest.map((_,index)=>({index,account:index<creations.length?'creator':'governor',destination:envelopes[index].to||'CREATE',dependsOn:index?[index-1]:[]})),maxTotalFeeWei:envelopes.reduce((sum,envelope)=>sum+BigInt(envelope.gasLimit)*BigInt(envelope.maxFeePerGas),0n).toString()};
  const adapter=base.forCampaign(campaign);adapter.inspectCampaign(campaign);
  async function run(label,inputPlanPath=planPath){const dir=path.join(temp,label);fs.mkdirSync(dir,{mode:0o700});const request={adapter:id,checkout:root,creator:selected,planPath:inputPlanPath,lockDirectory,...catalogFields,outputPlan:path.join(dir,'selected-plan.json'),outputReport:path.join(dir,'native-read-only-preflight.json'),requestPath:path.join(dir,'request.json')};write(request.requestPath,request);return{dir,request,result:JSON.parse(await execute(config,supported,'-e',[nativeSelectionQualification.command,request.requestPath],id==='manager'?{MANAGER_READ_RPC_URL:config.readRpcUrl}:{ALPHA_READ_ONLY_RPC_URL:config.readRpcUrl}))};}
  stage='actual-native-selection';const selectedRun=await run('successful-selection'),newPlan=readJson(selectedRun.request.outputPlan);
  assert.equal(selectedRun.result.creatorNonce,7);assert.equal(selectedRun.result.governorNonce,4);assert.equal(selectedRun.result.externalTransactions,false);assert.notEqual(newPlan.payloadSha256,plan.payloadSha256);assert.equal(sha256(fs.readFileSync(planPath)),originalPlanHash);assert.deepEqual(fs.readdirSync(lockDirectory),[]);
  if(id==='manager'&&managerProfile==='corrected'){assert.equal(new Set(plan.config.constructorArgs.rootNodes).size,4);assert.ok(plan.config.constructorArgs.rootNodes.every(root=>root!=='0x'+'00'.repeat(32)));assert.deepEqual(newPlan.config.constructorArgs.rootNodes,plan.config.constructorArgs.rootNodes);report.distinctRootArguments=plan.config.constructorArgs.rootNodes;report.rootArgumentOrder=['clubRootNode','agentRootNode','alphaClubRootNode','alphaAgentRootNode'];report.checks.push('New d371 preparation separately preserved all four distinct nonzero ENS role-root arguments in actual constructor order; deployed getter qualification is separate');}
  const selectedCampaign=deriveSelectedCampaign({template:{...campaign,__reviewedPlanConfig:plan.config},plan:newPlan,creator:selected,governorNonce:4,outputDirectory:selectedRun.dir});adapter.inspectCampaign(selectedCampaign);
  const newCreations=id==='manager'?newPlan.operations:newPlan.transactions;
  for(let i=0;i<creations.length;i++){assert.equal(Transaction.from(selectedCampaign.reviewedManifest.operations[i].unsignedHex).nonce,7+i);assert.notEqual(newCreations[i].predictedAddress||newCreations[i].expectedAddress,creations[i].predictedAddress||creations[i].expectedAddress);}
  report.checks.push('Actual fixed native planner plus read-only HTTPS preflight regenerated creator nonce7, all CREATE addresses and byte/policy bindings; preserved governor/economics/ENS and original plan; released only its own temporary actor locks');
  stage='pending-nonce-negative';pendingConflict=true;await assert.rejects(run('pending-nonce-conflict'));pendingConflict=false;assert.deepEqual(fs.readdirSync(lockDirectory),[]);report.checks.push('Native latest/pending nonce ambiguity stops without signing or submission');
  if(id==='alpha'){stage='cross-project-journal-negative';const journal=structuredClone(plan.journal);journal.allocations.push({project:'manager',startNonce:5,count:9});const revision=load(path.join(root,'tests/contracts/scripts/authority-revision.js')).reviewedRevision(),jointPlan=await native.makePlan(plan.config,native.compiledContracts(),revision,journal),jointPath=privateWrite(temp,jointPlan),before=reads;await assert.rejects(run('cross-project-handoff-required',jointPath));assert.equal(reads,before);assert.deepEqual(fs.readdirSync(lockDirectory),[]);report.checks.push('A valid joint cross-project nonce journal requires explicit new owner handoff; no allocations are invented or shifted for another repository');}
  stage='started-intent-negative';write(config.sessionPath,{schema:'SYNTHETIC-EXISTING-NATIVE-INTENT'});const before=reads;assert.throws(()=>assertCampaignUnstartedForReplacement({privateDirectory:path.join(temp,'prior-bridge'),nativeSessionPath:config.sessionPath}));assert.equal(reads,before);report.checks.push('Existing native intent refuses replacement before any provider read');
  assert.deepEqual(codeHashes(),report.acceptanceCodeSha256);report.result='PASS';report.readOnlyRpcCalls=reads;report.selectedCreatorNonce=7;report.governorNonce=4;report.operationCount=selectedCampaign.operations.length;
}catch(error){report.result='FAIL';report.stage=stage;report.errorCode=/^[A-Z0-9_]{1,96}$/.test(error.code||'')?error.code:'ACCEPTANCE_ASSERTION_OR_NATIVE_STOP';process.exitCode=1;}
finally{if(server)await new Promise(resolve=>server.close(resolve));write(output,report);fs.rmSync(temp,{recursive:true,force:true});}
process.stdout.write(JSON.stringify({adapter:id,result:report.result,stage:report.stage,checks:report.checks.length,report:output})+'\n');
