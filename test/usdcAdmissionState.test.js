const assert=require('node:assert/strict');
const {Interface}=require('ethers');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
let readAdmissionState,abi;
const addr=n=>'0x'+n.toString(16).padStart(40,'0');
const token='0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
function rpc(edit={}) {
 let calls=0; const requests=[];
 return {requests,async send(method,args){requests.push([method,args]);if(method==='eth_chainId')return '0x1';if(method==='eth_getBlockByNumber'){calls++;return {number:args[0]==='latest'?'0x100':args[0],hash:'0x'+(edit.reorg&&calls>2?'b':'a').repeat(64),timestamp:'0x'+(Math.floor(Date.now()/1000)-(edit.stale?1000:0)).toString(16)};}if(method==='eth_getCode'){assert.equal(args[1].requireCanonical,true);return '0x01';}if(method==='eth_call'){assert.equal(args[1].requireCanonical,true);assert.match(args[1].blockHash,/^0x[a-f0-9]{64}$/);if(edit.unsupported)throw new Error('unsupported EIP-1898');const ti=new Interface(['function decimals() view returns(uint8)']);if(args[0].to.toLowerCase()===token.toLowerCase())return ti.encodeFunctionResult('decimals',[edit.decimals??6]);const q=abi.parseTransaction({data:args[0].data});const values={getJobCore:[addr(1),addr(0),1000000000n,100n,0n,false,false,false,52],getJobBonds:[0n,0n,false,0n],getJobSpecURI:['ipfs://fixture'],getJobCompletionURI:[edit.completion??'ipfs://delivery'],usdcToken:[edit.wrongToken?addr(88):token],agentBondBps:[500],agentBond:[1000000],agentBondMax:[1000000000],jobDurationLimit:[1000],validatorBondBps:[1500],validatorBondMin:[10000000],validatorBondMax:[1000000000],validatorSlashBps:[edit.slash??8000],pendingUSDC:[0]};return abi.encodeFunctionResult(q.name,values[q.name]);}throw new Error(method);}};
}
describe('Canonical admission observations',()=>{
 before(async()=>{const m=await import(pathToFileURL(path.resolve(__dirname,'../scripts/economics/admission-state.mjs')));readAdmissionState=m.readAdmissionState;abi=new Interface(m.ADMISSION_ABI);});
 const run=(a,b,extra={})=>readAdmissionState({primary:a,secondary:b,chainId:1,manager:addr(99),wallet:addr(2),jobId:'1',...extra});
 it('uses EIP-1898 for every state read and reproduces duration-adjusted bond quotes',async()=>{const a=rpc(),r=await run(a,rpc());assert.equal(r.terms.agentBondUSDC,'55');assert.equal(r.terms.reviewerBondUSDC,'150');assert.equal(r.terms.rewardPercentage,8);assert.equal(r.pendingUSDC,'0');assert.equal(r.completionURI,'ipfs://delivery');});
 it('rejects delivery substitution between RPC providers',async()=>{await assert.rejects(run(rpc(),rpc({completion:'ipfs://other'})),/DISAGREEMENT/);});
 it('rejects RPC disagreement rather than combining different states',async()=>{await assert.rejects(run(rpc(),rpc({slash:9000})),/DISAGREEMENT/);});
 it('rejects stale endpoints and canonical hash changes',async()=>{await assert.rejects(run(rpc(),rpc({stale:true})),/too old/);await assert.rejects(run(rpc({reorg:true}),rpc()),/REORG/);});
 it('never falls back to block numbers when canonical reads are unsupported',async()=>{await assert.rejects(run(rpc({unsupported:true}),rpc()),/unsupported/);});
 it('requires native USDC, six decimals and two clients',async()=>{await assert.rejects(run(rpc({wrongToken:true}),rpc()),/Circle USDC/);await assert.rejects(run(rpc({decimals:18}),rpc()),/DECIMALS/);const a=rpc();await assert.rejects(run(a,a),/TWO_RPC/);});
 it('supports bounded confirmation depth for releasing collateral reservations',async()=>{const r=await run(rpc(),rpc(),{confirmations:64});assert.equal(r.block.number,192);await assert.rejects(run(rpc(),rpc(),{confirmations:129}),/CONFIRMATION/);});
});
