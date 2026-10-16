const { getRuntime } = require('./runtime.cjs');
let hre, ethers, run, network;
const fs = require("fs");
const path = require("path");
const E = require('ethers');
const { durableWrite, requireCreatorProfile, reserveCreator, releaseCreator, planCreation, requireCreationTransaction, recoverCreation } = require('./creator-transaction.cjs');
const { createCanonicalReader } = require('./canonical-state.cjs');
const { qualifiedArtifact, snapshot, recheck, encode } = require('./deploy-job-pages.cjs');
const FQN = 'contracts/ens/ENSJobPages.sol:ENSJobPages';
const SCHEMA = 'ens-job-pages-deployment-v2';
const { COMPILER_SETTINGS, stableObject } = require('./deploy.cjs');



const MAINNET_ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const MAINNET_NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const MAINNET_PUBLIC_RESOLVER = "0xF29100983E058B709F3D539b0c765937B804AC15";
const DEFAULT_JOB_MANAGER = ""; // Explicit verified USDC manager required.
const { requireCanonicalUSDC } = require("../../scripts/lib/usdc");
const { parseBooleanSetting, requireExplorerEnabled, requireConfirmedReceipt, requireDeploymentNetwork, requireRuntimeSize, requireArtifactMatch, prepareDeployment } = require("./deployment-safety.cjs");
const MAINNET_SAFETY_PHRASE = "I_UNDERSTAND_MAINNET_DEPLOYMENT";

function env(k, d = "") {
  const v = process.env[k];
  return v === undefined || v === null || v === "" ? d : v;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function namehash(name) {
  if (!name || name.trim() === "") return "0x" + "00".repeat(32);
  return E.namehash(E.ensNormalize(name));
}

function deriveJobsRootName(chainId, managerAddress) {
  const { getAddress, ZeroAddress } = require('ethers');
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error('Invalid ENS namespace chain ID.');
  const manager = getAddress(managerAddress);
  if (manager === ZeroAddress) throw new Error('JOB_MANAGER must be nonzero.');
  return `usdc-${chainId}-${manager.slice(2).toLowerCase()}.alpha.jobs.agi.eth`;
}

async function resolveNamespacePlan({ chainId, jobManager, manager, ens, mode, rootNameInput, rootNodeInput, prefixInput }) {
  if (!['fresh', 'replacement'].includes(mode)) throw new Error('ENS_DEPLOYMENT_MODE must be fresh or replacement.');
  const [previousHelper, nextJobId] = await Promise.all([manager.ensJobPages(), manager.nextJobId()]);
  let jobsRootName = deriveJobsRootName(chainId, jobManager);
  let jobLabelPrefix = 'job-';
  if (mode === 'fresh') {
    if (previousHelper !== ethers.ZeroAddress || nextJobId !== 0n) {
      throw new Error('Fresh ENS setup requires no existing helper and no posted jobs. Preserve the existing namespace; use replacement mode only for the same manager with an active helper.');
    }
  } else {
    if (previousHelper === ethers.ZeroAddress) throw new Error('Replacement requires an existing helper on this same manager.');
    await requireCode(previousHelper, 'Existing ENS helper');
    const previous = new ethers.Contract(previousHelper, [
      'function jobManager() view returns (address)', 'function jobsRootName() view returns (string)',
      'function jobsRootNode() view returns (bytes32)', 'function jobLabelPrefix() view returns (string)',
      'function ens() view returns (address)',
    ], ethers.provider);
    const [boundManager, root, node, prefix, registry] = await Promise.all([
      previous.jobManager(), previous.jobsRootName(), previous.jobsRootNode(), previous.jobLabelPrefix(), previous.ens(),
    ]);
    if (boundManager.toLowerCase() !== jobManager.toLowerCase()) throw new Error('Existing ENS helper belongs to another manager.');
    if (registry.toLowerCase() !== (await ens.getAddress()).toLowerCase()) throw new Error('Replacement must preserve the existing ENS registry.');
    if (!root || ethers.ensNormalize(root) !== root || namehash(root) !== node) throw new Error('Existing ENS helper root name/node is inconsistent.');
    if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(prefix) || /[0-9]$/.test(prefix)) throw new Error('Existing ENS helper prefix is invalid.');
    jobsRootName = root;
    jobLabelPrefix = prefix;
  }
  if (rootNameInput && ethers.ensNormalize(rootNameInput) !== jobsRootName) {
    throw new Error(`JOBS_ROOT_NAME must match the ${mode} namespace: ${jobsRootName}. Historical namespaces must not be reused for another manager.`);
  }
  if (prefixInput && prefixInput !== jobLabelPrefix) throw new Error(`JOB_LABEL_PREFIX must be ${jobLabelPrefix} for this ${mode} plan.`);
  if (chainId === 1 && jobsRootName === 'alpha.jobs.agi.eth') throw new Error('The legacy alpha.jobs.agi.eth namespace is reserved for the existing manager.');
  const jobsRootNode = namehash(jobsRootName);
  if (rootNodeInput && rootNodeInput.toLowerCase() !== jobsRootNode.toLowerCase()) throw new Error(`JOBS_ROOT_NODE mismatch: expected ${jobsRootNode}.`);
  const [rootOwner, rootResolver] = await Promise.all([ens.owner(jobsRootNode), ens.resolver(jobsRootNode)]);
  if (mode === 'fresh' && (rootOwner !== ethers.ZeroAddress || rootResolver !== ethers.ZeroAddress)) {
    throw new Error('Fresh ENS namespace is already occupied or has resolver state. Reconcile its history and any prior deployment journal; do not overwrite or redeploy blindly.');
  }
  if (mode === 'replacement' && rootOwner === ethers.ZeroAddress) throw new Error('Existing ENS root has no owner. Recover the current setup before deploying a replacement.');
  return { mode, chainId, managerAddress: ethers.getAddress(jobManager), previousHelper, jobsRootName, jobsRootNode, jobLabelPrefix,
    rootOwner, rootResolver, exampleJobName: `${jobLabelPrefix}0.${jobsRootName}` };
}

