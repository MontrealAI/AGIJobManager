'use strict';
// Offline core-only graph. No optional metadata, governor CALL or activation operation is modeled.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),E=require('ethers');
const T=require('./transaction-envelope.cjs'),A=require('./actor-policy.cjs');
const {LIBRARIES,FQNS,resolveConstructor,COMPILER_SETTINGS}=require('./deploy.cjs');
const {buildDigest}=require('./governance-deployment.cjs');
const GOVERNOR='0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99';
const NAMES=[...LIBRARIES,'AGIJobManager'];
function observedRevision(root=path.resolve(__dirname,'../..')){
 root=fs.realpathSync(root);
 // Repository selection, alternate indexes/objects and config injection must not
 // be inherited from an operator shell. Observation is local and read-only.
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('GIT_')));
 Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'});
 const git=(...args)=>cp.execFileSync('git',['--no-replace-objects','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null',...args],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,env});
 T.need(fs.realpathSync(git('rev-parse','--show-toplevel').trim())===root,'Observed Git toplevel differs from the requested source root.');
 const commit=git('rev-parse','HEAD').trim(),tree=git('rev-parse','HEAD^{tree}').trim();
 T.need(/^[0-9a-f]{40}$/.test(commit)&&/^[0-9a-f]{40}$/.test(tree),'Exact SHA1 source revision required.');
 // Rehash exact tracked bytes against HEAD, independently of status/index caches,
 // filters and line-ending rules. Git submodules require a separate closure model.
 const entries=git('ls-tree','-r','-z','--full-tree',commit).split('\0').filter(Boolean);
 T.need(entries.length>0,'Reviewed source tree is empty.');
 const tracked=entries.map(entry=>{const match=/^([0-7]{6}) blob ([a-f0-9]{40})\t([\s\S]+)$/.exec(entry);T.need(match&&['100644','100755','120000'].includes(match[1]),'Unsupported tracked source entry or submodule.');return match.slice(1);});
 function checkIndex(){
  const flags=git('ls-files','-v','-z').split('\0').filter(Boolean);T.need(flags.every(entry=>entry[0]!=='S'&&!/[a-z]/.test(entry[0])),'Source index contains assume-unchanged or skip-worktree flags.');
  const index=git('ls-files','--stage','-z').split('\0').filter(Boolean).map(entry=>{const match=/^([0-7]{6}) ([a-f0-9]{40}) 0\t([\s\S]+)$/.exec(entry);T.need(match,'Source index is unmerged or malformed.');return match.slice(1);});
  const expected=new Map(tracked.map(([mode,hash,name])=>[name,`${mode}:${hash}`]));
  T.need(index.length===expected.size&&index.every(([mode,hash,name])=>expected.get(name)===`${mode}:${hash}`),'Source index differs from reviewed HEAD.');
  T.need(git('ls-files','--others','--exclude-standard','-z')==='','Source checkout contains untracked files.');
 }
 checkIndex();
 // Do not invoke `git status`/diff: local clean/process filter configuration can
 // execute arbitrary external commands. These plumbing reads invoke no filters.
 function checkBytes(){for(const entry of entries){
  const match=/^([0-7]{6}) blob ([a-f0-9]{40})\t([\s\S]+)$/.exec(entry);T.need(match&&['100644','100755','120000'].includes(match[1]),'Unsupported tracked source entry or submodule.');
  const [,mode,expected,relative]=match,file=path.resolve(root,relative);T.need(file.startsWith(root+path.sep),'Tracked source path escapes root.');
  const stat=fs.lstatSync(file);let bytes;
  if(mode==='120000'){T.need(stat.isSymbolicLink(),'Tracked symlink changed type.');bytes=Buffer.from(fs.readlinkSync(file));}
  else{T.need(stat.isFile()&&!stat.isSymbolicLink()&&Boolean(stat.mode&0o100)===(mode==='100755'),'Tracked source type or executable mode changed.');bytes=fs.readFileSync(file);}
  const actual=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');T.need(actual===expected,`Tracked source bytes differ from reviewed HEAD: ${relative}`);
 }}
 checkBytes();
 const checksum=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const source={commit,tree,rootLockSha256:checksum(path.join(root,'package-lock.json')),hardhatLockSha256:checksum(path.join(root,'hardhat/package-lock.json'))};
 T.need(git('rev-parse','HEAD').trim()===commit&&git('rev-parse','HEAD^{tree}').trim()===tree,'Source changed during revision observation.');checkIndex();checkBytes();
 return source;
}
function revision(x){T.exact(x,['commit','tree','rootLockSha256','hardhatLockSha256']);T.need(/^[0-9a-f]{40}$/.test(x.commit)&&/^[0-9a-f]{40}$/.test(x.tree),'Exact source revision required.');T.sha(x.rootLockSha256);T.sha(x.hardhatLockSha256);return x;}
function validateConfig(c){
 T.exact(c,['schema','chainId','creator','governor','governorAcknowledgement','nonce','block','expiresAfterBlock','constructorArgs','creatorPolicy','qualificationEvidence','envelopes','maximumTotalFeeWei']);
 T.need(c.schema==='manager-core-creation-config-v1'&&c.chainId===1,'Explicit mainnet core configuration required.');
 T.need(c.creator===T.address(c.creator)&&c.governor===GOVERNOR&&c.governorAcknowledgement===GOVERNOR,'Acknowledge the explicit requested governor; select creator independently.');
 T.integer(c.nonce);T.need(c.nonce<Number.MAX_SAFE_INTEGER-9,'Nonce overflow.');T.exact(c.block,['number','hash']);T.integer(c.block.number,1);T.hash(c.block.hash);
 T.integer(c.expiresAfterBlock,c.block.number);T.need(c.expiresAfterBlock-c.block.number<=2048,'Plan validity exceeds bounded reconciliation interval.');
 T.exact(c.constructorArgs,['usdcTokenAddress','baseIpfsUrl','ensConfig','rootNodes','merkleRoots','settlementWallets','initialGovernor']);
 resolveConstructor('mainnet',c.constructorArgs);T.need(c.constructorArgs.initialGovernor===c.governor,'Constructor governor differs.');
 require('../../scripts/lib/usdc').requireCanonicalUSDC(1,c.constructorArgs.usdcTokenAddress);
 A.validatePolicy(c.creatorPolicy,c.creator);if(c.creatorPolicy.mode===A.EMPTY)A.validateEvidence(c.creatorPolicy,c.creator,c.qualificationEvidence);
 T.need(Array.isArray(c.envelopes)&&c.envelopes.length===9,'Nine explicit gas/fee envelopes required.');let total=0n;
 for(const e of c.envelopes){T.exact(e,['gasLimit','maxFeePerGas','maxPriorityFeePerGas']);T.need(T.quantity(e.gasLimit)>=53000n&&T.quantity(e.gasLimit)<=T.MAX_GAS&&T.quantity(e.maxFeePerGas)>0n&&T.quantity(e.maxPriorityFeePerGas)<=T.quantity(e.maxFeePerGas),'Invalid gas or fee envelope.');total+=BigInt(e.gasLimit)*BigInt(e.maxFeePerGas);}
 T.need(total<=T.quantity(c.maximumTotalFeeWei),'Total maximum fee exceeds reviewed budget.');return c;
}
function linkedCreation(artifact,libraries){
 let data=artifact.bytecode;for(const [source,entries] of Object.entries(artifact.linkReferences||{}))for(const [name,ranges] of Object.entries(entries)){
  const key=`${source.replace(/^project\//,'')}:${name}`,value=libraries[key];T.need(value&&E.isAddress(value),'Missing exact linked-library address.');
  for(const {start,length} of ranges){T.need(Number.isSafeInteger(start)&&start>=0&&length===20&&2+(start+length)*2<=data.length,'Invalid library range.');data=data.slice(0,2+start*2)+value.slice(2).toLowerCase()+data.slice(2+(start+length)*2);}
 }
 T.bytes(data);return data;
}
function makePlan(config,qualified,source){
 validateConfig(config);revision(source);qualified.assertUnchanged();
 T.need(qualified.source.commit===source.commit&&qualified.source.tree===source.tree,'Pinned build does not match independently observed revision.');
 T.need(qualified.buildDigest===buildDigest(qualified.buildInfo),'Qualified compiler input digest differs.');
 A.validateEvidence(config.creatorPolicy,config.creator,config.qualificationEvidence,{source,buildId:qualified.id,buildDigest:qualified.buildDigest,catalogSha256:qualified.catalogSha256,block:config.block,executionHardfork:'osaka'});
 const settings=qualified.buildInfo.input.settings;T.need(T.canonical({version:qualified.buildInfo.solcVersion,optimizer:settings.optimizer,evmVersion:settings.evmVersion,viaIR:settings.viaIR,metadata:settings.metadata,debug:settings.debug})===T.canonical(COMPILER_SETTINGS),'Core creation requires the exact reviewed compiler profile.');
 const addresses=Object.fromEntries(NAMES.map((name,i)=>[name,E.getCreateAddress({from:config.creator,nonce:config.nonce+i})]));
 const libraries=Object.fromEntries(LIBRARIES.map(n=>[FQNS[n],addresses[n]]));
 const c=config.constructorArgs,args=[c.usdcTokenAddress,c.baseIpfsUrl,c.ensConfig,c.rootNodes,c.merkleRoots,c.settlementWallets,c.initialGovernor];
 const operations=NAMES.map((name,i)=>{
  const r=qualified.records[name];T.need(r?.fqn===FQNS[name],'Catalog misses an exact core artifact.');
  const artifact=r.artifact,constructorArguments=name==='AGIJobManager'?args:[];
  const inputs=artifact.abi.find(x=>x.type==='constructor')?.inputs||[];
  T.need(name==='AGIJobManager'?inputs.length===7&&inputs.at(-1).type==='address':inputs.length===0,'Core creation constructor schema differs.');
  const data=E.concat([linkedCreation(artifact,libraries),new E.Interface(artifact.abi).encodeDeploy(constructorArguments)]).toLowerCase();
  const envelope={type:2,chainId:1,from:config.creator,nonce:config.nonce+i,to:null,value:'0',data,...config.envelopes[i],accessList:[]};T.validateEnvelope(envelope);
  T.need((artifact.deployedBytecode.length-2)/2<=24576,'Runtime exceeds EIP-170.');
  return {id:i,name,qualifiedName:r.fqn,predictedAddress:addresses[name],constructorArguments,libraries,envelope};
 });
 const payload={schema:'manager-core-creation-plan-v1',source,buildId:qualified.id,buildDigest:qualified.buildDigest,catalogSha256:qualified.catalogSha256,config,creator:config.creator,startNonce:config.nonce,chainId:1,governor:config.governor,libraries,operations,readyToBroadcast:false,scope:'Nine core CREATEs only. Governor configuration, optional metadata/ENS and activation require separate plans.'};
 return {...payload,payloadSha256:T.digest(payload)};
}
function checkPlan(plan,qualified,source){T.need(source!==undefined,'Independently observed source revision required.');T.need(T.canonical(plan)===T.canonical(makePlan(plan.config,qualified,source)),'Plan/source/envelope substitution detected.');return plan;}
module.exports={GOVERNOR,NAMES,observedRevision,validateConfig,linkedCreation,makePlan,checkPlan};
