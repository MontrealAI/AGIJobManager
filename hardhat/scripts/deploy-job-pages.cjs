'use strict';
// Optional metadata router only. Never attaches itself to a manager or opens intake.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const E = require('ethers');
const { createCanonicalReader } = require('./canonical-state.cjs');
const { requireCanonicalUSDC } = require('../../scripts/lib/usdc.js');
const { parseBooleanSetting, requireDeploymentNetwork, requireExplorerEnabled, requireArtifactMatch,
  requireConfirmedReceipt, requireRuntimeSize, prepareDeployment } = require('./deployment-safety.cjs');
const FQN = 'contracts/periphery/AGIJobPages.sol:AGIJobPages';
const SCHEMA = 'agi-job-pages-deployment-v1';
const HASH = /^0x[0-9a-fA-F]{64}$/;
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const encode = value => JSON.stringify(canonical(value));
function normalizeConfig(value) {
  const fields = ['schema','chainId','owner','manager','managerCodeHash','buildDigest','baseMetadataURI','externalUrlBase'];
  if (!value || Array.isArray(value) || Object.keys(value).sort().join() !== fields.sort().join() ||
      value.schema !== 'reviewed-job-pages-v1' || ![1,11155111].includes(value.chainId)) throw Error('Invalid reviewed router configuration schema or chain.');
  const result = { ...value };
  for (const key of ['owner','manager']) {
    if (!E.isAddress(value[key]) || value[key].toLowerCase() === E.ZeroAddress) throw Error(`Invalid router ${key}.`);
    result[key] = E.getAddress(value[key]);
  }
  if (!HASH.test(value.managerCodeHash || '')) throw Error('Expected manager runtime hash is required.');
  result.managerCodeHash = value.managerCodeHash.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(value.buildDigest || '')) throw Error('Explicit reviewed compiler-input buildDigest is required.');
  for (const key of ['baseMetadataURI','externalUrlBase']) {
    if (typeof value[key] !== 'string' || Buffer.byteLength(value[key]) > 2048 || /[\x00-\x1f\x7f]/.test(value[key])) throw Error(`Invalid router ${key}.`);
  }
  if (!value.baseMetadataURI) throw Error('A reviewed nonempty metadata base URI is required.');
  return result;
}
function settings(env) {
  const recover = parseBooleanSetting(env.ROUTER_REVERIFY, 'ROUTER_REVERIFY', false);
  const dryRun = parseBooleanSetting(env.DRY_RUN, 'DRY_RUN', true);
  if (!env.ROUTER_CONFIG) throw Error('ROUTER_CONFIG must name the explicitly reviewed JSON configuration.');
  const confirmations = Number(env.CONFIRMATIONS || 3);
  if (!Number.isSafeInteger(confirmations) || confirmations < 3 || confirmations > 128) throw Error('CONFIRMATIONS must be 3..128.');
  if ((!dryRun || recover) && !env.ROUTER_JOURNAL) throw Error('ROUTER_JOURNAL is required; preserve the original deployment journal.');
  if (recover && dryRun) throw Error('Keyless re-verification submits explorer source: explicitly set DRY_RUN=0; no signer is used.');
  if (recover && !env.ROUTER_REPORT) throw Error('ROUTER_REPORT must name a new exclusive recovery report.');
  if (!parseBooleanSetting(env.VERIFY, 'VERIFY', true)) throw Error('Router explorer verification cannot be disabled.');
  return { recover, dryRun, confirmations, configPath: env.ROUTER_CONFIG, journalPath: env.ROUTER_JOURNAL,
    reportPath: env.ROUTER_REPORT, confirmation: env.DEPLOY_CONFIRM_MAINNET };
}
function exclusive(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2)+'\n', { flag:'wx', mode:0o600 });
}
async function snapshot(provider, chainId) {
  if (Number(BigInt(await provider.send('eth_chainId', []))) !== chainId) throw Error('RPC chain identity differs from reviewed chain.');
  const raw = await provider.send('eth_getBlockByNumber', ['latest',false]);
  if (!raw || !HASH.test(raw.hash || '') || !/^0x[0-9a-f]+$/i.test(raw.number || '')) throw Error('Invalid canonical snapshot.');
  const block = { number:Number(BigInt(raw.number)), hash:raw.hash.toLowerCase() };
  if (!Number.isSafeInteger(block.number)) throw Error('Invalid canonical block number.');
  return block;
}
async function recheck(provider, chainId, block) {
  if (Number(BigInt(await provider.send('eth_chainId', []))) !== chainId) throw Error('RPC chain changed.');
  const same = await provider.send('eth_getBlockByNumber', [E.toQuantity(block.number),false]);
  if (!same || same.hash?.toLowerCase() !== block.hash || Number(BigInt(same.number)) !== block.number) throw Error('Canonical snapshot changed; no successful report established.');
}
async function checkManager(reader, config) {
  if (E.keccak256(await reader.getCode(config.manager)) !== config.managerCodeHash) throw Error('Reviewed manager runtime mismatch.');
  const manager = reader.contract(config.manager, ['function owner() view returns(address)','function pendingOwner() view returns(address)',
    'function paused() view returns(bool)','function usdcToken() view returns(address)','function ensJobPages() view returns(address)','function useEnsJobTokenURI() view returns(bool)']);
  const [owner,pending,paused,token,helper,enabled] = await Promise.all([manager.owner(),manager.pendingOwner(),manager.paused(),manager.usdcToken(),manager.ensJobPages(),manager.useEnsJobTokenURI()]);
  requireCanonicalUSDC(config.chainId, token);
  if (owner !== config.owner || pending !== E.ZeroAddress || paused !== true) throw Error('Manager owner must be accepted and match router owner, with intake paused.');
  return { owner,pendingOwner:pending,intakePaused:paused,ensJobPages:helper,useEnsJobTokenURI:enabled };
}
function qualifiedArtifact(artifact, buildInfo) {
  const expected = { version:'0.8.37',optimizer:{enabled:true,runs:40},evmVersion:'shanghai',viaIR:true,metadata:{bytecodeHash:'none'},debug:{revertStrings:'strip'} };
  const s = buildInfo?.input?.settings;
  if (!s || encode({version:buildInfo.solcVersion,optimizer:s.optimizer,evmVersion:s.evmVersion,viaIR:s.viaIR || false,metadata:s.metadata,debug:s.debug}) !== encode(expected)) throw Error('Router compiler profile differs from qualified source.');
  const source = FQN.split(':')[0], inputSource = artifact.inputSourceName || artifact.sourceName;
  if (artifact.sourceName !== source || ![source,'project/'+source].includes(inputSource) || typeof buildInfo.input.sources?.[inputSource]?.content !== 'string') throw Error('Router artifact source identity differs from the reviewed fully qualified target.');
  const compiled = buildInfo.output?.contracts?.[inputSource]?.AGIJobPages;
  if (artifact.contractName !== 'AGIJobPages' || !compiled || encode(artifact.abi) !== encode(compiled.abi) || artifact.bytecode !== '0x'+compiled.evm.bytecode.object || artifact.deployedBytecode !== '0x'+compiled.evm.deployedBytecode.object || Object.keys(artifact.linkReferences || {}).length) throw Error('Router artifact differs from intact compiler output.');
  requireRuntimeSize('AGIJobPages', artifact.deployedBytecode);
  return digest(encode({input:buildInfo.input,solcLongVersion:buildInfo.solcLongVersion}));
}
async function verifyInstance({hre,config,artifact,buildInfo,journal,creationData,confirmations}) {
  const p = hre.ethers.provider;
  const block = await snapshot(p, config.chainId), reader = createCanonicalReader(p, block);
  const managerState = await checkManager(reader, config);
  if (!E.isAddress(journal.address) || !HASH.test(journal.transactionHash || '')) throw Error('Journal lacks the broadcast address/transaction; reconcile before any retry.');
  const receipt = requireConfirmedReceipt(await p.getTransactionReceipt(journal.transactionHash), journal.transactionHash, journal.address);
  const mined = await p.send('eth_getBlockByNumber',[E.toQuantity(receipt.blockNumber),false]);
  if (block.number - receipt.blockNumber + 1 < confirmations || mined?.hash?.toLowerCase() !== receipt.blockHash.toLowerCase()) throw Error('Router deployment lacks canonical confirmations.');
  const tx = await p.getTransaction(journal.transactionHash);
  if (!tx || tx.hash?.toLowerCase() !== journal.transactionHash.toLowerCase() || tx.to !== null || E.getAddress(tx.from) !== config.owner ||
      tx.data?.toLowerCase() !== creationData.toLowerCase() || BigInt(tx.value) !== 0n || Number(tx.chainId) !== config.chainId ||
      E.getCreateAddress({from:tx.from,nonce:tx.nonce}).toLowerCase() !== journal.address.toLowerCase()) throw Error('Deployment transaction constructor, sender, chain or address differs.');
  const code = await reader.getCode(journal.address);
  requireArtifactMatch({artifact,buildInfo,address:journal.address,code});
  const router = reader.contract(journal.address,artifact.abi);
  const [owner,manager,base,external,suffix,image] = await Promise.all([router.owner(),router.jobManager(),router.baseMetadataURI(),router.externalUrlBase(),router.useJobIdJsonSuffix(),router.defaultImageURI()]);
  if (owner !== config.owner || manager !== E.ZeroAddress || base !== config.baseMetadataURI || external !== config.externalUrlBase || suffix !== true || image !== 'ipfs://Qmc13BByj8xKnpgQtwBereGJpEXtosLMLq6BCUjK3TtAd1') throw Error('Router is not in the reviewed unconfigured constructor state; reconcile owner/configuration before recovery.');
  requireExplorerEnabled(hre.config);
  const verified = await hre.run('verify:verify',{address:journal.address,contract:FQN,constructorArguments:[config.baseMetadataURI,config.externalUrlBase],blockReference:block});
  if (verified !== true) throw Error('Explorer did not establish explicit exact-source verification.');
  await recheck(p,config.chainId,block);
  return {status:'verified_unconfigured',verification:{status:'verified'},runtimeCodeHash:E.keccak256(code),snapshot:block,managerState,
    owner,jobManager:manager,attachmentAuthorized:false,intakeActivationAuthorized:false,blockchainTransactionsBroadcast:0};
}
async function execute({hre,config:rawConfig,options}) {
  const config = normalizeConfig(rawConfig), p = hre.ethers.provider;
  requireDeploymentNetwork(hre.network.name,config.chainId);
  const artifact = await hre.artifacts.readArtifact(FQN), buildInfo = await hre.artifacts.getBuildInfo(FQN);
  const buildDigest = qualifiedArtifact(artifact,buildInfo);
  if (config.buildDigest !== buildDigest) throw Error('Compiler input identity differs from the explicitly reviewed buildDigest.');
  const factory = new E.ContractFactory(artifact.abi,artifact.bytecode);
  const args = [config.baseMetadataURI,config.externalUrlBase];
  const creationData = (await factory.getDeployTransaction(...args)).data;
  const block = await snapshot(p,config.chainId), managerState = await checkManager(createCanonicalReader(p,block),config);
  await recheck(p,config.chainId,block);
  if (options.recover) {
    if (fs.existsSync(options.reportPath)) throw Error('Recovery report already exists; no overwrite allowed.');
    const journal = JSON.parse(fs.readFileSync(options.journalPath,'utf8'));
    if (journal.schema !== SCHEMA || encode(journal.config) !== encode(config) || journal.buildDigest !== buildDigest || journal.creationDataHash !== E.keccak256(creationData)) throw Error('Original journal/configuration/compiler binding differs.');
    const result = await verifyInstance({hre,config,artifact,buildInfo,journal,creationData,confirmations:options.confirmations});
    const report = {...journal,...result,recoveryOf:path.resolve(options.journalPath),priorJournalStatus:journal.status};
    delete report.error;
    exclusive(options.reportPath,report); return report;
  }
  const prepared = await prepareDeployment({provider:p,factory,args,from:config.owner,name:'AGIJobPages'});
  const plan = {schema:SCHEMA,config,buildDigest,creationDataHash:E.keccak256(creationData),managerState,snapshot:block,
    gasLimit:String(prepared.gasLimit),estimatedGas:String(prepared.estimatedGas),initcodeBytes:prepared.initcodeBytes,
    attachmentAuthorized:false,intakeActivationAuthorized:false};
  if (options.dryRun) return {...plan,status:'read_only_plan',blockchainTransactionsBroadcast:0};
  requireExplorerEnabled(hre.config);
  if (config.chainId === 1 && options.confirmation !== 'I_UNDERSTAND_MAINNET_DEPLOYMENT') throw Error('Explicit mainnet deployment confirmation is required.');
  if (fs.existsSync(options.journalPath) || fs.existsSync(options.journalPath+'.solc-input.json')) throw Error('Deployment journal/input already exists; use keyless recovery, never redeploy blindly.');
  const signers = await hre.ethers.getSigners();
  if (!signers[0] || E.getAddress(await signers[0].getAddress()) !== config.owner) throw Error('Deployment signer must be the explicitly reviewed router owner.');
  // Recheck immediately before reserving a journal and broadcasting.
  const latest = await snapshot(p,config.chainId); await checkManager(createCanonicalReader(p,latest),config); await recheck(p,config.chainId,latest);
  const journal = {...plan,status:'prepared',verification:{status:'pending'},blockchainTransactionsBroadcast:0};
  exclusive(options.journalPath,journal);
  const checkpoint = () => {
    const temp = options.journalPath+'.'+crypto.randomUUID()+'.tmp';
    exclusive(temp,journal); fs.renameSync(temp,options.journalPath);
  };
  try {
    exclusive(options.journalPath+'.solc-input.json',buildInfo.input);
    const router = await factory.connect(signers[0]).deploy(...args,{gasLimit:prepared.gasLimit});
    const tx = router.deploymentTransaction();
    journal.transactionHash = tx.hash; journal.address = E.getCreateAddress({from:config.owner,nonce:tx.nonce});
    journal.status = 'broadcast'; journal.blockchainTransactionsBroadcast = 1; checkpoint();
    const receipt = requireConfirmedReceipt(await tx.wait(options.confirmations),tx.hash,journal.address);
    journal.deploymentBlock = {number:receipt.blockNumber,hash:receipt.blockHash};journal.status='confirmed';checkpoint();
    const result = await verifyInstance({hre,config,artifact,buildInfo,journal,creationData,confirmations:options.confirmations});
    Object.assign(journal,result,{blockchainTransactionsBroadcast:1});checkpoint();return journal;
  } catch {
    journal.status='incomplete';journal.error='Deployment or verification incomplete. Preserve the journal and original compiler input; reconcile before keyless re-verification. No attachment was performed.';checkpoint();
    throw Error(journal.error);
  }
}
async function main(env=process.env) {
  const options=settings(env),config=JSON.parse(fs.readFileSync(options.configPath,'utf8'));
  const {getRuntime}=require('./runtime.cjs');
  const result=await execute({hre:await getRuntime(),config,options});
  console.log(JSON.stringify(result,null,2));
}
module.exports={normalizeConfig,settings,qualifiedArtifact,verifyInstance,execute,main,FQN,SCHEMA};
if(require.main===module)main().catch(()=>{console.error('Router operation failed; preserve existing journals. No successful deployment/verification is established.');process.exitCode=1;});
