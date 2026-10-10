import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import runtime from '../scripts/runtime.cjs';
import deployment from '../scripts/deploy.cjs';
import safety from '../scripts/deployment-safety.cjs';
import registry from '../scripts/nft-registry-snapshot.cjs';
const require=createRequire(import.meta.url);
const {ethers,artifacts,network}=await runtime.getRuntime();
const {FQNS,LIBRARIES,qualifiedBuild}=deployment;
const evidence=JSON.parse(fs.readFileSync(new URL('../../docs/releases/v1.14.0/MAINNET_EVIDENCE.json',import.meta.url),'utf8'));
const word=n=>ethers.zeroPadValue(ethers.toBeHex(BigInt(n)),32);

describe('Native v1.14.0 verification and readiness compatibility',function(){
 this.timeout(600000);
 let buildInfo,artifact,manager,accounts;
 async function guardedSnapshot(calls) {
  const indices=[];
  const original=network.provider.request.bind(network.provider);
  const allowed=new Set(['eth_call','eth_getStorageAt','eth_getCode','eth_blockNumber','eth_chainId','eth_getBlockByNumber']);
  network.provider.request=async request=>{assert(allowed.has(request.method),`Snapshot attempted forbidden RPC ${request.method}`);return original(request);};
  const view={getAddress:()=>manager.getAddress(),MAX_AGI_TYPES:at=>manager.MAX_AGI_TYPES(at),agentNftRequired:at=>manager.agentNftRequired(at),agiTypes:async(i,at)=>{indices.push(i);return manager.agiTypes(i,at);}};
  try {return {snapshot:await registry.readRegistrySnapshot({manager:view,provider:ethers.provider,buildInfo,artifact,calls}),indices};}
  finally {network.provider.request=original;}
 }

 before(async()=>{
  assert.equal(Number((await ethers.provider.getNetwork()).chainId),31337,'Disposable local chain only');
  ({buildInfo}=await qualifiedBuild());artifact=await artifacts.readArtifact(FQNS.AGIJobManager);
  accounts=await ethers.getSigners();
  const token=await(await ethers.getContractFactory('MockERC20')).deploy();await token.waitForDeployment();
  const links={};for(const name of LIBRARIES){const lib=await(await ethers.getContractFactory(name,{libraries:links})).deploy();await lib.waitForDeployment();links[FQNS[name]]=await lib.getAddress();}
  manager=await(await ethers.getContractFactory('AGIJobManager',{libraries:links})).deploy(await token.getAddress(),'ipfs://',[ethers.ZeroAddress,ethers.ZeroAddress],Array(4).fill(ethers.ZeroHash),Array(2).fill(ethers.ZeroHash),[accounts[1].address,accounts[2].address]);
  await manager.waitForDeployment();
 });
 it('reconstructs all nine historical mainnet runtime hashes from the release build without a public RPC',async()=>{
  for(const name of [...LIBRARIES,'AGIJobManager']){
   const a=await artifacts.readArtifact(FQNS[name]);
   const address=name==='AGIJobManager'?evidence.manager:evidence.libraries[FQNS[name]];
   let code=a.deployedBytecode.slice(2).toLowerCase();
   const replace=(start,length,value)=>{const hex=value.slice(2).toLowerCase().padStart(length*2,'0');assert.equal(hex.length,length*2);code=code.slice(0,start*2)+hex+code.slice((start+length)*2);};
   for(const [source,names] of Object.entries(a.deployedLinkReferences))for(const [lib,positions] of Object.entries(names)){
    const match=Object.entries(evidence.libraries).find(([fqn])=>{const split=fqn.lastIndexOf(':');return fqn.slice(split+1)===lib&&safety.resolveInputSource(buildInfo,fqn.slice(0,split))===source;});
    assert(match,`Missing ${source}:${lib}`);for(const pos of positions)replace(pos.start,pos.length,match[1]);
   }
   const target=buildInfo.output.contracts[a.inputSourceName||a.sourceName][name];
   const immutables=target.evm.deployedBytecode.immutableReferences||{};
   if(Object.keys(immutables).length){assert.equal(Object.keys(immutables).length,1);assert(name==='AGIJobManager'||Object.hasOwn(immutables,'library_deploy_address'));for(const pos of Object.values(immutables).flat())replace(pos.start,pos.length,name==='AGIJobManager'?evidence.usdcToken:address);}
   if(name!=='AGIJobManager'&&code.startsWith(`73${'00'.repeat(20)}3014`))replace(1,20,address);
   const linked='0x'+code;
   safety.requireArtifactMatch({artifact:a,buildInfo,address,libraries:evidence.libraries,tokenAddress:evidence.usdcToken,code:linked});
   assert.equal(ethers.keccak256(linked),evidence.runtimeCodeHashes[name],name);
  }
 });
 it('uses the real compiler, provider and empty public-array getter without an end-of-array probe',async()=>{
  const calls={blockTag:await ethers.provider.getBlockNumber()};
  const {snapshot,indices}=await guardedSnapshot(calls);
  assert.deepEqual(indices,[]);
  assert.equal(snapshot.agiTypes.length,0);assert.equal(snapshot.agentNftRequired,false);
  assert.equal(snapshot.evidence.endOfArrayRevertAssumptions,false);assert.equal(snapshot.evidence.bytecodesReconstructedExactly,true);
  assert.equal(snapshot.evidence.slot,evidence.nftPolicy.enumeration.slot);
 });
 it('reads populated and disabled slots with real storage/getters on the disposable chain',async()=>{
  // Direct storage setup is a local test fixture, not a production registry mutation.
  const layout=registry.deriveRegistryLayout(buildInfo,artifact,require('solc'));
  const address=await manager.getAddress(),data=BigInt(ethers.keccak256(word(layout.slot)));
  const set=async(slot,value)=>network.provider.request({method:'hardhat_setStorageAt',params:[address,ethers.toBeHex(BigInt(slot)),word(value)]});
  await set(layout.slot,2);await set(data,BigInt(accounts[1].address));await set(data+1n,1);
  await set(data+2n,BigInt(accounts[2].address));await set(data+3n,0);
  await network.provider.request({method:'evm_mine',params:[]});
  const {snapshot,indices}=await guardedSnapshot({blockTag:Number(await ethers.provider.send('eth_blockNumber',[]))});
  assert.deepEqual(indices,[0,1]);
  assert.deepEqual(snapshot.agiTypes.map(x=>x.payoutPercentage),['1','0']);
  assert.equal(snapshot.agiTypes[1].nftAddress.toLowerCase(),accounts[2].address.toLowerCase());
 });
});
