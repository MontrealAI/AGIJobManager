'use strict';
const {ensure} = require('./io.cjs');
const {Q,H,A} = require('./transport.cjs');
async function inventory({E, rpc, reader, wallet, wrapper, snapshot, startBlock, rangeSize=5000, logCap=1000}) {
  ensure(Number.isSafeInteger(startBlock) && startBlock >= 0 && startBlock <= snapshot.number, 'APPROVAL_START_BLOCK_REQUIRED');
  ensure(Number.isSafeInteger(rangeSize) && rangeSize>0 && rangeSize<=5000 && Number.isSafeInteger(logCap) && logCap>0, 'APPROVAL_RANGE_INVALID');
  const event = E.id('ApprovalForAll(address,address,bool)'), ownerTopic = E.zeroPadValue(wallet,32).toLowerCase();
  const report = {status:'IN_PROGRESS', wallet, wrapper, startBlock, endBlock:snapshot.number,
    snapshotHash:snapshot.hash, filter:{address:wrapper,topics:[event,ownerTopic]}, ranges:[], operators:[],
    completeness:'Provider-returned logs only; silent omission cannot be excluded by range pagination. Independent corroboration and operator-control review remain separate.',
    completeHistory:false, reviewedControl:false, failures:[]};
  const entries=[], seen=new Set(), blocks=new Map(); let ranges=0;
  async function collect(from,to) {
    ensure(++ranges<=10000, 'APPROVAL_RANGE_LIMIT');
    const logs = await rpc('eth_getLogs',[{...report.filter,fromBlock:E.toQuantity(from),toBlock:E.toQuantity(to)}]);
    ensure(Array.isArray(logs) && logs.length<=10000, 'APPROVAL_LOG_RESPONSE_INVALID');
    if(logs.length>=logCap) {
      ensure(from<to,'APPROVAL_POSSIBLE_TRUNCATION');
      const mid=Math.floor((from+to)/2); await collect(from,mid); await collect(mid+1,to); return;
    }
    report.ranges.push({from,to,count:logs.length,status:'PASS'});
    for(const l of logs) {
      ensure(l && l.removed===false && l.address?.toLowerCase()===wrapper.toLowerCase() &&
        Array.isArray(l.topics) && l.topics.length===3 && l.topics[0]?.toLowerCase()===event.toLowerCase() && l.topics[1]?.toLowerCase()===ownerTopic &&
        H(l.topics[2]) && /^0x0{24}/.test(l.topics[2]) && H(l.blockHash) && H(l.transactionHash) &&
        Q(l.blockNumber) && Q(l.transactionIndex) && Q(l.logIndex) && /^0x0{63}[01]$/.test(l.data), 'APPROVAL_LOG_MALFORMED');
      const n=Number(BigInt(l.blockNumber)); ensure(Number.isSafeInteger(n) && n>=from && n<=to,'APPROVAL_LOG_OUT_OF_RANGE');
      const key=l.blockHash+':'+l.logIndex; ensure(!seen.has(key),'APPROVAL_LOG_DUPLICATED'); seen.add(key);
      const prior=blocks.get(n); ensure(!prior || prior===l.blockHash.toLowerCase(),'APPROVAL_LOG_BLOCK_CONFLICT'); blocks.set(n,l.blockHash.toLowerCase());
      entries.push({blockNumber:n,blockHash:l.blockHash.toLowerCase(),transactionIndex:BigInt(l.transactionIndex),logIndex:BigInt(l.logIndex),
        transactionHash:l.transactionHash,operator:E.getAddress('0x'+l.topics[2].slice(-40)),approved:l.data.endsWith('1')});
    }
  }
  try {
    for(let n=startBlock;n<=snapshot.number;n+=rangeSize) await collect(n,Math.min(snapshot.number,n+rangeSize-1));
    entries.sort((a,b)=>a.blockNumber-b.blockNumber || (a.transactionIndex<b.transactionIndex?-1:a.transactionIndex>b.transactionIndex?1:0) || (a.logIndex<b.logIndex?-1:a.logIndex>b.logIndex?1:0));
    for(const [number,hash] of blocks) { const b=await rpc('eth_getBlockByNumber',[E.toQuantity(number),false]); ensure(b?.hash?.toLowerCase()===hash,'APPROVAL_LOG_REORG'); }
    const last=new Map(); for(const e of entries) last.set(e.operator,e);
    const contract=reader.contract(wrapper,['function isApprovedForAll(address,address) view returns (bool)']);
    for(const [operator,entry] of last) {
      ensure(A(operator),'APPROVAL_OPERATOR_INVALID');
      const active=await contract.isApprovedForAll(wallet,operator);
      ensure(active===entry.approved,'APPROVAL_ACTIVE_STATE_CONFLICT');
      report.operators.push({operator,active,lastEvent:entry,runtimeCodeHash:E.keccak256(await reader.getCode(operator)),controlReview:'NEEDS_OPERATOR_INPUT'});
    }
    report.status='PASS'; report.eventCount=entries.length; report.coverageContiguous=true;
    report.completeHistory=startBlock===0 ? 'PROVIDER_ASSERTED_FROM_GENESIS_ONLY' : false;
    return report;
  } catch(error) { report.status='FAIL'; report.failures.push(error?.code || 'APPROVAL_READ_FAILED'); error.inventory=report; throw error; }
}
module.exports={inventory};
