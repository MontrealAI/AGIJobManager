import assert from 'node:assert/strict';
import fs from 'node:fs';
import solc from 'solc';
import runtime from '../scripts/runtime.cjs';
import policy from '../compiler-optimizer.cjs';
import config from '../hardhat.config.js';
const {ethers}=await runtime.getRuntime();
const settings=config.solidity.profiles.production.settings;
function compileFixture(language,source,optimizer){
 const profile=language==='Yul'?{evmVersion:settings.evmVersion,optimizer}:{...settings,optimizer};
 const output=JSON.parse(solc.compile(JSON.stringify({language,sources:{'Regression.sol':{content:source}},settings:{...profile,outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
 assert.deepEqual((output.errors||[]).filter(item=>item.severity!=='info'),[],'Synthetic regression fixtures must compile without warnings');
 return output.contracts['Regression.sol'].Regression;
}
const cases=[
 ['reassigned_reference_memory_alias.sol', async c=>[await c.f.staticCall(0,0),await c.f.staticCall(0,1)],[67n,7n]],
 ['reassigned_reference_memory_alias_from_storage_minimal.sol',async c=>[await c.f.staticCall(0,0),await c.f.staticCall(0,1)],[67n,7n]],
 ['reassigned_reference_storage_alias.sol',async c=>{const a=await c.g.staticCall(0,2,0xaaaa,0xbbbb),b=await c.g.staticCall(0,3,0xaaaa,0xbbbb);await (await c.rmw(0,1)).wait();return [a,b,await c.a(1)];},[0xbbbbn,0xaaaan,501n]]
];
describe('SOL-2026-7 compiler workaround on disposable EVM',function(){
 this.timeout(240000);
 before(async()=>{assert.equal((await ethers.provider.getNetwork()).chainId,31337n,'Disposable local chain only');});
 it('pins exact compiler and removes only L/E including cleanup',()=>{assert(solc.version().startsWith('0.8.37+commit.f401782d.'));assert.equal(policy.OPTIMIZER_STEPS,policy.DEFAULT_STEPS.replace(/[LE]/g,'')+':'+policy.CLEANUP_STEPS);assert(!/[LE]/.test(policy.OPTIMIZER_STEPS));assert.equal(policy.CLEANUP_STEPS,'fDnTOcmuO');assert.equal(policy.DEFAULT_STEPS,'dfDvulfnTUtnIfxa[r]EscLMVcul[j]Trpeulxa[r]cLvifMCTUca[r]LSsTFOtfDnca[r]IulcscCTUtvifMx[scCTUt]TOntnfDIulvifMjmul[jul]VcTOculjmul');});
 for(const [name,observe,expected] of cases)it(name+' matches upstream semantic expectations with workaround',async()=>{
  const source=fs.readFileSync(new URL('./fixtures/SOL-2026-7/'+name,import.meta.url),'utf8');
  const signer=(await ethers.getSigners())[0],results={};
  for(const [label,optimizer] of [['default',{enabled:true,runs:40}],['workaround',policy.optimizer]]){
   const out=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'C.sol':{content:source}},settings:{optimizer,viaIR:true,evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
   assert.deepEqual((out.errors||[]).filter(e=>e.severity==='error'),[]);
   const c=out.contracts['C.sol'].C, deployed=await new ethers.ContractFactory(c.abi,'0x'+c.evm.bytecode.object,signer).deploy();await deployed.waitForDeployment();results[label]=await observe(deployed);
  }
  console.log(JSON.stringify({fixture:name,default:results.default.map(String),workaround:results.workaround.map(String),expected:expected.map(String)}));
  assert.deepEqual(results.workaround,expected);
  // Controls expose whether this exact fixture triggers the old compiler under this profile.
  assert.notDeepEqual(results.default,expected);
 });
 it('production optimizer preserves hashes over reassigned memory aliases',async()=>{
  const source=`// SPDX-License-Identifier: MIT
pragma solidity =0.8.37;
contract Regression {
 uint s0=0x400; uint s1; uint s2=0x300;
 function memoryHash() public view returns(bytes32 result){
  assembly {
   let v:=sload(0)
   let p:=add(v,0x100)
   mstore(p,67)
   v:=sload(2)
   mstore(add(v,0x200),7)
   result:=keccak256(p,32)
  }
 }
}`;
  assert.deepEqual(settings.optimizer,policy.optimizer);
  const signer=(await ethers.getSigners())[0],expected=ethers.keccak256(ethers.zeroPadValue('0x07',32));
  for(const optimizer of [policy.optimizer,{enabled:false}]){
   const compiled=compileFixture('Solidity',source,optimizer);
   const contract=await new ethers.ContractFactory(compiled.abi,'0x'+compiled.evm.bytecode.object,signer).deploy();await contract.waitForDeployment();
   assert.equal(await contract.memoryHash(),expected);
  }
 });
 it('corrects a raw Yul storage-alias stale read with a failing original-profile control at 40 runs',async()=>{
  const source=`object "Regression" { code {
   datacopy(0,dataoffset("runtime"),datasize("runtime")) return(0,datasize("runtime"))
  } object "runtime" { code {
   let i:=0
   if calldataload(0) { i:=1 }
   let i1:=add(i,0)
   let k:=add(i1,2)
   sstore(k,add(sload(k),calldataload(64)))
   if calldataload(32) { i:=add(i,2) }
   sstore(i,calldataload(96))
   mstore(0,sload(k))
   return(0,32)
  } } }`;
  const signer=(await ethers.getSigners())[0],data=ethers.AbiCoder.defaultAbiCoder().encode(['uint256','uint256','uint256','uint256'],[0,1,11,22]);
  for(const [steps,expected] of [[policy.DEFAULT_STEPS+':'+policy.CLEANUP_STEPS,11n],[policy.OPTIMIZER_STEPS,22n],[':',22n]]){
   const compiled=compileFixture('Yul',source,{enabled:true,runs:40,details:{yulDetails:{optimizerSteps:steps}}});
   const receipt=await(await signer.sendTransaction({data:'0x'+compiled.evm.bytecode.object})).wait();
   assert.equal(BigInt(await ethers.provider.call({to:receipt.contractAddress,data})),expected);
  }
 });
});

