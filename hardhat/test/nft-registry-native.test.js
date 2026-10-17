import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import runtime from '../scripts/runtime.cjs';
import deployment from '../scripts/deploy.cjs';
import safety from '../scripts/deployment-safety.cjs';
import registry from '../scripts/nft-registry-snapshot.cjs';
import canonical from '../scripts/canonical-state.cjs';
const require=createRequire(import.meta.url);
const {ethers,artifacts,network,run}=await runtime.getRuntime();
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
  const block=await ethers.provider.getBlock(calls.blockTag),pinned=canonical.createCanonicalReader(ethers.provider,block);
  network.provider.request=async request=>{assert(allowed.has(request.method),`Snapshot attempted forbidden RPC ${request.method}`);if(['eth_call','eth_getCode','eth_getStorageAt'].includes(request.method))assert.deepEqual(request.params.at(-1),pinned.at);return original(request);};
  const reader=pinned.contract(await manager.getAddress(),artifact.abi);
  const view={getAddress:()=>reader.getAddress(),MAX_AGI_TYPES:at=>reader.MAX_AGI_TYPES(at),agentNftRequired:at=>reader.agentNftRequired(at),agiTypes:async(i,at)=>{indices.push(i);return reader.agiTypes(i,at);}};
  try {return {snapshot:await registry.readRegistrySnapshot({manager:view,provider:pinned,buildInfo,artifact,calls:{blockTag:pinned.at}}),indices};}
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
 it('reconstructs all nine historical mainnet runtimes from preserved source and rejects the changed ENS runtime',async()=>{
  const input=structuredClone(buildInfo.input);
  // Reconstruct immutable historical deployments with their original optimizer profile.
  input.settings.optimizer={enabled:true,runs:40};
  const source=safety.resolveInputSource(buildInfo,'contracts/utils/ENSOwnership.sol');
  const preserved=fs.readFileSync(new URL('../../test/fixtures/ENSOwnership.pre-revocation.sol.txt',import.meta.url),'utf8');
  const review=JSON.parse(fs.readFileSync(new URL('../../config/next-deployment-contract-changes.json',import.meta.url),'utf8'));
  assert.equal(ethers.sha256(ethers.toUtf8Bytes(preserved)).slice(2),review.files['contracts/utils/ENSOwnership.sol'].beforeSha256);
  assert(input.sources[source],'Historical source must replace the exact compiler input unit');
  input.sources[source]={content:preserved};
  const output=JSON.parse(require('solc').compile(JSON.stringify(input)));
  assert.deepEqual((output.errors||[]).filter(item=>item.severity==='error'||item.severity==='warning'),[]);
  const historicalBuild={...buildInfo,input,output};
  for(const name of [...LIBRARIES,'AGIJobManager']){
   const current=await artifacts.readArtifact(FQNS[name]);
   const compiled=output.contracts[current.inputSourceName||current.sourceName][name];
   const a={...current,bytecode:'0x'+compiled.evm.bytecode.object,deployedBytecode:'0x'+compiled.evm.deployedBytecode.object,deployedLinkReferences:compiled.evm.deployedBytecode.linkReferences};
   const address=name==='AGIJobManager'?evidence.manager:evidence.libraries[FQNS[name]];
   let code=a.deployedBytecode.slice(2).toLowerCase();
   const replace=(start,length,value)=>{const hex=value.slice(2).toLowerCase().padStart(length*2,'0');assert.equal(hex.length,length*2);code=code.slice(0,start*2)+hex+code.slice((start+length)*2);};
   for(const [source,names] of Object.entries(a.deployedLinkReferences))for(const [lib,positions] of Object.entries(names)){
    const match=Object.entries(evidence.libraries).find(([fqn])=>{const split=fqn.lastIndexOf(':');return fqn.slice(split+1)===lib&&safety.resolveInputSource(buildInfo,fqn.slice(0,split))===source;});
    assert(match,`Missing ${source}:${lib}`);for(const pos of positions)replace(pos.start,pos.length,match[1]);
   }
   const target=output.contracts[a.inputSourceName||a.sourceName][name];
   const immutables=target.evm.deployedBytecode.immutableReferences||{};
   if(Object.keys(immutables).length){assert.equal(Object.keys(immutables).length,1);assert(name==='AGIJobManager'||Object.hasOwn(immutables,'library_deploy_address'));for(const pos of Object.values(immutables).flat())replace(pos.start,pos.length,name==='AGIJobManager'?evidence.usdcToken:address);}
   if(name!=='AGIJobManager'&&code.startsWith(`73${'00'.repeat(20)}3014`))replace(1,20,address);
   const linked='0x'+code;
   safety.requireArtifactMatch({artifact:a,buildInfo:historicalBuild,address,libraries:evidence.libraries,tokenAddress:evidence.usdcToken,code:linked});
   if(name==='ENSOwnership')assert.throws(()=>safety.requireArtifactMatch({artifact:current,buildInfo,address,libraries:evidence.libraries,tokenAddress:evidence.usdcToken,code:linked}),/differs/);
   assert.equal(ethers.keccak256(linked),evidence.runtimeCodeHashes[name],name);
  }
 });
 it('uses the real compiler, provider and empty public-array getter without an end-of-array probe',async()=>{
  const calls={blockTag:Number(await ethers.provider.send('eth_blockNumber',[]))};
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
 it('verification runtime honors the recovery hash and stops before explorer requests when it is unavailable',async()=>{
  const original=network.provider.request.bind(network.provider),requests=[];
  network.provider.request=async request=>{requests.push(request);assert.equal(request.method,'eth_getCode');return original(request);};
  try {
   await assert.rejects(run('verify:verify',{contract:FQNS.AGIJobManager,address:await manager.getAddress(),
    blockReference:{number:0,hash:ethers.ZeroHash}}),/CANONICAL_STATE_READ_BLOCKED.*No block-number fallback/);
   assert.equal(requests.length,1);
   assert.deepEqual(requests[0].params.at(-1),{blockHash:ethers.ZeroHash,requireCanonical:true});
  } finally {network.provider.request=original;}
 });
});
