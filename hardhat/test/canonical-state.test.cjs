const test=require('node:test');
const assert=require('node:assert/strict');
const {Interface}=require('ethers');
const {createCanonicalReader}=require('../scripts/canonical-state.cjs');
const ADDRESS='0x'+'1'.repeat(40),BLOCK={number:44,hash:'0x'+'a'.repeat(64)};
const AT={blockHash:BLOCK.hash,requireCanonical:true};
const ABI=['function paused() view returns(bool)','function entry(uint256) view returns(address nftAddress,uint256 score)','function approve(address,uint256)'];
const iface=new Interface(ABI);
function fixture(reply){
 const requests=[];
 const reader=createCanonicalReader({send:async(method,params)=>{requests.push([method,params]);assert.deepEqual(params.at(-1),AT);return reply(method,params);}},BLOCK);
 return {reader,requests,contract:reader.contract(ADDRESS,ABI)};
}
test('contract, code and storage reads always carry a canonical hash and preserve named ABI results',async()=>{
 const f=fixture((method,params)=>method==='eth_getCode'?'0x6000':method==='eth_getStorageAt'?'0x'+'0'.repeat(64):iface.encodeFunctionResult(iface.parseTransaction(params[0]).name,iface.parseTransaction(params[0]).name==='paused'?[false]:[ADDRESS,7]));
 assert.equal(await f.contract.paused({blockTag:AT}),false);
 const entry=await f.contract.entry(0,{blockTag:AT});assert.equal(entry.nftAddress,ADDRESS);assert.equal(entry.score,7n);
 assert.equal(await f.reader.getCode(ADDRESS,AT),'0x6000');assert.equal(await f.reader.getStorage(ADDRESS,77n,AT),'0x'+'0'.repeat(64));
 assert.equal(f.requests[3][1][1],'0x4d');
 assert.equal(f.requests[0][1][0].from,'0x'+'0'.repeat(40));
 assert.equal(f.contract.approve,undefined);assert.equal(f.reader.send,undefined);assert.equal(f.reader.sendTransaction,undefined);
});
test('a backend serving another fork cannot substitute numeric state into the selected hash',async()=>{
 const f=fixture((method,params)=>iface.encodeFunctionResult('paused',[typeof params.at(-1)==='string']));
 assert.equal(await f.contract.paused(),false);
 assert.equal(f.requests.length,1);
});
for(const rejected of ['eth_call','eth_getCode','eth_getStorageAt'])test(`unsupported/noncanonical ${rejected} fails without another RPC or fallback`,async()=>{
 const f=fixture(()=>{throw Error('unsupported EIP-1898, credential=https://secret');});
 const read=()=>rejected==='eth_call'?f.contract.paused():rejected==='eth_getCode'?f.reader.getCode(ADDRESS):f.reader.getStorage(ADDRESS,0);
 await assert.rejects(read(),e=>/CANONICAL_STATE_READ_BLOCKED.*No block-number fallback/.test(e.message)&&!e.message.includes('secret'));
 assert.equal(f.requests.length,1);
});
test('invalid or changed block references and transaction overrides fail before RPC',async()=>{
 for(const tag of [44,'latest',BLOCK.hash,{blockHash:BLOCK.hash,requireCanonical:false},{blockHash:BLOCK.hash,requireCanonical:true,blockNumber:'0x2c'},{blockHash:'0x'+'b'.repeat(64),requireCanonical:true}]){
  const f=fixture(()=>{throw Error('must not call');});
  await assert.rejects(f.contract.paused({blockTag:tag}),/Canonical|canonical|different/);
  await assert.rejects(f.reader.getCode(ADDRESS,tag),/Canonical|canonical|different/);assert.equal(f.requests.length,0);
 }
 const f=fixture(()=>{throw Error('must not call');});await assert.rejects(f.contract.paused({from:ADDRESS}),/Only a canonical/);assert.equal(f.requests.length,0);
});
test('malformed RPC data cannot masquerade as code or a full storage word',async()=>{
 for(const data of [null,'0x1','0xzz',{}]){const f=fixture(()=>data);await assert.rejects(f.reader.getCode(ADDRESS),/malformed/);}
 const f=fixture(()=>'0x');await assert.rejects(f.reader.getStorage(ADDRESS,0),/full word/);await assert.rejects(f.contract.paused());
});
