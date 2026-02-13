import { useQuery } from '@tanstack/react-query';
import { publicClient } from './publicClient';
import { CONTRACT_ADDRESS } from '../constants';
import { agiJobManagerAbi } from '@/abis/agiJobManager';

export function usePlatformSummary(){
  return useQuery({ queryKey:['platform'], queryFn: async()=>{
    const [owner, paused, settlementPaused, nextJobId, completionReviewPeriod, disputeReviewPeriod, voteQuorum, requiredValidatorApprovals, requiredValidatorDisapprovals, withdrawableAGI] = await Promise.all([
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'owner'}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'paused'}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'settlementPaused'}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'nextJobId'}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'completionReviewPeriod'}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'disputeReviewPeriod'}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'voteQuorum'}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'requiredValidatorApprovals'}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'requiredValidatorDisapprovals'}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'withdrawableAGI'})
    ]);
    return {owner,paused,settlementPaused,nextJobId,completionReviewPeriod,disputeReviewPeriod,voteQuorum,requiredValidatorApprovals,requiredValidatorDisapprovals,withdrawableAGI};
  }});
}

export function useJob(jobId: bigint){
  return useQuery({queryKey:['job',String(jobId)], queryFn:async()=>{
    const [core,val,spec,completion]= await Promise.all([
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'getJobCore',args:[jobId]}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'getJobValidation',args:[jobId]}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'getJobSpecURI',args:[jobId]}),
      publicClient.readContract({address:CONTRACT_ADDRESS,abi:agiJobManagerAbi,functionName:'getJobCompletionURI',args:[jobId]})
    ]);
    return {core,val,spec,completion};
  }});
}
