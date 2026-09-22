import { Interface,toQuantity } from 'ethers';
import {canonicalRead} from './canonical-rpc.mjs';
import units from '../lib/usdc.js';
const ensure=(v,m)=>{if(!v)throw Error(m);};
const iface=new Interface(['function usdcToken() view returns(address)','function pendingUSDC(address) view returns(uint256)','event JobCancelled(uint256 indexed jobId)','event JobCompleted(uint256 indexed jobId,address indexed agent,uint256 indexed reputationPoints)','event JobExpired(uint256 indexed jobId,address indexed employer,address agent,uint256 indexed payout)']);
const ti=new Interface(['function decimals() view returns(uint8)']);
export async function readClosureState({primary,secondary,chainId,manager,wallet,jobId,transactionHash,confirmations=64}) {
 ensure(confirmations>=64,'CLOSURE_FINALITY');ensure(/^0x[0-9a-fA-F]{64}$/.test(transactionHash),'CLOSURE_TRANSACTION');
 return canonicalRead({primary,secondary,chainId,confirmations,collect:async(p,at,block)=>{
   ensure(await p.send('eth_getCode',[manager,at])!=='0x','MANAGER_CODE_REQUIRED');
   async function call(n,a=[]) {return iface.decodeFunctionResult(n,await p.send('eth_call',[{to:manager,data:iface.encodeFunctionData(n,a)},at]))[0];}
   const token=await call('usdcToken');units.requireCanonicalUSDC(chainId,token);
   ensure(ti.decodeFunctionResult('decimals',await p.send('eth_call',[{to:token,data:ti.encodeFunctionData('decimals')},at]))[0]===6n,'USDC_DECIMALS');
   const r=await p.send('eth_getTransactionReceipt',[transactionHash]);
   ensure(r&&r.transactionHash.toLowerCase()===transactionHash.toLowerCase()&&BigInt(r.status)===1n,'CLOSURE_RECEIPT');
   const height=Number(BigInt(r.blockNumber));ensure(Number.isSafeInteger(height)&&height<=block.number,'CLOSURE_NOT_FINAL');
   const canonical=await p.send('eth_getBlockByNumber',[toQuantity(height),false]);ensure(canonical?.hash===r.blockHash,'CLOSURE_REORG');
   const events=r.logs.filter(l=>l.address.toLowerCase()===manager.toLowerCase()).map(l=>{try{return iface.parseLog(l);}catch{return null;}}).filter(e=>e&&String(e.args.jobId)===String(jobId));
   ensure(events.length===1,'CLOSURE_EVENT_REQUIRED');
   ensure((await p.send('eth_getBlockByNumber',[toQuantity(height),false]))?.hash===r.blockHash,'CLOSURE_REORG');
   return {jobId:String(jobId),transactionHash:r.transactionHash.toLowerCase(),event:events[0].name,receiptBlock:height,receiptHash:r.blockHash,pendingUSDC:String(await call('pendingUSDC',[wallet]))};
 }});
}
