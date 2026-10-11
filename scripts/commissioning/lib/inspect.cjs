'use strict';
const E=require('ethers');
const C=require('../../../hardhat/scripts/check-ens-usdc-connection.cjs');
const {createCanonicalReader}=require('../../../hardhat/scripts/canonical-state.cjs');
const {readRegistrySnapshot}=require('../../../hardhat/scripts/nft-registry-snapshot.cjs');
const {requireArtifactMatch}=require('../../../hardhat/scripts/deployment-safety.cjs');
const {ensure,read,failure}=require('./io.cjs');
const {inventory}=require('./approvals.cjs');
const POLICY=['requiredValidatorApprovals','requiredValidatorDisapprovals','voteQuorum','premiumReputationThreshold','validationRewardPercentage','maxJobPayout','jobDurationLimit','completionReviewPeriod','disputeReviewPeriod','validatorBondBps','validatorBondMin','validatorBondMax','validatorSlashBps','challengePeriodAfterApproval','agentBond','agentBondBps','agentBondMax','maxActiveJobsPerAgent'];
const RESERVES=['lockedEscrow','lockedAgentBonds','lockedValidatorBonds','lockedDisputeBonds','lockedClaims'];
const ROOTS=['clubRootNode','agentRootNode','alphaClubRootNode','alphaAgentRootNode','validatorMerkleRoot','agentMerkleRoot'];
const ABI=[...C.ABI.manager,...POLICY.map(n=>`function ${n}() view returns (uint256)`),...RESERVES.map(n=>`function ${n}() view returns (uint256)`),
  ...ROOTS.map(n=>`function ${n}() view returns (bytes32)`),'function wallet30() view returns (address)','function wallet10() view returns (address)',
  'function agentNftRequired() view returns (bool)','function MAX_AGI_TYPES() view returns (uint256)',
  'function agiTypes(uint256) view returns (address nftAddress,uint256 payoutPercentage)',
  ...['moderators','additionalValidators','additionalAgents','blacklistedAgents','blacklistedValidators'].map(n=>`function ${n}(address) view returns (bool)`)];