async function requireCode(addr, label) {
  if (!ethers.isAddress(addr)) {
    throw new Error(`${label} must be a valid address. Received: ${String(addr)}`);
  }
  const code = await ethers.provider.getCode(addr);
  if (!code || code === "0x") {
    throw new Error(`${label} has no deployed bytecode at ${addr}`);
  }
}

function parseIntEnv(key, fallback, min = 0) {
  const raw = env(key, "");
  if (raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min) {
    throw new Error(`${key} must be an integer >= ${min}. Received: ${raw}`);
  }
  return parsed;
}

function governorPlan(journal) {
  const iface = new E.Interface(['function setJobManager(address)','function setJobLabelPrefix(string)','function lockConfiguration()']);
  const calls = [['setJobManager',[journal.jobManager]],['setJobLabelPrefix',[journal.namespace.jobLabelPrefix]],...(journal.lockConfig ? [['lockConfiguration',[]]] : [])];
  return {status:'requires_separate_governor_authorization',affectedContracts:[journal.address],historicalReferencesReadOnly:true,chainId:journal.chainId,from:journal.finalOwner,
    actions:calls.map(([method,args])=>({to:journal.address,value:'0',method,args,data:iface.encodeFunctionData(method,args)})),
    rootAuthorityAuthorized:false,managerAttachmentAuthorized:false,intakeActivationAuthorized:false};
}
async function readEnsCreationState({provider,journal,artifact,buildInfo,legacy=false}) {
  const block=await snapshot(provider,journal.chainId),reader=createCanonicalReader(provider,block);
  const code=await reader.getCode(journal.address);
  requireArtifactMatch({artifact,buildInfo,address:journal.address,code});
  const helper=reader.contract(journal.address,artifact.abi);
  const fields=['owner','jobManager','jobsRootName','jobsRootNode','jobLabelPrefix','ens','nameWrapper','publicResolver','useEnsJobTokenURI','configLocked'];
  const values=await Promise.all(fields.map(field=>helper[field]()));
  const state=Object.fromEntries(fields.map((field,index)=>[field,values[index]]));
  const manager=reader.contract(journal.jobManager,['function owner() view returns(address)','function pendingOwner() view returns(address)','function paused() view returns(bool)','function ensJobPages() view returns(address)','function usdcToken() view returns(address)']);
  const [owner,pendingOwner,paused,attachment,token]=await Promise.all([manager.owner(),manager.pendingOwner(),manager.paused(),manager.ensJobPages(),manager.usdcToken()]);
  requireCanonicalUSDC(journal.chainId,token);
  if (!legacy) {
    if (E.keccak256(await reader.getCode(journal.jobManager))!==journal.managerCodeHash) throw Error('Reviewed manager source/runtime binding changed.');
    if (owner!==journal.finalOwner || pendingOwner!==E.ZeroAddress || !paused || attachment!==journal.namespace.previousHelper) throw Error('Manager ownership, pause or helper attachment changed; reconciliation is required.');
    const [registry,wrapper,resolver,node,name,governor]=journal.constructorArgs;
    if (state.owner!==governor || state.jobManager!==E.ZeroAddress || state.jobsRootName!==name || state.jobsRootNode!==node ||
        state.jobLabelPrefix!=='agijob' || state.ens!==E.getAddress(registry) || state.nameWrapper!==E.getAddress(wrapper) ||
        state.publicResolver!==E.getAddress(resolver) || state.useEnsJobTokenURI!==false || state.configLocked!==false) throw Error('ENS helper differs from the governed unconfigured constructor state. Preserve the journal and reconcile any partial governor configuration without redeploying.');
    const ens=reader.contract(registry,['function owner(bytes32) view returns(address)','function resolver(bytes32) view returns(address)']);
    const [rootOwner,rootResolver]=await Promise.all([ens.owner(node),ens.resolver(node)]);
    if (rootOwner!==journal.namespace.rootOwner || rootResolver!==journal.namespace.rootResolver) throw Error('ENS root authority changed before separately authorized configuration.');
  }
  await recheck(provider,journal.chainId,block);
  return {snapshot:block,state,managerState:{owner,pendingOwner,paused,attachment},runtimeCodeHash:E.keccak256(code)};
}
async function verifyEnsCreation({hre,journal,artifact,buildInfo,confirmations,legacy=false,verifyLegacy}) {
  const p=hre.ethers.provider;
  const expectedTypes=legacy?['address','address','address','bytes32','string']:['address','address','address','bytes32','string','address'];
  const buildDigest=qualifiedArtifact(artifact,buildInfo,FQN,expectedTypes);
  if (!legacy && (journal.schema!==SCHEMA || journal.buildDigest!==buildDigest || journal.constructorSchema!=='ens-job-pages-constructor-v2' || journal.ownershipInitialization!=='explicit-constructor' || journal.constructorArgs[5]!==journal.finalOwner)) throw Error('ENS versioned constructor/source manifest differs.');
  const creationData=(await new E.ContractFactory(artifact.abi,artifact.bytecode).getDeployTransaction(...journal.constructorArgs)).data;
  if (!legacy && (journal.creationDataHash!==E.keccak256(creationData) || !journal.creationIntent || journal.creationIntent.creator!==journal.deployer || journal.creationIntent.chainId!==journal.chainId || journal.creationIntent.dataHash!==journal.creationDataHash)) throw Error('ENS creation intent differs from the reviewed manifest.');
  if (!journal.transactionHash) throw Error('No reconciled ENS creation transaction; recover the saved intent before continuing.');
  const receipt=requireConfirmedReceipt(await p.getTransactionReceipt(journal.transactionHash),journal.transactionHash,journal.address);
  const tx=await p.getTransaction(journal.transactionHash);
  if (!tx || tx.hash?.toLowerCase()!==journal.transactionHash.toLowerCase() || tx.to!==null || E.getAddress(tx.from)!==E.getAddress(journal.deployer) || Number(tx.chainId)!==journal.chainId || BigInt(tx.value)!==0n || tx.data.toLowerCase()!==creationData.toLowerCase() || E.getCreateAddress({from:tx.from,nonce:tx.nonce})!==E.getAddress(journal.address)) throw Error('ENS creation sender, chain, nonce, address or constructor differs.');
  if (!legacy) requireCreationTransaction(tx,journal.creationIntent);
  const initial=await readEnsCreationState({provider:p,journal,artifact,buildInfo,legacy});
  const mined=await p.send('eth_getBlockByNumber',[E.toQuantity(receipt.blockNumber),false]);
  if (initial.snapshot.number-receipt.blockNumber+1<confirmations || mined?.hash?.toLowerCase()!==receipt.blockHash.toLowerCase()) throw Error('ENS creation lacks canonical confirmations.');
  requireExplorerEnabled(hre.config);
  const verified=legacy?await (verifyLegacy||require('./verify-etherscan.cjs').verifyEtherscan)({chainId:journal.chainId,address:journal.address,artifact,buildInfo,constructorArguments:journal.constructorArgs,apiKey:hre.config.verify.etherscan.apiKey})
    :await hre.run('verify:verify',{address:journal.address,contract:FQN,constructorArguments:journal.constructorArgs,blockReference:initial.snapshot});
  if (verified!==true) throw Error('ENS exact-source explorer verification was not established.');
  const final=await readEnsCreationState({provider:p,journal,artifact,buildInfo,legacy});
  if (encode(initial.state)!==encode(final.state) || encode(initial.managerState)!==encode(final.managerState) || initial.runtimeCodeHash!==final.runtimeCodeHash) throw Error('ENS state changed during verification.');
  return {...final,status:legacy?'legacy_verified_state_observed':'verified_unconfigured',verification:{status:'verified'},
    currentOwner:final.state.owner,configuredManager:final.state.jobManager,configLocked:final.state.configLocked,
    governorActionPlan:legacy?null:governorPlan(journal),attachmentAuthorized:false,rootAuthorityAuthorized:false,intakeActivationAuthorized:false,blockchainTransactionsBroadcast:0};
}
async function recoverEns({hre,env:settings,verifyLegacy}) {
  if (!settings.ENS_JOURNAL || !settings.ENS_REPORT || parseBooleanSetting(settings.DRY_RUN,'DRY_RUN',true)) throw Error('ENS_REVERIFY requires ENS_JOURNAL, a new ENS_REPORT and DRY_RUN=0 for source submission; no signer or deployment is used.');
  if (fs.existsSync(settings.ENS_REPORT)) throw Error('ENS recovery report already exists; original history is never overwritten.');
  const journal=JSON.parse(fs.readFileSync(settings.ENS_JOURNAL,'utf8'));
  const legacy=journal.schema===undefined;
  if (!legacy && journal.schema!==SCHEMA) throw Error('Unknown ENS deployment schema; never reinterpret historical records.');
  requireDeploymentNetwork(hre.network.name,journal.chainId);
  let artifact,buildInfo;
  if (legacy) {
    if (!settings.ENS_LEGACY_ARTIFACT || !settings.ENS_LEGACY_BUILD_INFO || !settings.ENS_LEGACY_BUILD_DIGEST) throw Error('Historical five-argument ENS recovery requires the explicit original artifact, compiler build and reviewed buildDigest.');
    artifact=JSON.parse(fs.readFileSync(settings.ENS_LEGACY_ARTIFACT,'utf8')); buildInfo=JSON.parse(fs.readFileSync(settings.ENS_LEGACY_BUILD_INFO,'utf8'));
    if (qualifiedArtifact(artifact,buildInfo,FQN,['address','address','address','bytes32','string'])!==settings.ENS_LEGACY_BUILD_DIGEST) throw Error('Historical ENS source/build identity differs.');
    const originalInput=JSON.parse(fs.readFileSync(journal.solcInputPath,'utf8'));
    if (encode(originalInput)!==encode(buildInfo.input)) throw Error('Archived ENS build differs from the original journal compiler input.');
    journal.transactionHash=journal.transactions?.find(entry=>entry.action==='deploy')?.txHash;
  } else {
    artifact=await hre.artifacts.readArtifact(FQN); buildInfo=await hre.artifacts.getBuildInfo(FQN);
    if (!journal.transactionHash && journal.creationIntent) journal.transactionHash=await recoverCreation({provider:hre.ethers.provider,intent:journal.creationIntent});
  }
  const confirmations=Number(settings.CONFIRMATIONS||3);
  if (!Number.isSafeInteger(confirmations)||confirmations<3) throw Error('ENS recovery requires at least three confirmations.');
  const result=await verifyEnsCreation({hre,journal,artifact,buildInfo,confirmations,legacy,verifyLegacy});
  const report={...journal,...result,recoveryOf:path.resolve(settings.ENS_JOURNAL),priorJournalStatus:journal.status};delete report.error;
  durableWrite(settings.ENS_REPORT,report,{exclusive:true});return report;
}

