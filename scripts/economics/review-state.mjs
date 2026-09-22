import { Interface, keccak256, getAddress } from 'ethers';
import { canonicalRead } from './canonical-rpc.mjs';
import units from '../lib/usdc.js';
export const REVIEW_ABI = [
 'function manager() view returns(address)', 'function usdcToken() view returns(address)',
 'function assignmentId(uint256,address) view returns(bytes32)',
 'function assignments(bytes32) view returns(address employer,address reviewer,uint256 jobId,bytes32 completionHash,uint256 fee,uint64 startBy,uint8 state)',
 'function credits(address) view returns(uint256)', 'function totalLiability() view returns(uint256)',
 'function fundReview(uint256,address,bytes32,uint256,uint64) returns(bytes32)',
 'function activateReview(bytes32)', 'function refundReview(bytes32)', 'function withdrawCredit(address)',
 'event ReviewFunded(bytes32 indexed id,uint256 indexed jobId,address indexed reviewer,address employer,bytes32 completionHash,uint256 fee,uint64 startBy)',
 'event ReviewActivated(bytes32 indexed id,address indexed reviewer,uint256 fee)',
 'event CreditWithdrawn(address indexed beneficiary,uint256 amount)',
];
const iface=new Interface(REVIEW_ABI),token=new Interface(['function balanceOf(address) view returns(uint256)']);
const ensure=(v,m)=>{if(!v)throw Error(m);};
export async function readReviewState({primary,secondary,chainId,manager,escrow,codeHash,reviewer,jobId,confirmations=0}) {
  ensure(/^0x[0-9a-f]{64}$/.test(codeHash),'REVIEW_CODE_PIN_REQUIRED');
  manager=getAddress(manager);escrow=getAddress(escrow);reviewer=getAddress(reviewer);
  return canonicalRead({primary,secondary,chainId,confirmations,collect:async(p,at)=>{
    const code=await p.send('eth_getCode',[escrow,at]);ensure(code!=='0x'&&keccak256(code)===codeHash,'REVIEW_CODE_CHANGED');
    const call=async(name,args=[])=>{const values=iface.decodeFunctionResult(name,await p.send('eth_call',[{to:escrow,data:iface.encodeFunctionData(name,args)},at]));return values.length===1?values[0]:values;};
    ensure(getAddress(await call('manager'))===manager,'REVIEW_MANAGER_CHANGED');
    const asset=getAddress(await call('usdcToken'));units.requireCanonicalUSDC(chainId,asset);
    const id=await call('assignmentId',[jobId,reviewer]),a=await call('assignments',[id]),credit=await call('credits',[reviewer]),liability=await call('totalLiability');
    const balance=token.decodeFunctionResult('balanceOf',await p.send('eth_call',[{to:asset,data:token.encodeFunctionData('balanceOf',[escrow])},at]))[0];
    ensure(balance>=liability&&liability>=credit,'REVIEW_ESCROW_INSOLVENT');
    return {id,escrow,manager,token:asset,codeHash,employer:a.employer.toLowerCase(),reviewer:a.reviewer.toLowerCase(),jobId:String(a.jobId),completionHash:a.completionHash,feeUSDC:units.formatUSDC(a.fee),startBy:Number(a.startBy),state:Number(a.state),creditUSDC:units.formatUSDC(credit),liabilityUSDC:units.formatUSDC(liability)};
  }});
}
