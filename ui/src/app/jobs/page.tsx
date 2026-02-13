'use client';
import Link from 'next/link';
import { usePlatformSummary } from '@/lib/web3/queries';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { publicClient } from '@/lib/web3/publicClient';
import { agiJobManagerAbi } from '@/abis/agiJobManager';
import { CONTRACT_ADDRESS } from '@/lib/constants';
import { deriveStatus } from '@/lib/jobStatus';
import { fmtAddr, fmtToken } from '@/lib/format';

export default function Jobs(){
  const {data:p}=usePlatformSummary();
  const {data}=useQuery({enabled:!!p,queryKey:['jobs',String(p?.nextJobId)],queryFn:async()=>{
    const n = Number(p?.nextJobId || 0n);
    const contracts = Array.from({length:n},(_,i)=>({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'getJobCore' as const,args:[BigInt(i)]}));
    const vals = Array.from({length:n},(_,i)=>({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'getJobValidation' as const,args:[BigInt(i)]}));
    const [cores,validations]=await Promise.all([
      publicClient.multicall({contracts,allowFailure:true}),publicClient.multicall({contracts:vals,allowFailure:true})
    ]);
    return cores.map((c,i)=>({c,v:validations[i],i})).filter(x=>x.c.status==='success').map(x=>({id:x.i,core:x.c.result,val:x.v.status==='success'?x.v.result:[false,0n,0n,0n,0n] as const}));
  }});
  return <div className='container py-8'><Card><table className='w-full text-sm'><thead><tr><th>ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th></tr></thead><tbody>{data?.map((j:any)=>{const s=deriveStatus({assignedAgent:j.core[1],assignedAt:j.core[4],duration:j.core[3],completed:j.core[5],disputed:j.core[6],expired:j.core[7]},{completionRequested:j.val[0],completionRequestedAt:j.val[3],disputedAt:j.val[4]}); return <tr key={j.id} className='border-t border-border hover:bg-muted/30'><td><Link href={`/jobs/${j.id}`}>{j.id}</Link></td><td>{s.status}</td><td>{fmtToken(j.core[2])}</td><td>{fmtAddr(j.core[0])}</td><td>{fmtAddr(j.core[1])}</td></tr>})}</tbody></table></Card></div>;
}
