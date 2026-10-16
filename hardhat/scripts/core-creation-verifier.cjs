'use strict';
const E=require('ethers'),T=require('./transaction-envelope.cjs'),A=require('./actor-policy.cjs');
const {checkPlan}=require('./core-creation-plan.cjs');
const {createCanonicalReader}=require('./canonical-state.cjs');
const {requireArtifactMatch,USDC_ABI,requireOperationalUSDC}=require('./deployment-safety.cjs');
function reader(rpc,block){return createCanonicalReader({send:rpc},block);}
async function verifyRuntime(plan,qualified,rpc,index,block){
 const op=plan.operations[index],artifact=qualified.records[op.name].artifact,read=reader(rpc,block),code=await read.getCode(op.predictedAddress);
 requireArtifactMatch({artifact,buildInfo:qualified.buildInfo,address:op.predictedAddress,libraries:plan.libraries,tokenAddress:plan.config.constructorArgs.usdcTokenAddress,code});
 if(index===8){
  const c=read.contract(op.predictedAddress,artifact.abi),expected={owner:plan.governor,pendingOwner:E.ZeroAddress,paused:true,settlementPaused:false,ensJobPages:E.ZeroAddress,useEnsJobTokenURI:false,agentNftRequired:false,usdcToken:plan.config.constructorArgs.usdcTokenAddress,wallet30:plan.config.constructorArgs.settlementWallets[0],wallet10:plan.config.constructorArgs.settlementWallets[1],ens:plan.config.constructorArgs.ensConfig[0],nameWrapper:plan.config.constructorArgs.ensConfig[1],clubRootNode:plan.config.constructorArgs.rootNodes[0],alphaClubRootNode:plan.config.constructorArgs.rootNodes[1],agentRootNode:plan.config.constructorArgs.rootNodes[2],alphaAgentRootNode:plan.config.constructorArgs.rootNodes[3],validatorMerkleRoot:plan.config.constructorArgs.merkleRoots[0],agentMerkleRoot:plan.config.constructorArgs.merkleRoots[1],lockIdentityConfig:false};
  for(const [key,value] of Object.entries(expected)){const actual=await c[key]();T.need(typeof value==='string'?String(actual).toLowerCase()===value.toLowerCase():actual===value,`Manager ${key} changed from core creation state; reconcile separately authorized configuration.`);}
  for(const key of ['moderators','additionalAgents','additionalValidators'])T.need(await c[key](plan.creator)===false,'Creator has a direct exception.');
  for(const key of ['lockedEscrow','lockedAgentBonds','lockedValidatorBonds','lockedDisputeBonds','lockedClaims','nextJobId'])T.need(await c[key]()===0n,'New Manager has unexpected jobs/reserves.');
 }
 return E.keccak256(code);
}
async function verifyReceipt(plan,qualified,rpc,index,txHash,finalBlock){
 T.hash(txHash);const op=plan.operations[index],tx=await rpc('eth_getTransactionByHash',[txHash]),receipt=await rpc('eth_getTransactionReceipt',[txHash]);
 T.need(tx&&receipt&&receipt.status==='0x1'&&receipt.type==='0x2','Successful mined type-2 creation receipt required.');
 const decoded=T.decodeSigned(T.rpcTransactionRaw(tx),op.envelope);T.need(decoded.hash===txHash&&tx.hash===txHash&&receipt.transactionHash===txHash,'Signed transaction/receipt hash mismatch.');
 T.need(E.getAddress(tx.from)===plan.creator&&E.getAddress(receipt.from)===plan.creator&&receipt.to===null&&E.getAddress(receipt.contractAddress)===op.predictedAddress,'Creation sender/address differs.');
 for(const key of ['blockHash','blockNumber','transactionIndex'])T.need(tx[key]===receipt[key],`Transaction/receipt ${key} differs.`);
 const block={number:Number(BigInt(receipt.blockNumber)),hash:receipt.blockHash};T.integer(block.number);T.hash(block.hash);
 T.need(block.number>plan.config.block.number&&block.number<=finalBlock.number,'Creation receipt is outside the canonical finalized campaign interval.');
 await A.canonicalCheck(rpc,block);
 const runtimeCodeHash=await verifyRuntime(plan,qualified,rpc,index,block);
 if(index===8){const iface=new E.Interface(qualified.records.AGIJobManager.artifact.abi),events=receipt.logs.filter(x=>x.address.toLowerCase()===op.predictedAddress.toLowerCase()).map(x=>{try{return iface.parseLog(x);}catch{return null;}}).filter(x=>x?.name==='OwnershipTransferred');
  T.need(events.length===2&&events[0].args.previousOwner===E.ZeroAddress&&events[0].args.newOwner===plan.creator&&events[1].args.previousOwner===plan.creator&&events[1].args.newOwner===plan.governor,'Constructor ownership event sequence differs from the exact OpenZeppelin build.');}
 return {index,transactionHash:txHash,address:op.predictedAddress,block,transactionIndex:Number(BigInt(receipt.transactionIndex)),runtimeCodeHash};
}
async function verifyPrefix(plan,qualified,source,rpc,hashes){
 checkPlan(plan,qualified,source);T.need(Array.isArray(hashes)&&hashes.length<=9&&new Set(hashes).size===hashes.length,'Exact contiguous creation prefix required.');
 T.need(BigInt(await rpc('eth_chainId',[]))===1n,'Wrong chain.');const finalBlock=await A.pin(rpc,'finalized');T.need(finalBlock.number>=plan.config.block.number,'Reviewed plan pin is not finalized.');
 await A.observeActor(rpc,plan.config,plan.config.block);const proofs=[];
 for(let i=0;i<hashes.length;i++){const p=await verifyReceipt(plan,qualified,rpc,i,hashes[i],finalBlock);if(proofs.length){const old=proofs.at(-1);T.need(p.block.number>old.block.number||(p.block.number===old.block.number&&p.transactionIndex>old.transactionIndex),'Creation order differs.');}proofs.push(p);}
 const latest=await A.pin(rpc,'latest');await A.observeActor(rpc,plan.config,latest);
 for(let i=0;i<hashes.length;i++)await verifyRuntime(plan,qualified,rpc,i,latest);
 await A.canonicalCheck(rpc,finalBlock);await A.canonicalCheck(rpc,latest);return {proofs,finalBlock,latest,activationAuthorized:false,configurationAuthorized:false};
}
async function preflight(plan,qualified,source,rpc,hashes=[]){
 const result=await verifyPrefix(plan,qualified,source,rpc,hashes),latest=result.latest;
 T.need(latest.number<=plan.config.expiresAfterBlock,'Plan validity expired; reconcile outstanding capabilities before replacing the plan.');
 await A.observeActor(rpc,plan.config,latest);
 const nonce=plan.startNonce+hashes.length;
 for(const tag of ['latest','pending'])T.need(BigInt(await rpc('eth_getTransactionCount',[plan.creator,tag]))===BigInt(nonce),'Creator pending/latest nonce drift.');
 const at={blockHash:latest.hash,requireCanonical:true};
 for(let i=hashes.length;i<9;i++){const address=plan.operations[i].predictedAddress;T.need(await rpc('eth_getCode',[address,at])==='0x'&&BigInt(await rpc('eth_getTransactionCount',[address,at]))===0n,'Predicted creation address is already occupied.');}
 const c=plan.config.constructorArgs,read=reader(rpc,latest);
 for(const dependency of [c.usdcTokenAddress,...c.ensConfig].filter(x=>x!==E.ZeroAddress))T.need(await read.getCode(dependency)!=='0x','Configured dependency has no code.');
 await requireOperationalUSDC({chainId:1,tokenAddress:c.usdcTokenAddress,token:read.contract(c.usdcTokenAddress,USDC_ABI),recipients:[...c.settlementWallets,plan.governor,plan.creator],blockTag:read.at});
 let estimate=null;
 if(hashes.length<9){const e=plan.operations[hashes.length].envelope;T.need(BigInt(e.gasLimit)<=BigInt(latest.gasLimit)&&BigInt(e.maxFeePerGas)>=BigInt(latest.baseFeePerGas),'Reviewed gas/fee envelope is outside current block bounds.');
  const tx={type:'0x2',from:e.from,to:null,value:'0x0',data:e.data,gas:E.toQuantity(e.gasLimit),maxFeePerGas:E.toQuantity(e.maxFeePerGas),maxPriorityFeePerGas:E.toQuantity(e.maxPriorityFeePerGas),nonce:E.toQuantity(e.nonce),accessList:[]};
  estimate=String(BigInt(await rpc('eth_estimateGas',[tx,at])));T.need(BigInt(estimate)>0n&&BigInt(estimate)<=BigInt(e.gasLimit),'Creation estimate exceeds reviewed gas limit.');
 }
 const end=await A.pin(rpc,'latest');T.need(end.hash===latest.hash,'Latest block changed during preflight; repeat read-only checks.');
 return {...result,nextIndex:hashes.length,nextNonce:nonce,estimatedGas:estimate,preflightPassed:true,readyToBroadcast:false};
}
async function recoverHash(plan,index,rpc,startBlock,knownHash){
 const op=plan.operations[index];T.integer(startBlock);if(knownHash){T.hash(knownHash);const tx=await rpc('eth_getTransactionByHash',[knownHash]);if(tx){T.need(T.decodeSigned(T.rpcTransactionRaw(tx),op.envelope).hash===knownHash,'Known hash differs from intent.');return knownHash;}}
 const head=await A.pin(rpc,'latest');T.need(head.number>=startBlock&&head.number-startBlock<2048,'Recovery exceeds bounded 2048-block scan.');let found;
 for(let n=startBlock;n<=head.number;n++){const b=await rpc('eth_getBlockByNumber',[E.toQuantity(n),true]);T.need(b&&Number(BigInt(b.number))===n&&Array.isArray(b.transactions),'Incomplete canonical block.');
  for(const tx of b.transactions){T.need(tx&&typeof tx==='object','Full transaction block required.');if(tx.from?.toLowerCase()!==plan.creator.toLowerCase()||Number(BigInt(tx.nonce))!==op.envelope.nonce)continue;const h=T.decodeSigned(T.rpcTransactionRaw(tx),op.envelope).hash;T.need(tx.hash===h&&(!found||found===h),'Conflicting nonce or ambiguous history.');found=h;}
  await A.canonicalCheck(rpc,{number:n,hash:b.hash});
 }
 await A.canonicalCheck(rpc,head);T.need(found,'No exact canonical creation found. Handed-off bytes may still be pending; never resend or reuse nonce.');return found;
}
module.exports={verifyRuntime,verifyReceipt,verifyPrefix,preflight,recoverHash};
