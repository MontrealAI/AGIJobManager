'use strict';
const E=require('ethers');
const C=require('../../../hardhat/scripts/check-ens-usdc-connection.cjs');
const H=require('../mainnet-evidence.cjs');
const {read,ensure}=require('./io.cjs');
async function recover({rpc,journal,artifact}){
  const history=H.load();H.validate(history);
  const j=read(journal,4*1024*1024),expected=history.sourceEvidence.find(e=>e.kind==='deployment');
  ensure(j.sha256===expected.sha256 && j.bytes===expected.bytes,'JOURNAL_NOT_THE_RECORDED_DEPLOYMENT');
  const state=j.value;ensure(state.schema==='ENSJobPages-USDC-mainnet-deployment-v1' && state.actions?.length===4,'JOURNAL_SCHEMA');
  ensure(C.quantity(await rpc('eth_chainId',[]))===1n,'WRONG_CHAIN');
  const snapshot=C.blockInfo(await rpc('eth_getBlockByNumber',['latest',false]));
  const inputs=[{role:'original-helper-journal',sha256:j.sha256,bytes:j.bytes}],checks=[];
  let exactCreation='NOT_RUN';
  if(artifact){
    const a=read(artifact,4*1024*1024); inputs.push({role:'saved-helper-artifact',sha256:a.sha256,bytes:a.bytes});
    ensure(a.value.contractName==='ENSJobPages'&&E.keccak256(a.value.deployedBytecode)===C.CODE_HASHES.helper,'RECOVERY_ARTIFACT_IDENTITY');
    const iface=new E.Interface(a.value.abi),data=a.value.bytecode+iface.encodeDeploy(history.deployment.constructorArguments).slice(2);
    ensure(data.toLowerCase()===state.actions[0].request.data.toLowerCase(),'RECOVERY_CREATION_OR_CONSTRUCTOR_MISMATCH');exactCreation='PASS';
  }
  const iface=new E.Interface(['function setJobManager(address)','function setJobLabelPrefix(string)','function transferOwnership(address)']);
  const payloads=[null,iface.encodeFunctionData('setJobManager',[C.P.manager]),iface.encodeFunctionData('setJobLabelPrefix',['job-']),iface.encodeFunctionData('transferOwnership',[C.P.administrator])];
  for(const [i,step] of state.actions.entries()){
    const pin=history.connection.transactions[i];ensure(step.hash===pin.hash && step.request.nonce===pin.nonce,'RECOVERY_JOURNAL_TX_IDENTITY');
    if(i)ensure(C.eq(step.request.data,payloads[i]),'RECOVERY_CONFIGURATION_CALLDATA');
    const tx=await rpc('eth_getTransactionByHash',[pin.hash]),receipt=await rpc('eth_getTransactionReceipt',[pin.hash]);
    if(!tx||!receipt){
      const nonce=C.quantity(await rpc('eth_getTransactionCount',[history.deployer,'latest']));
      ensure(nonce<=BigInt(pin.nonce),'RECOVERY_NONCE_CONSUMED_RECEIPT_MISSING');
      ensure(false,'RECOVERY_AMBIGUOUS_BROADCAST_WAIT_AND_RECONCILE');
    }
    ensure(C.eq(tx.hash,pin.hash)&&C.eq(receipt.transactionHash,pin.hash)&&C.eq(tx.from,pin.from)&&C.eq(receipt.from,pin.from)&&
      C.quantity(tx.chainId)===1n&&C.quantity(tx.nonce)===BigInt(pin.nonce)&&C.quantity(tx.value)===0n&&C.eq(tx.input,step.request.data),'RECOVERY_TX_MISMATCH');
    ensure(i===0?tx.to===null&&receipt.to===null&&C.eq(receipt.contractAddress,C.P.helper):C.eq(tx.to,C.P.helper)&&C.eq(receipt.to,C.P.helper)&&receipt.contractAddress===null,'RECOVERY_TARGET_MISMATCH');
    ensure(C.quantity(receipt.status)===1n&&C.quantity(receipt.blockNumber)===BigInt(pin.blockNumber)&&C.quantity(tx.blockNumber)===BigInt(pin.blockNumber)&&
      C.eq(tx.blockHash,pin.blockHash)&&C.eq(receipt.blockHash,pin.blockHash)&&snapshot.number>=pin.blockNumber+2,'RECOVERY_RECEIPT_MISMATCH');
    const block=await rpc('eth_getBlockByNumber',[E.toQuantity(pin.blockNumber),false]);ensure(C.eq(block?.hash,pin.blockHash),'RECOVERY_REORG');
    checks.push({action:pin.action,status:'PASS',transactionHash:pin.hash,blockNumber:pin.blockNumber,blockHash:pin.blockHash});
  }
  ensure(C.eq(E.getCreateAddress({from:history.deployer,nonce:history.connection.transactions[0].nonce}),C.P.helper),'RECOVERY_CREATION_NONCE_MISMATCH');
  ensure(E.keccak256(await rpc('eth_getCode',[C.P.helper,{blockHash:snapshot.hash,requireCanonical:true}]))===C.CODE_HASHES.helper,'RECOVERY_RUNTIME_MISMATCH');
  const final=await rpc('eth_getBlockByNumber',[snapshot.tag,false]);ensure(C.eq(final?.hash,snapshot.hash),'RECOVERY_REORG');
  ensure(C.quantity(await rpc('eth_chainId',[]))===1n,'CHAIN_CHANGED');
  return {schema:'agijobmanager-recovery-review-v1',status:exactCreation==='PASS'?'PASS':'NEEDS_OPERATOR_INPUT',snapshot,inputs,checks,helper:C.P.helper,
    exactCreationFromSavedArtifact:exactCreation,verification:{status:'HISTORICAL_VERIFIED',freshExplorerComparison:'NOT_RUN'},
    nextAction:exactCreation==='PASS'?'Existing creation/configuration reconciled; run ens:inspect. No deployment needed.':'Supply the saved helper artifact for constructor/creation comparison. Preserve all journals; do not redeploy.',
    limitations:['Read-only reconciliation of this recorded instance. No new nonce, signature, broadcast or journal rewrite.','Runtime identity does not replace exact explorer source verification. Use the maintained verifier only with reviewed original build inputs.'],
    intakeActivationAuthorized:false,productionReadinessCertified:false,publicTransactionsBroadcast:0};
}
module.exports={recover};