async function main() {
  hre = await getRuntime();
  ({ ethers, run, network } = hre);
  if (parseBooleanSetting(env('ENS_REVERIFY'), 'ENS_REVERIFY')) { const result=await recoverEns({ hre, env:process.env }); console.log(JSON.stringify(result,null,2)); return result; }
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);
  requireDeploymentNetwork(network.name, chainId);
  const dryRun = parseBooleanSetting(env("DRY_RUN"), "DRY_RUN", true);

  const confirmations = parseIntEnv("CONFIRMATIONS", 3, 1);
  if (chainId === 1 && confirmations < 3) throw new Error("Mainnet requires at least 3 confirmations.");
  const verifyDelayMs = parseIntEnv("VERIFY_DELAY_MS", 3500, 0);

  if (chainId === 1 && !dryRun) {
    const confirm = env("DEPLOY_CONFIRM_MAINNET");
    if (confirm !== MAINNET_SAFETY_PHRASE) {
      throw new Error(
        `Refusing chainId 1 deploy without DEPLOY_CONFIRM_MAINNET=${MAINNET_SAFETY_PHRASE}`,
      );
    }
  }

  if (chainId !== 1) {
    for (const key of ["ENS_REGISTRY", "NAME_WRAPPER", "PUBLIC_RESOLVER"]) {
      if (!env(key)) throw new Error(`${key} is required on ${network.name}. Configure reviewed contracts for this network; mainnet ENS defaults are not reused. Use an explicit zero NAME_WRAPPER only for an unwrapped root.`);
    }
  }
  const ensRegistry = env("ENS_REGISTRY", chainId === 1 ? MAINNET_ENS_REGISTRY : "");
  const nameWrapper = env("NAME_WRAPPER", chainId === 1 ? MAINNET_NAME_WRAPPER : "");
  const publicResolver = env("PUBLIC_RESOLVER", chainId === 1 ? MAINNET_PUBLIC_RESOLVER : "");
  const jobManager = env("JOB_MANAGER", DEFAULT_JOB_MANAGER);

  const verify = parseBooleanSetting(env("VERIFY"), "VERIFY", true);
  const lockConfig = parseBooleanSetting(env("LOCK_CONFIG"), "LOCK_CONFIG");
  if (!dryRun && !verify) throw new Error("Explorer verification is required before an ENS helper can be deployed for use. Remove VERIFY=false or set VERIFY=1; DRY_RUN=1 remains read-only.");
  if (verify && !dryRun) requireExplorerEnabled(hre.config);

  if (env('NEW_OWNER') && env('FINAL_OWNER') && env('NEW_OWNER').toLowerCase() !== env('FINAL_OWNER').toLowerCase()) throw Error('NEW_OWNER and FINAL_OWNER conflict; select one reviewed governor.');
  const ownerOverride = env("NEW_OWNER") || env("FINAL_OWNER") || "";

  if (!ownerOverride) throw new Error("Set NEW_OWNER or FINAL_OWNER to the reviewed ENSJobPages owner. Ownership is initialized atomically in the constructor; the creator is selected separately.");

  if (ownerOverride && (!ethers.isAddress(ownerOverride) || ownerOverride.toLowerCase() === ethers.ZeroAddress.toLowerCase())) {
    throw new Error(`Resolved owner override is not a valid address: ${ownerOverride}`);
  }

  await requireCode(ensRegistry, "ENS_REGISTRY");
  await requireCode(publicResolver, "PUBLIC_RESOLVER");
  await requireCode(jobManager, "JOB_MANAGER");
  const manager = new ethers.Contract(jobManager, ["function usdcToken() view returns (address)",
    "function owner() view returns (address)", "function pendingOwner() view returns (address)",
    "function paused() view returns (bool)", "function ensJobPages() view returns (address)",
    "function nextJobId() view returns (uint256)"], ethers.provider);
  const [managerToken, managerOwner, managerPendingOwner, managerIntakePaused] = await Promise.all([
    manager.usdcToken(), manager.owner(), manager.pendingOwner(), manager.paused(),
  ]);
  requireCanonicalUSDC(chainId, managerToken);
  if (managerOwner.toLowerCase() !== ownerOverride.toLowerCase()) throw Error('The manager owner must equal the reviewed final ENS governor.');
  if (managerPendingOwner !== ethers.ZeroAddress) throw new Error("The USDC manager has pending ownership acceptance. Select the intended new manager with verified final governance; this workflow cannot alter a previous deployment.");
  if (managerIntakePaused !== true) throw new Error("The reviewed USDC manager must already have paused intake. Select the intended new paused manager; this workflow cannot pause or alter a previous deployment.");
  if (ownerOverride && [ensRegistry, nameWrapper, publicResolver, jobManager, managerToken].some(address => address.toLowerCase() === ownerOverride.toLowerCase())) {
    throw new Error("The ENSJobPages owner cannot be a configured protocol dependency. Choose a reviewed wallet or governance contract able to operate owner functions.");
  }
  const tokenDecimals = await new ethers.Contract(managerToken, ["function decimals() view returns (uint8)"], ethers.provider).decimals();
  if (Number(tokenDecimals) !== 6) throw new Error("USDC must have six decimals");
  if (nameWrapper.toLowerCase() !== ethers.ZeroAddress.toLowerCase()) {
    await requireCode(nameWrapper, "NAME_WRAPPER");
  }

  const creator = env('DEPLOYER_ADDRESS');
  if (!ethers.isAddress(creator) || creator.toLowerCase() === ethers.ZeroAddress) throw Error('DEPLOYER_ADDRESS must name the separately reviewed nonzero creator.');
  const transactionMode = env('CREATOR_TRANSACTION_MODE');
  await requireCreatorProfile({provider:ethers.provider,chainId,creator,transactionMode});
  const deployer = {address:ethers.getAddress(creator)};
  const ens = await ethers.getContractAt(
    ["function owner(bytes32 node) view returns (address)", "function resolver(bytes32 node) view returns (address)"],
    ensRegistry,
    ethers.provider,
  );
  const namespace = await resolveNamespacePlan({ chainId, jobManager, manager, ens,
    mode: env('ENS_DEPLOYMENT_MODE', 'fresh'), rootNameInput: env('JOBS_ROOT_NAME'),
    rootNodeInput: env('JOBS_ROOT_NODE'), prefixInput: env('JOB_LABEL_PREFIX') });
  const { jobsRootName, jobsRootNode, jobLabelPrefix } = namespace;
  const currentRootOwner = namespace.rootOwner;
  const constructorArgs = [ensRegistry, nameWrapper, publicResolver, jobsRootNode, jobsRootName, ethers.getAddress(ownerOverride)];
  const factory = await ethers.getContractFactory("ENSJobPages");
  const artifact = await hre.artifacts.readArtifact('ENSJobPages');
  const buildInfo = await hre.artifacts.getBuildInfo('contracts/ens/ENSJobPages.sol:ENSJobPages');
  if (!buildInfo) throw new Error('ENSJobPages build info missing. Compile the qualified release before planning deployment.');
  const settings = buildInfo.input.settings;
  const actualSettings = { version: buildInfo.solcVersion, optimizer: settings.optimizer, evmVersion: settings.evmVersion,
    viaIR: settings.viaIR || false, metadata: settings.metadata, debug: settings.debug };
  if (JSON.stringify(stableObject(actualSettings)) !== JSON.stringify(stableObject(COMPILER_SETTINGS))) {
    throw new Error('ENSJobPages compiler settings do not match the release-qualified deployment profile.');
  }
  const compiled = buildInfo.output.contracts[artifact.inputSourceName || artifact.sourceName]?.[artifact.contractName];
  if (!compiled || `0x${compiled.evm.bytecode.object}` !== artifact.bytecode || `0x${compiled.evm.deployedBytecode.object}` !== artifact.deployedBytecode) {
    throw new Error('ENSJobPages artifact differs from its compiler build. Clean and recompile the qualified release.');
  }
  const buildDigest = qualifiedArtifact(artifact,buildInfo,FQN,['address','address','address','bytes32','string','address']);
  if (env('ENS_BUILD_DIGEST') && env('ENS_BUILD_DIGEST') !== buildDigest) throw Error('ENS reviewed buildDigest differs from the exact compiler input.');
  if (!dryRun && !env('ENS_BUILD_DIGEST')) throw Error('Set ENS_BUILD_DIGEST to the explicitly reviewed compiler-input identity before deployment.');
  const managerCodeHash = ethers.keccak256(await ethers.provider.getCode(jobManager));
  if (env('ENS_MANAGER_CODE_HASH') && env('ENS_MANAGER_CODE_HASH').toLowerCase() !== managerCodeHash) throw Error('ENS manager runtime differs from the reviewed hash.');
  if (!dryRun && !env('ENS_MANAGER_CODE_HASH')) throw Error('Set ENS_MANAGER_CODE_HASH to the explicitly reviewed manager runtime before deployment.');
  const runtimeBytes = requireRuntimeSize('ENSJobPages', artifact.deployedBytecode);
  const prepared = await prepareDeployment({ provider: ethers.provider, factory, args: constructorArgs, from: deployer.address, name: 'ENSJobPages' });

  console.log("\n=== ENSJobPages deployment plan ===");
  console.log("network:", network.name);
  console.log("chainId:", chainId);
  console.log("deployer:", deployer.address);
  console.log("ENS_REGISTRY:", ensRegistry);
  console.log("NAME_WRAPPER:", nameWrapper);
  console.log("PUBLIC_RESOLVER:", publicResolver);
  console.log("JOBS_ROOT_NAME:", jobsRootName);
  console.log("JOBS_ROOT_NODE:", jobsRootNode);
  console.log("ENS namespace plan:", JSON.stringify(namespace));
  console.log("current root owner:", currentRootOwner);
  console.log("root tokenId decimal:", BigInt(jobsRootNode).toString());
  console.log("JOB_MANAGER:", jobManager);
  console.log("manager owner (no pending transfer):", managerOwner);
  console.log("manager intake paused:", managerIntakePaused);
  console.log("LOCK_CONFIG:", lockConfig);
  console.log("resolved owner override:", ownerOverride || "(none)");
  console.log("VERIFY:", verify);
  console.log("CONFIRMATIONS:", confirmations);
  console.log("VERIFY_DELAY_MS:", verifyDelayMs);
  console.log("DRY_RUN:", dryRun);
  console.log("buildDigest:", buildDigest);
  console.log("managerCodeHash:", managerCodeHash);
  console.log("deployment limits:", JSON.stringify({ runtimeBytes, initcodeBytes: prepared.initcodeBytes,
    estimatedGas: prepared.estimatedGas.toString(), gasLimit: prepared.gasLimit.toString() }));

  if (dryRun) {
    console.log("\nDRY_RUN enabled. Exiting before broadcasting transactions.");
    return;
  }

  const journalPath = env('ENS_JOURNAL');
  if (!journalPath) throw Error('ENS_JOURNAL must name the reviewed durable journal; reuse it for recovery, never create a fresh journal to retry.');
  if (fs.existsSync(journalPath) || fs.existsSync(journalPath+'.solc-input.json')) throw Error('ENS deployment journal/input already exists. Use ENS_REVERIFY with the original journal; never redeploy.');
  const [signer] = await ethers.getSigners();
  if (!signer || ethers.getAddress(await signer.getAddress()) !== deployer.address) throw Error('Signing account differs from reviewed DEPLOYER_ADDRESS.');
  const block = await snapshot(ethers.provider,chainId);
  const canonical = createCanonicalReader(ethers.provider,block);
  const canonicalManager = canonical.contract(jobManager,['function owner() view returns(address)','function pendingOwner() view returns(address)','function paused() view returns(bool)','function ensJobPages() view returns(address)','function nextJobId() view returns(uint256)']);
  const canonicalEns = canonical.contract(ensRegistry,['function owner(bytes32) view returns(address)','function resolver(bytes32) view returns(address)']);
  const [currentOwner,currentPending,currentPaused,currentHelper,currentJobId,currentRoot,currentResolver] = await Promise.all([canonicalManager.owner(),canonicalManager.pendingOwner(),canonicalManager.paused(),canonicalManager.ensJobPages(),canonicalManager.nextJobId(),canonicalEns.owner(jobsRootNode),canonicalEns.resolver(jobsRootNode)]);
  if (ethers.keccak256(await canonical.getCode(jobManager)) !== managerCodeHash || currentOwner !== ethers.getAddress(ownerOverride) || currentPending !== ethers.ZeroAddress || currentPaused !== true || currentHelper !== namespace.previousHelper || currentRoot !== namespace.rootOwner || currentResolver !== namespace.rootResolver || (namespace.mode === 'fresh' && currentJobId !== 0n)) throw Error('ENS pre-creation authority or namespace changed. Reconcile before deployment.');
  await recheck(ethers.provider,chainId,block);
  const creatorLock = reserveCreator({directory:env('DEPLOYMENT_LOCK_DIRECTORY'),chainId,creator:deployer.address,journalPath});
  const journal = {schema:SCHEMA,constructorSchema:'ens-job-pages-constructor-v2',ownershipInitialization:'explicit-constructor',
    status:'prepared',chainId,network:network.name,deployer:deployer.address,transactionMode,creatorLock,constructorArgs,namespace,
    jobManager,managerOwner,managerCodeHash,managerIntakePaused,finalOwner:ethers.getAddress(ownerOverride),lockConfig,buildDigest,
    compiler:COMPILER_SETTINGS,solcInputPath:journalPath+'.solc-input.json',runtimeBytes,
    expectedRuntimeCodeHash:ethers.keccak256(artifact.deployedBytecode),
    initcodeBytes:prepared.initcodeBytes,estimatedGas:String(prepared.estimatedGas),gasLimit:String(prepared.gasLimit),
    verification:{status:'pending'},transactions:[],attachmentAuthorized:false,rootAuthorityAuthorized:false,intakeActivationAuthorized:false};
  durableWrite(journalPath,journal,{exclusive:true});
  const checkpoint = () => durableWrite(journalPath,journal);
  try {
    durableWrite(journal.solcInputPath,buildInfo.input,{exclusive:true});
    const creationData = (await factory.getDeployTransaction(...constructorArgs)).data;
    journal.creationDataHash = ethers.keccak256(creationData);
    journal.creationIntent = await planCreation({provider:ethers.provider,chainId,creator:deployer.address,transactionMode,creationData,gasLimit:prepared.gasLimit,startBlock:block.number});
    journal.address = journal.creationIntent.address; journal.status='intent_saved'; journal.submissionAttempted=true; journal.blockchainTransactionsBroadcast='unknown'; checkpoint();
    // This is the only transaction in creation. Governor configuration is data only.
    const helper = await factory.connect(signer).deploy(...constructorArgs,{gasLimit:prepared.gasLimit,nonce:journal.creationIntent.nonce,value:0n});
    const tx = helper.deploymentTransaction();
    journal.transactionHash = tx.hash; journal.status='broadcast'; journal.blockchainTransactionsBroadcast=1; checkpoint();
    requireCreationTransaction(tx,journal.creationIntent);
    const receipt = requireConfirmedReceipt(await tx.wait(confirmations),tx.hash,journal.address);
    journal.transactions.push({action:'deploy',txHash:tx.hash,status:'confirmed',blockNumber:receipt.blockNumber,blockHash:receipt.blockHash});
    journal.status='confirmed'; checkpoint();
    if (verifyDelayMs) await sleep(verifyDelayMs);
    Object.assign(journal,await verifyEnsCreation({hre,journal,artifact,buildInfo,confirmations}),{blockchainTransactionsBroadcast:1});
    checkpoint(); releaseCreator(creatorLock);
    console.log(JSON.stringify(journal,null,2)); return journal;
  } catch (error) {
    journal.status='incomplete'; journal.error='ENS creation or verification incomplete. Preserve this journal, source input and creator lock; use keyless recovery. No governor action, attachment, root permission or intake activation was performed.';
    checkpoint(); throw new Error(journal.error,{cause:error});
  }

}

if (require.main === module) main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

module.exports = { main, parseIntEnv, deriveJobsRootName, resolveNamespacePlan, verifyEnsCreation, recoverEns, governorPlan, FQN, SCHEMA };
