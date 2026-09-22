const assert=require('node:assert/strict');
const {Interface}=require('ethers');
let readFundingState,readClosureState,abi;
const addr=n=>'0x'+n.toString(16).padStart(40,'0'),token='0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const hash='0x'+'a'.repeat(64),tx='0x'+'c'.repeat(64);
const events=new Interface(['event JobCancelled(uint256 indexed jobId)']);
function rpc(edit={}) {
 let blocks=0;
 return {async send(method,args){
  if(method==='eth_chainId')return '0x1';
  if(method==='eth_getBlockByNumber'){blocks++;return {number:args[0]==='latest'?'0x100':args[0],hash:edit.reorg&&blocks>3?'0x'+'b'.repeat(64):hash,timestamp:'0x'+(Math.floor(Date.now()/1000)-(edit.stale?1000:0)).toString(16)};}
  if(method==='eth_getCode'){assert.equal(args[1].requireCanonical,true);return '0x01';}
  if(method==='eth_getTransactionReceipt'){if(edit.missing)return null;const e=events.encodeEventLog(events.getEvent('JobCancelled'),[edit.wrongJob?2:0]);return {transactionHash:tx,blockHash:hash,blockNumber:edit.young?'0xff':'0x10',status:edit.failed?'0x0':'0x1',logs:[{address:edit.wrongManager?addr(12):addr(99),...e}]};}
  if(method==='eth_call'){
   assert.deepEqual(args[1],{blockHash:hash,requireCanonical:true});if(edit.unsupported)throw Error('unsupported EIP-1898');
   const ti=new Interface(['function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)']);
   if(args[0].to.toLowerCase()===token.toLowerCase()){const q=ti.parseTransaction({data:args[0].data});return ti.encodeFunctionResult(q.name,[q.name==='decimals'?(edit.decimals??6):q.name==='balanceOf'?5000000000n:0]);}
   const q=abi.parseTransaction({data:args[0].data});const values={usdcToken:edit.token??token,paused:false,settlementPaused:false,pendingUSDC:edit.pending??0,maxJobPayout:5000000000n,jobDurationLimit:1000,validationRewardPercentage:8,agentBondBps:500,agentBond:1000000,agentBondMax:1000000000,validatorBondBps:1500,validatorBondMin:10000000,validatorBondMax:1000000000,validatorSlashBps:edit.slash??8000};return abi.encodeFunctionResult(q.name,[values[q.name]]);
  }throw Error(method);
 }};
}
describe('Canonical pre-funding and cancellation observations',()=>{
 before(async()=>{const f=await import('../scripts/economics/funding-state.mjs'),c=await import('../scripts/economics/closure-state.mjs');readFundingState=f.readFundingState;readClosureState=c.readClosureState;abi=new Interface(f.FUNDING_ABI);});
 const run=(a=rpc(),b=rpc(),patch={})=>readFundingState({primary:a,secondary:b,chainId:1,manager:addr(99),wallet:addr(1),offer:{payoutUSDC:'1000',durationSeconds:'100'},...patch});
 const close=(a=rpc(),b=rpc(),patch={})=>readClosureState({primary:a,secondary:b,chainId:1,manager:addr(99),wallet:addr(1),jobId:'0',transactionHash:tx,...patch});
 it('quotes actual posting and bond terms before a job exists',async()=>{const s=await run();assert.equal(s.terms.agentBondUSDC,'55');assert.equal(s.terms.reviewerBondUSDC,'150');assert.equal(s.terms.rewardPercentage,8);assert.equal(s.balanceUSDC,'5000');});
 it('rejects inconsistent providers and unsupported canonical reads',async()=>{await assert.rejects(run(rpc(),rpc({slash:9000})),/DISAGREEMENT/);await assert.rejects(run(rpc({unsupported:true})),/unsupported/);});
 it('rejects stale, reorged, wrong-token and wrong-decimal observations',async()=>{for(const e of [{stale:true},{reorg:true},{token:addr(88)},{decimals:18}])await assert.rejects(run(rpc(e),rpc(e)));});
 it('refuses posting outside current contract duration and price limits',async()=>{for(const offer of [{payoutUSDC:'5001',durationSeconds:'100'},{payoutUSDC:'100',durationSeconds:'1001'}])await assert.rejects(run(rpc(),rpc(),{offer}),/FUNDING_LIMIT/);});
 it('proves cancellation of deleted job zero from its canonical confirmed event',async()=>{const s=await close();assert.equal(s.event,'JobCancelled');assert.equal(s.jobId,'0');assert.equal(s.pendingUSDC,'0');});
 it('rejects missing, failed, young, wrong-job and wrong-manager receipts',async()=>{for(const e of [{missing:true},{failed:true},{young:true},{wrongJob:true},{wrongManager:true}])await assert.rejects(close(rpc(e),rpc(e)));});
 it('retains unpaid claims explicitly instead of treating cancellation as payment',async()=>{const s=await close(rpc({pending:100}),rpc({pending:100}));assert.equal(s.pendingUSDC,'100');});
 it('rejects closure disagreement and insufficient confirmation depth',async()=>{await assert.rejects(close(rpc(),rpc({pending:1})),/DISAGREEMENT/);await assert.rejects(close(rpc(),rpc(),{confirmations:63}),/FINALITY/);});
});
