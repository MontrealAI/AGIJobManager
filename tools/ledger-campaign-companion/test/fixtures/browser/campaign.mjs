// This adapter exists only under browser test fixtures. It never signs, broadcasts, or contacts RPC.
import { Transaction, SigningKey, computeAddress, keccak256 } from 'ethers';
import { policyDigest } from '../../../src/envelope.mjs';
import { createCampaignEngine } from '../../../bridge/campaign-engine.mjs';
import { createBridgeServer } from '../../../bridge/http-server.mjs';
import { BridgeError } from '../../../bridge/errors.mjs';
const source = { repository: 'SYNTHETIC_BROWSER_FIXTURE_ONLY', commit: '1'.repeat(40), tree: '2'.repeat(40) };
const creator = computeAddress(new SigningKey(`0x${'19'.repeat(32)}`).publicKey);
const governor = computeAddress(new SigningKey(`0x${'20'.repeat(32)}`).publicKey);
const copy = value => JSON.parse(JSON.stringify(value));
export async function createBrowserCampaignFixture({ staticRoot, privateDirectory, count = 2, expiry = Date.now()+3600000, mode = 'normal', expireOnImport = false, relayEnabled = false, packetSchema = 'manager-external-signing-handoff-v1' }) {
  const sourceSha256 = `0x${'42'.repeat(32)}`;
  const pinned = Array.from({length:count},(_,index) => {
    const unsignedHex = Transaction.from({type:2,chainId:1,nonce:index+1,to:null,data:'0x60006000f3',value:0,gasLimit:500000,maxFeePerGas:10000000000n,maxPriorityFeePerGas:1000000000n,accessList:[]}).unsignedSerialized;
    const review = {chainId:'1',expectedSender:creator,expiresAt:new Date(expiry).toISOString(),maxGasLimit:'16777216',maxFeePerGas:'20000000000',maxPriorityFeePerGas:'2000000000',maxTotalFeeWei:'1000000000000000000',maxValueWei:'0',operationId:`synthetic-campaign-${index}`,sourceSha256};
    return {operationId:review.operationId,unsignedHex,expectedUnsignedHash:keccak256(unsignedHex),expectedPolicyHash:policyDigest(review,keccak256(unsignedHex)),review};
  });
  const campaign = {
    format:'manual-ledger-campaign-v1',campaignId:'synthetic-browser-campaign',adapter:'browser-test-only',packetSchema,expiresAt:new Date(expiry).toISOString(),
    reviewedManifest:{source,sourceSha256,planSha256:'3'.repeat(64),operations:pinned},coordinator:{buildId:'SYNTHETIC_ONLY'},network:{chainId:'1',name:'Ethereum Mainnet envelope — synthetic browser fixture only'},route:{name:'USDC route',token:'SYNTHETIC_NO_TOKEN_CONTRACT',symbol:'USDC',decimals:6},
    actors:{creator,governor,feeRecipients:[],treasuries:[]},qualification:Object.fromEntries(['source','browser','coordinator','physical','provider','configuration','explorer','authority'].map(key=>[key,'NOT_QUALIFIED_SYNTHETIC_FIXTURE'])),maxTotalFeeWei:'1000000000000000000',
    operations:pinned.map((_packet,index)=>({index,purpose:`Synthetic CREATE ${index+1} / Création synthétique ${index+1}`,account:'creator',destination:'CREATE',dependsOn:index?[index-1]:[],decodedArguments:{syntheticOnly:true},expectedPostState:{syntheticOnly:true,activationReady:false}}))
  };
  if(relayEnabled)campaign.relayPolicy={enabled:true,acknowledgementMode:'EXACT_COORDINATOR_PER_STEP'};
  const counters={prepare:0,import:0,observe:0,relay:0},state={hashes:new Map(),verified:false,drift:false,mode};
  const adapter=Object.freeze({id:'browser-test-only',supported:{repository:source.repository,commit:source.commit,packetSchema:campaign.packetSchema},
    async inspectCampaign(){if(state.drift)throw new BridgeError('SOURCE_DRIFT');return {candidateQualification:'SYNTHETIC_ADAPTER_REAL_BRIDGE_ENGINE'};},
    async prepare({step}){counters.prepare++;if(state.drift)throw new BridgeError('SOURCE_DRIFT');const packet=pinned[step];return {operationId:packet.operationId,prepared:copy(Object.fromEntries(['unsignedHex','expectedUnsignedHash','expectedPolicyHash','review'].map(key=>[key,packet[key]])))};},
    async importSigned({step,raw}){counters.import++;const transactionHash=Transaction.from(raw).hash;state.hashes.set(step,transactionHash);if(state.mode==='native-import-ack-lost')throw new BridgeError('SYNTHETIC_NATIVE_ACK_LOST');return {transactionHash,state:'signed',acknowledgement:'SYNTHETIC_EXACT_COORDINATOR_ACK_ONLY'};},
    async observe({step}){counters.observe++;const transactionHash=state.hashes.get(step);if(state.mode==='changed-receipt'&&transactionHash)return {state:'verified',verified:true,finalized:true,transactionHash:`0x${'55'.repeat(32)}`};return transactionHash?{state:state.verified?'verified':'signed',verified:state.verified,finalized:state.verified,transactionHash,operationId:pinned[step].operationId,relayAlreadyAttempted:counters.relay>0,...(state.mode==='native-import-ack-lost'?{acknowledgement:'SYNTHETIC_EXACT_COORDINATOR_ACK_ONLY'}:{})}:{state:'recovery-required',blocker:'NO_CANONICAL_RECEIPT'};},
    async relayOne({step,acknowledgement}){counters.relay++;if(!relayEnabled||acknowledgement!=='SYNTHETIC_EXACT_COORDINATOR_ACK_ONLY')throw new BridgeError('TEST_FIXTURE_NEVER_RELAYS');if(state.mode==='native-relay-response-lost')throw new BridgeError('SYNTHETIC_NATIVE_RELAY_RESPONSE_LOST');return {transactionHash:state.hashes.get(step),state:'submitted'};}
  });
  let engine=await createCampaignEngine({campaign,adapter,privateDirectory,relayEnabled,now:()=>state.now??Date.now()});
  const facade=Object.freeze(Object.fromEntries(['status','prepare','importSigned','observe','relayOne','report'].map(name=>[name,async(...args)=>{if(name==='importSigned'&&expireOnImport)state.now=Date.parse(args[0].capability.signedAt);const result=await engine[name](...args);if(name==='importSigned'&&state.mode==='lost-import-response')throw new BridgeError('SYNTHETIC_RESPONSE_LOST');if(name==='relayOne'&&state.mode==='lost-relay-response')throw new BridgeError('SYNTHETIC_RELAY_RESPONSE_LOST');return result;}])));
  let server=await createBridgeServer({engine:facade,staticRoot});
  return {get server(){return server;},get engine(){return engine;},campaign,counters,state,async restart(){await server.close();await engine.close();engine=await createCampaignEngine({campaign,adapter,privateDirectory,relayEnabled,now:()=>state.now??Date.now()});server=await createBridgeServer({engine:facade,staticRoot});return {server,engine};},close:async()=>{await server.close();await engine.close();}};
}
