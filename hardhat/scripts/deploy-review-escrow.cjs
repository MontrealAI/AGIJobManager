const fs=require('node:fs'),path=require('node:path');
const {getRuntime}=require('./runtime.cjs');
const {requireCanonicalUSDC}=require('../../scripts/lib/usdc.js');
const {parseBooleanSetting,requireDeploymentNetwork,requireRuntimeSize,prepareDeployment,requireArtifactMatch,requireConfirmedReceipt,requireExplorerEnabled}=require('./deployment-safety.cjs');
function settings(env=process.env){
 const dryRun=parseBooleanSetting(env.DRY_RUN,'DRY_RUN',true),confirmations=Number(env.CONFIRMATIONS||'3');
 if(!Number.isSafeInteger(confirmations)||confirmations<3||confirmations>128)throw Error('CONFIRMATIONS must be 3..128.');
 if(!/^0x[0-9a-f]{64}$/.test(env.JOB_MANAGER_CODE_HASH||''))throw Error('JOB_MANAGER_CODE_HASH must pin the verified manager runtime.');
 if(!env.JOB_MANAGER)throw Error('JOB_MANAGER is required.');
 if(!dryRun&&!env.VERIFY_RPC_URL)throw Error('VERIFY_RPC_URL is required for deployment or verification recovery.');
 return {dryRun,confirmations,manager:env.JOB_MANAGER,managerCodeHash:env.JOB_MANAGER_CODE_HASH,maxETH:env.MAX_REVIEW_DEPLOY_ETH||'0.05',existing:env.REVIEW_ESCROW_ADDRESS||null};
}
async function main(){
 const config=settings(),hre=await getRuntime(),{ethers,network}=hre,p=ethers.provider;
 const chainId=Number((await p.getNetwork()).chainId);requireDeploymentNetwork(network.name,chainId);
 const manager=ethers.getAddress(config.manager),code=await p.getCode(manager);
 if(code==='0x'||ethers.keccak256(code)!==config.managerCodeHash)throw Error('Manager runtime pin mismatch.');
 const token=await new ethers.Contract(manager,['function usdcToken() view returns(address)'],p).usdcToken();requireCanonicalUSDC(chainId,token);
 const artifact=await hre.artifacts.readArtifact('AGIReviewEscrow'),buildInfo=await hre.artifacts.getBuildInfo('AGIReviewEscrow');
 if(!buildInfo)throw Error('Compile the pinned source first.');requireRuntimeSize('AGIReviewEscrow',artifact.deployedBytecode);
 const [signer]=await ethers.getSigners();if(!signer)throw Error('A configured deployment signer is required, including for gas estimation.');
 const factory=await ethers.getContractFactory('AGIReviewEscrow',{signer}),from=await signer.getAddress();
 const prepared=config.existing?null:await prepareDeployment({provider:p,factory,args:[manager],from,name:'AGIReviewEscrow'});
 if(config.dryRun){console.log(JSON.stringify({mode:'READ_ONLY_PLAN',chainId,manager,token,managerCodeHash:config.managerCodeHash,existing:config.existing,deployer:from,estimatedGas:prepared?.estimatedGas.toString(),maxETH:config.maxETH,terms:'Additional employer-paid capacity retainer; irrevocable after named reviewer activation. Independent audit and commissioning remain required.'},null,2));return;}
 if(chainId===1&&process.env.DEPLOY_CONFIRM_MAINNET!=='I_UNDERSTAND_MAINNET_DEPLOYMENT')throw Error('Explicit mainnet deployment confirmation required.');
 requireExplorerEnabled(hre.config);
 const witness=new ethers.JsonRpcProvider(process.env.VERIFY_RPC_URL,chainId,{staticNetwork:true});
 const block=await p.getBlock('latest'),other=await witness.getBlock(block.number);
 if(!other||other.hash!==block.hash||ethers.keccak256(await witness.getCode(manager,block.number))!==config.managerCodeHash)throw Error('Independent RPC disagrees with manager deployment.');
 const directory=path.join(__dirname,'../deployments',network.name);fs.mkdirSync(directory,{recursive:true});
 const file=path.join(directory,`review-escrow.${chainId}.${manager.toLowerCase()}.json`);
 let journal,address=config.existing;
 const checkpoint=()=>{fs.writeFileSync(file+'.tmp',JSON.stringify(journal,null,2)+'\n',{mode:0o600});fs.renameSync(file+'.tmp',file);};
 if(address){
  if(!fs.existsSync(file))throw Error('Verification recovery requires the original local deployment journal.');
  journal=JSON.parse(fs.readFileSync(file));if(journal.manager!==manager||journal.chainId!==chainId||ethers.getAddress(address)!==ethers.getAddress(journal.address))throw Error('Recovery scope differs from original journal.');
  const receipt=await p.getTransactionReceipt(journal.transactionHash);requireConfirmedReceipt(receipt,journal.transactionHash,address);
  if(block.number-receipt.blockNumber+1<config.confirmations||other.number<receipt.blockNumber||(await witness.getBlock(receipt.blockNumber))?.hash!==receipt.blockHash)throw Error('Deployment is not independently confirmed.');
 }else{
  const nonce=await p.getTransactionCount(from,'pending');if(nonce!==await p.getTransactionCount(from,'latest'))throw Error('Reconcile pending deployer transactions first.');
  const fee=await p.getFeeData();if(fee.maxFeePerGas===null||prepared.gasLimit*fee.maxFeePerGas>ethers.parseEther(config.maxETH))throw Error('Deployment cost exceeds MAX_REVIEW_DEPLOY_ETH.');
  address=ethers.getCreateAddress({from,nonce});journal={status:'prepared',chainId,manager,token,managerCodeHash:config.managerCodeHash,deployer:from,nonce,address,compiler:buildInfo.solcVersion,constructorArguments:[manager]};
  fs.writeFileSync(file,JSON.stringify(journal,null,2)+'\n',{mode:0o600,flag:'wx'});
  fs.writeFileSync(file.replace(/\.json$/,'.solc-input.json'),JSON.stringify(buildInfo.input,null,2)+'\n',{mode:0o600,flag:'wx'});
  try{
   const deployed=await factory.deploy(manager,{nonce,gasLimit:prepared.gasLimit,maxFeePerGas:fee.maxFeePerGas,maxPriorityFeePerGas:fee.maxPriorityFeePerGas??0n});
   const tx=deployed.deploymentTransaction();journal.transactionHash=tx.hash;journal.status='broadcast';checkpoint();
   const receipt=requireConfirmedReceipt(await tx.wait(config.confirmations),tx.hash,address);journal.receipt={blockNumber:receipt.blockNumber,blockHash:receipt.blockHash};journal.status='confirmed';checkpoint();
  }catch(e){journal.status='reconciliation_required';checkpoint();throw Error('Deployment may have broadcast. Preserve '+file+' and reconcile its nonce/address before any retry. '+e.message);}
 }
 const deployedCode=await p.getCode(address);requireArtifactMatch({artifact,buildInfo,address,managerAddress:manager,tokenAddress:token,code:deployedCode});
 const escrow=new ethers.Contract(address,artifact.abi,p);
 if((await escrow.manager()).toLowerCase()!==manager.toLowerCase()||(await escrow.usdcToken()).toLowerCase()!==token.toLowerCase())throw Error('Escrow immutable state mismatch.');
 const canonical=await p.getBlock('latest');if((await witness.getBlock(canonical.number))?.hash!==canonical.hash||await witness.getCode(address,canonical.number)!==deployedCode)throw Error('Independent RPC disagrees with escrow runtime.');
 const {verifyEtherscan}=require('./verify-etherscan.cjs');
 const verified=await verifyEtherscan({chainId,address,artifact,buildInfo,constructorArguments:[manager],apiKey:process.env.ETHERSCAN_API_KEY||''});
 if(verified!==true)throw Error('Explorer verification did not confirm success. Preserve journal; use REVIEW_ESCROW_ADDRESS for recovery.');
 journal.status='verified';journal.runtimeCodeHash=ethers.keccak256(deployedCode);journal.verification='verified';checkpoint();witness.destroy();
 console.log(JSON.stringify({address,codeHash:journal.runtimeCodeHash,journal:file,status:'Verified deployment; separate commissioning still required.'},null,2));
}
module.exports={main,settings};
