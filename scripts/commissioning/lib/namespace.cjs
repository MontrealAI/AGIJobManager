'use strict';
const E=require('ethers'),{ensure}=require('./io.cjs');
const C=require('../../../hardhat/scripts/check-ens-usdc-connection.cjs');
const {createCanonicalReader}=require('../../../hardhat/scripts/canonical-state.cjs');
const {deriveJobsRootName}=require('../../../hardhat/scripts/deploy-ens-job-pages.cjs');
async function plan({rpc,config}){
  ensure(config?.schema==='agijobmanager-ens-namespace-plan-v1'&&['fresh','existing-root','replacement'].includes(config.mode),'NAMESPACE_MODE_REQUIRED');
  ensure(E.isAddress(config.manager)&&!C.eq(config.manager,E.ZeroAddress),'NAMESPACE_MANAGER_REQUIRED');
  ensure(C.quantity(await rpc('eth_chainId',[]))===1n,'WRONG_CHAIN');
  const snapshot=C.blockInfo(await rpc('eth_getBlockByNumber',['latest',false])),reader=createCanonicalReader({send:rpc},snapshot);
  const manager=reader.contract(config.manager,C.ABI.manager),previous=await manager.ensJobPages(),next=await manager.nextJobId();
  ensure(C.eq(await manager.usdcToken(),C.P.usdc)&&await manager.paused()&&C.eq(await manager.pendingOwner(),C.ZERO),'MANAGER_PRECONDITIONS_CHANGED');
  ensure(C.eq(await manager.ens(),C.P.registry)&&C.eq(await manager.nameWrapper(),C.P.wrapper),'MANAGER_ENS_DEPENDENCIES_CHANGED');
  let root,prefix='job-';
  if(config.mode==='fresh'){
    ensure(C.eq(previous,E.ZeroAddress)&&next===0n,'EXISTING_INSTANCE_USE_INSPECTION_OR_REPLACEMENT');
    root=deriveJobsRootName(1,config.manager);ensure(!config.rootName||config.rootName===root,'FRESH_NAMESPACE_MISMATCH');
  }else if(config.mode==='replacement'){
    ensure(!C.eq(previous,E.ZeroAddress),'REPLACEMENT_REQUIRES_EXISTING_HELPER');
    const helper=reader.contract(previous,C.ABI.helper);ensure(C.eq(await helper.jobManager(),config.manager),'HELPER_BELONGS_TO_OTHER_MANAGER');
    root=await helper.jobsRootName();prefix=await helper.jobLabelPrefix();
    ensure(!config.rootName||config.rootName===root,'REPLACEMENT_NAMESPACE_CHANGED');
    ensure(E.namehash(root)===(await helper.jobsRootNode()),'REPLACEMENT_NAMEHASH_CHANGED');
  }else{
    ensure(C.eq(previous,E.ZeroAddress)&&next===0n,'EXISTING_INSTANCE_USE_INSPECTION_OR_REPLACEMENT');
    ensure(typeof config.rootName==='string'&&E.ensNormalize(config.rootName)===config.rootName&&E.isAddress(config.rootOwner),'EXISTING_ROOT_AND_HOLDER_REQUIRED');root=config.rootName;
  }
  ensure(root!=='alpha.jobs.agi.eth','LEGACY_NAMESPACE_RESERVED');
  const node=E.namehash(root),registry=reader.contract(C.P.registry,C.ABI.registry),wrapper=reader.contract(C.P.wrapper,C.ABI.wrapper);
  const registryOwner=await registry.owner(node),resolver=await registry.resolver(node);let custody=null;
  if(config.mode==='fresh')ensure(C.eq(registryOwner,E.ZeroAddress)&&C.eq(resolver,E.ZeroAddress),'FRESH_NAMESPACE_OCCUPIED_RECONCILE_HISTORY');
  else{
    ensure(!C.eq(registryOwner,E.ZeroAddress),'ROOT_MISSING_REVIEW_RECOVERY');
    if(C.eq(registryOwner,C.P.wrapper)){const data=await wrapper.getData(BigInt(node));custody={owner:data[0],fuses:String(data[1]),expiry:String(data[2])};}
    else custody={owner:registryOwner,wrapped:false};
    if(config.mode==='existing-root')ensure(C.eq(custody.owner,config.rootOwner),'EXISTING_ROOT_HOLDER_MISMATCH');
  }
  const final=C.blockInfo(await rpc('eth_getBlockByNumber',[snapshot.tag,false]));ensure(final.hash===snapshot.hash&&C.quantity(await rpc('eth_chainId',[]))===1n,'NAMESPACE_SNAPSHOT_CHANGED');
  return {schema:'agijobmanager-namespace-review-v1',status:'NEEDS_OPERATOR_INPUT',mode:config.mode,snapshot,manager:config.manager,previousHelper:previous,root,prefix,node,registryOwner,resolver,custody,
    rootTransferPlanned:false,rootRecreationPlanned:false,helperDeploymentAuthorized:false,publicTransactionsBroadcast:0,intakeActivationAuthorized:false,productionReadinessCertified:false,
    nextAction:config.mode==='replacement'?'Review historical labels, current helper configuration, new-helper build and separately authorized same-manager cutover.':'Review authority/fuses/expiry, exact helper build and separately authorized deployment plan.',
    limitations:['Namespace preconditions only; no deployment or authority-grant transaction is constructed.','Wallet-held wrapped roots require reviewed wallet-wide approval; renewal permission is not equivalent.','Current commissioned instance operators should use ens:inspect.']};
}
module.exports={plan};
