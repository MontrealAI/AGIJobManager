import { toQuantity } from 'ethers';
import { validateBlock, checkFreshness } from '../ops/settlement-status.mjs';
const ensure=(v,m)=>{if(!v)throw Error(m);};
export async function canonicalRead({primary,secondary,chainId,confirmations=0,collect}) {
  ensure(primary&&secondary&&primary!==secondary,'TWO_RPC_CLIENTS_REQUIRED');
  ensure(Number.isSafeInteger(confirmations)&&confirmations>=0&&confirmations<=256,'CONFIRMATION_DEPTH');
  const clients=[primary,secondary],now=Math.floor(Date.now()/1000);
  const heads=await Promise.all(clients.map(async p=>validateBlock(await p.send('eth_getBlockByNumber',['latest',false]))));
  heads.forEach(h=>checkFreshness(h,120,now));
  ensure(Math.abs(heads[0].number-heads[1].number)<=2,'RPC_HEAD_SKEW');
  const height=Math.min(...heads.map(h=>h.number))-confirmations;
  ensure(height>=0,'INSUFFICIENT_HISTORY');const tag=toQuantity(height);
  const results=await Promise.all(clients.map(async p=>{
    ensure(BigInt(await p.send('eth_chainId',[]))===BigInt(chainId),'RPC_CHAIN');
    const block=validateBlock(await p.send('eth_getBlockByNumber',[tag,false]));
    ensure(block.number===height,'RPC_BLOCK_NUMBER');checkFreshness(block,120+confirmations*30,now);
    return {block,data:await collect(p,{blockHash:block.hash,requireCanonical:true},block)};
  }));
  ensure(JSON.stringify(results[0])===JSON.stringify(results[1]),'RPC_STATE_DISAGREEMENT');
  for(const p of clients) {
    ensure(BigInt(await p.send('eth_chainId',[]))===BigInt(chainId),'RPC_CHAIN_CHANGED');
    const h=validateBlock(await p.send('eth_getBlockByNumber',['latest',false]));checkFreshness(h,120,Math.floor(Date.now()/1000));
    ensure(h.number>=height+confirmations&&h.number-height<=confirmations+2,'SNAPSHOT_AGED');
    ensure((await p.send('eth_getBlockByNumber',[tag,false]))?.hash===results[0].block.hash,'RPC_REORG');
  }
  return {...results[0].data,block:results[0].block};
}
