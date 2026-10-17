'use strict';
// Read-only direct-authority closeout. This never signs, configures, attaches or activates.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),E=require('ethers');
const {getRuntime}=require('./runtime.cjs');
const {FQNS,qualifiedBuild}=require('./deploy.cjs');
const {buildDigest,requireDeploymentSchema,readCreationAuthority}=require('./governance-deployment.cjs');
const {createCanonicalReader}=require('./canonical-state.cjs');
const {requireArtifactMatch}=require('./deployment-safety.cjs');
const {durableWrite}=require('./creator-transaction.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const normalizeAddress=x=>{if(!E.isAddress(x))throw Error('Invalid reviewed authority address.');return E.getAddress(x);};
function normalizeReview(review,receipt){
  const fields=['schema','manager','governor','creator','buildDigest','roleSubjects','metadata'];
  if(!review||Object.keys(review).sort().join()!==fields.sort().join()||review.schema!=='manager-direct-authority-review-v1')throw Error('Explicit direct-authority review schema required.');
  for(const key of ['manager','governor','creator'])review[key]=normalizeAddress(review[key]);
  if(review.manager.toLowerCase()!==receipt.contracts?.AGIJobManager?.address?.toLowerCase()||review.governor.toLowerCase()!==receipt.finalOwner?.toLowerCase()||review.creator.toLowerCase()!==receipt.deployer?.toLowerCase()||review.buildDigest!==receipt.buildDigest)throw Error('Authority review differs from the original deployment identity.');
  if(!Array.isArray(review.roleSubjects)||!review.roleSubjects.length)throw Error('Explicit reviewed role inventory required.');
  const seen=new Set();
  for(const subject of review.roleSubjects){
    if(Object.keys(subject).sort().join()!==['address','moderator','agentException','validatorException'].sort().join())throw Error('Invalid role inventory fields.');
    subject.address=normalizeAddress(subject.address);
    if(seen.has(subject.address))throw Error('Duplicate role inventory subject.');seen.add(subject.address);
    for(const key of ['moderator','agentException','validatorException'])if(typeof subject[key]!=='boolean')throw Error('Every reviewed role expectation must be boolean.');
    if(subject.address===review.creator&&[subject.moderator,subject.agentException,subject.validatorException].some(Boolean))throw Error('This creation closeout requires no creator exemptions. Separately authorize and review later governance grants.');
  }
  if(!seen.has(review.creator)||!seen.has(review.governor))throw Error('Role inventory must explicitly include creator and governor.');
  const m=review.metadata;
  if(!m||!['none','ens','router'].includes(m.kind)||typeof m.useEnsJobTokenURI!=='boolean')throw Error('Explicit metadata authority configuration required.');
  m.address=normalizeAddress(m.address);
  if(m.kind==='none'&&(m.address!==E.ZeroAddress||m.useEnsJobTokenURI!==false))throw Error('Disabled metadata must have zero pointer and mode false.');
  if(m.kind!=='none'&&(m.address===E.ZeroAddress||!/^0x[0-9a-fA-F]{64}$/.test(m.runtimeCodeHash||'')||!m.expected||typeof m.expected!=='object'))throw Error('Metadata requires exact runtime and reviewed getter values.');
  return review;
}
async function inspectDirectAuthority({reader,manager,review,artifacts,buildInfo,receipt}){
  const creation=await readCreationAuthority(manager,{governor:review.governor,creator:review.creator,requireUnconfigured:false});
  const roles=[];
  for(const expected of review.roleSubjects){
    const [moderator,agentException,validatorException]=await Promise.all([manager.moderators(expected.address),manager.additionalAgents(expected.address),manager.additionalValidators(expected.address)]);
    const actual={address:expected.address,moderator,agentException,validatorException};
    if(['moderator','agentException','validatorException'].some(k=>actual[k]!==expected[k]))throw Error('Direct role flags differ from the reviewed inventory.');roles.push(actual);
  }
  const [wallet30,wallet10]=await Promise.all([manager.wallet30(),manager.wallet10()]);
  if([wallet30,wallet10].some((x,i)=>x.toLowerCase()!==receipt.constructorArgs.settlementWallets[i].toLowerCase()))throw Error('Fee recipients changed; governance closeout never implies fee rotation.');
  const metadata=review.metadata;
  if(creation.ensJobPages.toLowerCase()!==metadata.address.toLowerCase()||creation.useEnsJobTokenURI!==metadata.useEnsJobTokenURI)throw Error('Manager metadata pointer or mode differs from reviewed setup.');
  let component=null;
  if(metadata.kind!=='none'){
    const fqn=metadata.kind==='ens'?'contracts/ens/ENSJobPages.sol:ENSJobPages':'contracts/periphery/AGIJobPages.sol:AGIJobPages';
    const artifact=await artifacts.readArtifact(fqn),code=await reader.getCode(metadata.address);
    requireArtifactMatch({artifact,buildInfo,address:metadata.address,code});
    if(E.keccak256(code)!==metadata.runtimeCodeHash.toLowerCase())throw Error('Metadata runtime differs from reviewed identity.');
    const target=reader.contract(metadata.address,artifact.abi),owner=await target.owner(),jobManager=await target.jobManager();
    if(owner.toLowerCase()!==review.governor.toLowerCase()||jobManager.toLowerCase()!==review.manager.toLowerCase())throw Error('Metadata governor or manager binding differs.');
    const required=metadata.kind==='ens'?['ens','nameWrapper','publicResolver','jobsRootNode','jobsRootName','jobLabelPrefix','useEnsJobTokenURI','configLocked']:['baseMetadataURI','externalUrlBase','defaultImageURI','useJobIdJsonSuffix'];
    if(Object.keys(metadata.expected).sort().join()!==required.sort().join())throw Error('Complete metadata getter expectations required.');
    const values={};for(const key of required){values[key]=await target[key]();if(values[key]!==metadata.expected[key])throw Error(`Metadata ${key} differs from reviewed setup.`);}
    component={address:metadata.address,owner,jobManager,runtimeCodeHash:E.keccak256(code),...values};
  }
  return {creation,roles,settlementWallets:[wallet30,wallet10],metadata:component,
    roleCoverage:'Only enumerated direct role subjects; mappings are not enumerable. Complete governor setup/transaction provenance remains a separate required review.',
    activationAuthorized:false,finalized:false,blockers:[
      'Complete reviewed governor setup calldata/receipts and exhaustive role-inventory provenance are required.',
      'ENS registry, NameWrapper token/operator approvals, resolver delegates, parent/root custody, fuses/expiry, and Genesis/Prime/Burn controllers must be separately reconciled at this block.',
      'Hardware signing, creator-mode qualification, numeric policy, independent-review disposition and explicit activation authorization remain separate gates.',
    ]};
}
async function main(){
  if(!process.env.DEPLOYMENT_RECEIPT||!process.env.AUTHORITY_REVIEW||!process.env.AUTHORITY_REPORT)throw Error('Set DEPLOYMENT_RECEIPT, AUTHORITY_REVIEW and a new AUTHORITY_REPORT path. Read-only; never activates.');
  const receiptText=fs.readFileSync(process.env.DEPLOYMENT_RECEIPT,'utf8'),receipt=JSON.parse(receiptText);
  if(!requireDeploymentSchema(receipt))throw Error('Historical deployments must use their original authority/ABI inspector; this closeout handles explicit-governor candidates only.');
  const reviewText=fs.readFileSync(process.env.AUTHORITY_REVIEW,'utf8'),review=normalizeReview(JSON.parse(reviewText),receipt);
  const hre=await getRuntime(),{buildInfo}=await qualifiedBuild();
  if(buildDigest(buildInfo)!==review.buildDigest)throw Error('Compiler input differs from reviewed deployment source.');
  if(Number((await hre.ethers.provider.getNetwork()).chainId)!==receipt.chainId)throw Error('Wrong authority readback chain.');
  const block=await hre.ethers.provider.getBlock('latest'),reader=createCanonicalReader(hre.ethers.provider,block),artifact=await hre.artifacts.readArtifact(FQNS.AGIJobManager),code=await reader.getCode(review.manager);
  requireArtifactMatch({artifact,buildInfo,address:review.manager,libraries:receipt.libraries,tokenAddress:receipt.constructorArgs.usdcTokenAddress,code});
  if(E.keccak256(code)!==receipt.contracts.AGIJobManager.runtimeCodeHash.toLowerCase())throw Error('Manager runtime differs from original deployment.');
  const result=await inspectDirectAuthority({reader,manager:reader.contract(review.manager,artifact.abi),review,artifacts:hre.artifacts,buildInfo,receipt});
  if((await hre.ethers.provider.getBlock(block.number))?.hash!==block.hash)throw Error('Authority block changed; no report established.');
  const report={schema:'manager-direct-authority-report-v1',status:'DIRECT_CHECKS_PASSED_CLOSEOUT_BLOCKED',chainId:receipt.chainId,blockNumber:block.number,blockHash:block.hash,
    stateReference:'EIP-1898 canonical latest block; not asserted finalized',receiptSha256:hash(receiptText),reviewSha256:hash(reviewText),buildDigest:review.buildDigest,transactionsBroadcast:0,...result};
  durableWrite(path.resolve(process.env.AUTHORITY_REPORT),report,{exclusive:true});console.log(JSON.stringify(report,null,2));process.exitCode=3;
}
module.exports={normalizeReview,inspectDirectAuthority,main};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
