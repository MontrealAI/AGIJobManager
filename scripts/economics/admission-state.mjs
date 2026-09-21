// Read-only canonical economic observations for a runner. No signer or secrets.
import { Interface, ZeroAddress, toQuantity } from 'ethers';
import { validateBlock, checkFreshness } from '../ops/settlement-status.mjs';
import units from '../lib/usdc.js';
const { formatUSDC, requireCanonicalUSDC } = units;
export const ADMISSION_ABI = [
 'function getJobCore(uint256) view returns(address employer,address assignedAgent,uint256 payout,uint256 duration,uint256 assignedAt,bool completed,bool disputed,bool expired,uint8 agentPayoutPct)',
 'function getJobBonds(uint256) view returns(uint256 agentAmount,uint256 validatorAmount,bool validatorFixed,uint256 disputeAmount)',
 'function getJobSpecURI(uint256) view returns(string)',
 ...['usdcToken'].map(n=>`function ${n}() view returns(address)`),
 ...['agentBondBps','agentBond','agentBondMax','jobDurationLimit','validatorBondBps','validatorBondMin','validatorBondMax','validatorSlashBps'].map(n=>`function ${n}() view returns(uint256)`),
 'function pendingUSDC(address) view returns(uint256)',
];
const tokenABI = new Interface(['function decimals() view returns(uint8)']);
const iface = new Interface(ADMISSION_ABI);
const ensure = (v,m) => { if(!v) throw new Error(m); };
export async function readAdmissionState({primary, secondary, chainId, manager, wallet, jobId, confirmations=0, now=Math.floor(Date.now()/1000)}) {
 ensure(Number.isSafeInteger(confirmations)&&confirmations>=0&&confirmations<=128,'CONFIRMATION_DEPTH');
 ensure(primary && secondary && primary !== secondary, 'TWO_RPC_CLIENTS_REQUIRED');
 const heads = await Promise.all([primary,secondary].map(async p=>validateBlock(await p.send('eth_getBlockByNumber',['latest',false]))));
 heads.forEach(h=>checkFreshness(h,120,now)); ensure(Math.abs(heads[0].number-heads[1].number)<=2,'RPC_HEAD_SKEW');
 const blockNumber=Math.min(...heads.map(h=>h.number))-confirmations;ensure(blockNumber>=0,'INSUFFICIENT_HISTORY');const tag=toQuantity(blockNumber);
 async function collect(provider) {
  ensure(BigInt(await provider.send('eth_chainId',[]))===BigInt(chainId),'RPC_CHAIN');
  const b=validateBlock(await provider.send('eth_getBlockByNumber',[tag,false]));ensure(b.number===blockNumber,'RPC_BLOCK_NUMBER');checkFreshness(b,120+confirmations*30,now);
  const at={blockHash:b.hash,requireCanonical:true};
  ensure(await provider.send('eth_getCode',[manager,at])!=='0x','MANAGER_CODE_REQUIRED');
  async function call(name,args=[]) {const raw=await provider.send('eth_call',[{to:manager,data:iface.encodeFunctionData(name,args)},at]);const r=iface.decodeFunctionResult(name,raw);return r.length===1?r[0]:r;}
  const core=await call('getJobCore',[jobId]), bonds=await call('getJobBonds',[jobId]), specURI=await call('getJobSpecURI',[jobId]);
  const token=await call('usdcToken');requireCanonicalUSDC(chainId,token);
  ensure(tokenABI.decodeFunctionResult('decimals',await provider.send('eth_call',[{to:token,data:tokenABI.encodeFunctionData('decimals')},at]))[0]===6n,'USDC_DECIMALS');
  const names=['agentBondBps','agentBond','agentBondMax','jobDurationLimit','validatorBondBps','validatorBondMin','validatorBondMax','validatorSlashBps'];
  const [abps,amin,amax,limit,vbps,vmin,vmax,slash]=await Promise.all(names.map(n=>call(n)));
  let agentBond=bonds.agentAmount, reviewerBond=bonds.validatorAmount;
  if(core.assignedAgent===ZeroAddress) {agentBond=core.payout*abps/10000n;if(agentBond<amin)agentBond=amin;if(limit)agentBond+=agentBond*core.duration/limit;if(amax&&agentBond>amax)agentBond=amax;if(agentBond>core.payout)agentBond=core.payout;}
  if(!bonds.validatorFixed) {reviewerBond=core.payout*vbps/10000n;if(reviewerBond<vmin)reviewerBond=vmin;if(reviewerBond>vmax)reviewerBond=vmax;if(reviewerBond>core.payout)reviewerBond=core.payout;}
  const result={block:b,specURI,employer:core.employer.toLowerCase(),assignedAgent:core.assignedAgent.toLowerCase(),completed:core.completed,expired:core.expired,pendingUSDC:String(await call('pendingUSDC',[wallet])),terms:{jobCostUSDC:formatUSDC(core.payout),agentBondUSDC:formatUSDC(agentBond),reviewerBondUSDC:formatUSDC(reviewerBond),rewardPercentage:60-Number(core.agentPayoutPct),slashBps:Number(slash)}};
  ensure((await provider.send('eth_getBlockByNumber',[tag,false]))?.hash===b.hash,'RPC_REORG');
  ensure(BigInt(await provider.send('eth_chainId',[]))===BigInt(chainId),'RPC_CHAIN_CHANGED');return result;
 }
 const results=await Promise.all([collect(primary),collect(secondary)]);
 ensure(JSON.stringify(results[0])===JSON.stringify(results[1]),'RPC_STATE_DISAGREEMENT');
 // Recheck both after all reads, including a slower peer.
 for(const p of [primary,secondary]) {const h=validateBlock(await p.send('eth_getBlockByNumber',['latest',false]));checkFreshness(h,120,Math.floor(Date.now()/1000));ensure(h.number-blockNumber<=2+confirmations && h.number>=blockNumber,'SNAPSHOT_AGED');ensure((await p.send('eth_getBlockByNumber',[tag,false]))?.hash===results[0].block.hash,'RPC_REORG');}
 return results[0];
}
