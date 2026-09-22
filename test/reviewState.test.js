const assert=require('node:assert/strict'),{Interface,keccak256}=require('ethers');
let readReviewState,iface;
const addr=n=>'0x'+n.toString(16).padStart(40,'0'),token='0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',hash='0x'+'a'.repeat(64),code='0x0102';
function rpc(edit={}){return {async send(method,args){
 if(method==='eth_chainId')return '0x1';
 if(method==='eth_getBlockByNumber')return {number:args[0]==='latest'?'0x100':args[0],hash,timestamp:'0x'+(Math.floor(Date.now()/1000)-(args[0]==='latest'?0:edit.age??0)).toString(16)};
 if(method==='eth_getCode'){assert.deepEqual(args[1],{blockHash:hash,requireCanonical:true});return edit.code??code;}
 if(method==='eth_call'){
  assert.deepEqual(args[1],{blockHash:hash,requireCanonical:true});if(edit.unsupported)throw Error('Unsupported canonical read');
  const ti=new Interface(['function balanceOf(address) view returns(uint256)']);if(args[0].to.toLowerCase()===token.toLowerCase())return ti.encodeFunctionResult('balanceOf',[edit.balance??8000000n]);
  const q=iface.parseTransaction({data:args[0].data}),values={manager:[edit.manager??addr(9)],usdcToken:[edit.token??token],assignmentId:['0x'+'b'.repeat(64)],assignments:[addr(1),addr(3),0,'0x'+'c'.repeat(64),8000000,Math.floor(Date.now()/1000)+3600,2],credits:[edit.credit??8000000n],totalLiability:[8000000n]};return iface.encodeFunctionResult(q.name,values[q.name]);
 }throw Error(method);
}};}
describe('Canonical funded-review observations',()=>{
 before(async()=>{const mod=await import('../scripts/economics/review-state.mjs');readReviewState=mod.readReviewState;iface=new Interface(mod.REVIEW_ABI);});
 const run=(a=rpc(),b=rpc(),patch={})=>readReviewState({primary:a,secondary:b,chainId:1,manager:addr(9),escrow:addr(8),codeHash:keccak256(code),reviewer:addr(3),jobId:'0',...patch});
 it('distinguishes earned credit from received cash and reports conserved liabilities',async()=>{const r=await run();assert.equal(r.state,2);assert.equal(r.creditUSDC,'8');assert.equal(r.liabilityUSDC,'8');assert.equal(r.feeUSDC,'8');});
 it('rejects wrong runtime, manager or non-native asset',async()=>{for(const edit of [{code:'0x03'},{manager:addr(7)},{token:addr(6)}])await assert.rejects(run(rpc(edit),rpc(edit)));});
 it('rejects insolvency and a credit larger than total liability',async()=>{for(const edit of [{balance:7999999n},{credit:8000001n}])await assert.rejects(run(rpc(edit),rpc(edit)),/INSOLVENT/);});
 it('fails closed on provider disagreement or unsupported canonical reads',async()=>{await assert.rejects(run(rpc(),rpc({credit:0n})),/DISAGREEMENT/);await assert.rejects(run(rpc({unsupported:true})),/Unsupported/);});
 it('reads a confirmed historical payment with fresh current heads',async()=>{const r=await run(rpc({age:768,credit:0n}),rpc({age:768,credit:0n}),{confirmations:64});assert.equal(r.block.number,192);assert.equal(r.creditUSDC,'0');});
});
