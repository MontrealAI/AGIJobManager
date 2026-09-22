import { Interface } from 'ethers';
import { canonicalRead } from './canonical-rpc.mjs';
import units from '../lib/usdc.js';
const {formatUSDC,parseUSDC,requireCanonicalUSDC}=units;
const ensure=(v,m)=>{if(!v)throw Error(m);};
export const FUNDING_ABI=[
 'function createJob(string,uint256,uint256,string)',
 'function usdcToken() view returns(address)',
 'function paused() view returns(bool)','function settlementPaused() view returns(bool)',
 'function pendingUSDC(address) view returns(uint256)',
 ...['maxJobPayout','jobDurationLimit','validationRewardPercentage','agentBondBps','agentBond','agentBondMax','validatorBondBps','validatorBondMin','validatorBondMax','validatorSlashBps'].map(n=>`function ${n}() view returns(uint256)`),
];
const iface=new Interface(FUNDING_ABI),tokenInterface=new Interface(['function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)']);
export async function readFundingState({primary,secondary,chainId,manager,wallet,offer}) {
 const price=BigInt(parseUSDC(offer.payoutUSDC)),duration=BigInt(offer.durationSeconds);
 ensure(price>0n&&duration>0n&&duration<2n**256n,'FUNDING_AMOUNT');
 return canonicalRead({primary,secondary,chainId,collect:async(p,at)=>{
   ensure(await p.send('eth_getCode',[manager,at])!=='0x','MANAGER_CODE_REQUIRED');
   async function call(name,args=[]) {return iface.decodeFunctionResult(name,await p.send('eth_call',[{to:manager,data:iface.encodeFunctionData(name,args)},at]))[0];}
   const token=await call('usdcToken');requireCanonicalUSDC(chainId,token);
   async function tc(name,args=[]) {return tokenInterface.decodeFunctionResult(name,await p.send('eth_call',[{to:token,data:tokenInterface.encodeFunctionData(name,args)},at]))[0];}
   ensure(await tc('decimals')===6n,'USDC_DECIMALS');
   const names=['maxJobPayout','jobDurationLimit','validationRewardPercentage','agentBondBps','agentBond','agentBondMax','validatorBondBps','validatorBondMin','validatorBondMax','validatorSlashBps'];
   const [max,limit,reward,abps,amin,amax,vbps,vmin,vmax,slash]=await Promise.all(names.map(n=>call(n)));
   ensure(price<=max&&duration<=limit,'FUNDING_LIMIT');
   let agent=price*abps/10000n;if(agent<amin)agent=amin;if(limit)agent+=agent*duration/limit;if(amax&&agent>amax)agent=amax;if(agent>price)agent=price;
   let reviewer=price*vbps/10000n;if(reviewer<vmin)reviewer=vmin;if(reviewer>vmax)reviewer=vmax;if(reviewer>price)reviewer=price;
   return {token:token.toLowerCase(),paused:await call('paused'),settlementPaused:await call('settlementPaused'),pendingUSDC:String(await call('pendingUSDC',[wallet])),balanceUSDC:formatUSDC(await tc('balanceOf',[wallet])),allowanceUSDC:formatUSDC(await tc('allowance',[wallet,manager])),terms:{jobCostUSDC:formatUSDC(price),agentBondUSDC:formatUSDC(agent),reviewerBondUSDC:formatUSDC(reviewer),rewardPercentage:Number(reward),slashBps:Number(slash)}};
 }});
}
export function fundingRequest(manager,offer) {return {to:manager,data:iface.encodeFunctionData('createJob',[offer.specURI,parseUSDC(offer.payoutUSDC),offer.durationSeconds,offer.details])};}