function accounting(balance,reserves) {
  ensure(typeof balance==='bigint' && balance>=0n && RESERVES.every(n=>typeof reserves[n]==='bigint' && reserves[n]>=0n),'RESERVE_VALUE_INVALID');
  const total=RESERVES.reduce((s,n)=>s+reserves[n],0n);
  return {status:balance>=total && total===0n?'PASS':'FAIL',balance:balance.toString(),reserves:Object.fromEntries(RESERVES.map(n=>[n,reserves[n].toString()])),
    reserved:total.toString(),surplus:(balance-total).toString(),solvent:balance>=total,initialActivationReservesZero:total===0n,decimals:6};
}
async function inspect({rpc,mode='mainnet',build,approvalStart,participants=[],now=Date.now()}) {
  ensure(C.quantity(await rpc('eth_chainId',[]))===1n,'WRONG_CHAIN');
  const raw=await rpc('eth_getBlockByNumber',['latest',false]), snapshot=C.blockInfo(raw);
  ensure(BigInt(snapshot.timestampSeconds)*1000n<=BigInt(now+60000) && BigInt(now)-BigInt(snapshot.timestampSeconds)*1000n<=900000n,'RPC_LATEST_BLOCK_STALE_OR_FUTURE');
  const reader=createCanonicalReader({send:rpc},snapshot), sections={}, inputs=[];
  const stage=async(name,fn)=>{try{sections[name]=await fn();}catch(e){sections[name]={status:'FAIL',code:failure(e),...(e.inventory?{inventory:e.inventory}:{})};}};
  await stage('ens',async()=>{
    const report=C.startReport();
    const fixed=async(method,params)=> {
      if(method==='eth_getBlockByNumber' && params[0]==='latest')return raw;
      if(['eth_call','eth_getCode'].includes(method)) {
        ensure(params.at(-1)===snapshot.tag,'ENS_SNAPSHOT_MISMATCH');
        params=[...params.slice(0,-1),reader.at];
      }
      return rpc(method,params);
    };
    try {await C.collect(E,fixed,report);} catch(e) {report.status='STOPPED_REVIEW_REQUIRED'; return {status:'FAIL',code:e instanceof C.Stop?e.code:'ENS_READ_FAILED',historicalSchemaReport:report,recovery:'Review the specific drift and original journal. No automatic redeployment.'};}
    return {status:'PASS',message:'existing helper verified/connected; no deployment needed',historicalSchemaReport:report};
  });
  if(mode==='mainnet') await stage('core',async()=>{
    const manager=reader.contract(C.P.manager,ABI), get=async names=>Object.fromEntries(await Promise.all(names.map(async n=>[n,await manager[n]()])));
    const state=await get(['owner','pendingOwner','paused','settlementPaused','usdcToken','wallet30','wallet10','agentNftRequired','ens','nameWrapper','lockIdentityConfig',...POLICY,...ROOTS]);
    ensure(C.eq(state.usdcToken,C.P.usdc),'MANAGER_USDC_CHANGED');
    const token=reader.contract(C.P.usdc,['function balanceOf(address) view returns (uint256)','function decimals() view returns (uint8)','function paused() view returns (bool)','function isBlacklisted(address) view returns (bool)']);
    const reserves=await get(RESERVES), amounts=accounting(await token.balanceOf(C.P.manager),reserves);
    const implWord=await reader.getStorage(C.P.usdc,E.id('org.zeppelinos.proxy.implementation'));
    ensure(/^0x0{24}[0-9a-fA-F]{40}$/.test(implWord),'USDC_IMPLEMENTATION_SLOT_MALFORMED');
    const implementation=E.getAddress('0x'+implWord.slice(-40)), implCode=await reader.getCode(implementation);
    ensure(implCode!=='0x','USDC_IMPLEMENTATION_MISSING');
    ensure(Array.isArray(participants)&&participants.length<=32&&participants.every(E.isAddress),'PARTICIPANT_ADDRESS_INVALID');
    const blacklisted={};
    for(const a of new Set([C.P.manager,state.owner,state.wallet30,state.wallet10,...participants].map(a=>a.toLowerCase())))blacklisted[a]=await token.isBlacklisted(a);
    const tokenState={decimals:String(await token.decimals()),paused:await token.paused(),blacklisted,implementation,implementationCodeHash:E.keccak256(implCode),proxyCodeHash:E.keccak256(await reader.getCode(C.P.usdc)),issuerUpgradeAuthority:'NOT_ASSESSED'};
    const exceptions={};
    for(const a of participants) exceptions[a]=Object.fromEntries(await Promise.all(['moderators','additionalValidators','additionalAgents','blacklistedAgents','blacklistedValidators'].map(async n=>[n,await manager[n](a)])));
    let nft={status:'NOT_RUN',code:'REVIEWED_MANAGER_ARTIFACT_AND_BUILD_REQUIRED'};
    if(build) {
      const input=read(build,64*1024*1024); inputs.push({role:'reviewed-manager-build',sha256:input.sha256,bytes:input.bytes});
      const b=input.value; ensure(b.schema==='agijobmanager-reviewed-build-v1' && b.artifact && b.buildInfo && b.libraries,'REVIEWED_BUILD_SCHEMA');
      requireArtifactMatch({artifact:b.artifact,buildInfo:b.buildInfo,address:C.P.manager,libraries:b.libraries,tokenAddress:C.P.usdc,code:await reader.getCode(C.P.manager)});
      nft={status:'PASS',...await readRegistrySnapshot({manager,provider:reader,artifact:b.artifact,buildInfo:b.buildInfo,calls:{blockTag:reader.at}})};
      for(const e of nft.agiTypes) if(BigInt(e.payoutPercentage)>0n)ensure(await reader.getCode(e.nftAddress)!=='0x','NFT_COLLECTION_CODE_MISSING');
    }
    const valid=amounts.status==='PASS' && C.eq(state.owner,C.P.administrator) && C.eq(state.pendingOwner,C.ZERO) && state.paused && !state.settlementPaused &&
      state.wallet30!==state.wallet10 && ![state.wallet30,state.wallet10].some(a=>C.eq(a,C.ZERO)) && tokenState.decimals==='6' && !tokenState.paused && !Object.values(blacklisted).some(Boolean);
    return {status:!valid?'FAIL':nft.status==='PASS'?'PASS':'NEEDS_OPERATOR_INPUT',observed:state,accounting:amounts,token:tokenState,nft,
      participantExceptions:exceptions,exceptionInventory:'Only explicitly supplied participant addresses; mappings are not globally enumerable.',
      policyReview:'Observed values require comparison with separately accepted A1 choices; private manager metadata/token-URI mode are not read.'};
  });
  if(approvalStart!==undefined) await stage('approvals',()=>inventory({E,rpc,reader,wallet:C.P.rootOwner,wrapper:C.P.wrapper,snapshot,startBlock:approvalStart}));
  else sections.approvals={status:'NOT_RUN',code:'EXPLICIT_APPROVAL_START_BLOCK_REQUIRED'};
  const final=C.blockInfo(await rpc('eth_getBlockByNumber',[snapshot.tag,false]));
  ensure(final.hash===snapshot.hash && final.number===snapshot.number && final.timestampSeconds===snapshot.timestampSeconds,'SNAPSHOT_REORG');
  ensure(C.quantity(await rpc('eth_chainId',[]))===1n,'CHAIN_CHANGED');
  return {schema:'agijobmanager-current-observation-v1',chainId:1,instance:'recorded-2026-10-10',manager:C.P.manager,helper:C.P.helper,namespace:C.P.root,
    observedAt:new Date(now).toISOString(),snapshot,stateReference:'EIP-1898 canonical block hash; no numeric fallback',sections,inputs,
    status:Object.values(sections).some(s=>s.status==='FAIL')?'FAIL':Object.values(sections).some(s=>s.status!=='PASS')?'NEEDS_OPERATOR_INPUT':'PASS',
    witness:{count:1,independence:'NOT_ASSESSED',scope:'One configured RPC. Another URL alone does not establish infrastructure independence.'},
    lifecycle:{status:'NOT_RUN'},operatorAuthorization:{status:'NEEDS_OPERATOR_INPUT'},intakeActivationAuthorized:false,productionReadinessCertified:false,publicTransactionsBroadcast:0};
}
module.exports={inspect,accounting,POLICY,RESERVES,ROOTS,ABI};
