const { getRuntime } = require('./runtime.cjs');
let hre, ethers, run, network;
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
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
  return ethers.namehash(ethers.ensNormalize(name));
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

async function main() {
  hre = await getRuntime();
  ({ ethers, run, network } = hre);
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);
  requireDeploymentNetwork(network.name, chainId);
  const dryRun = parseBooleanSetting(env("DRY_RUN"), "DRY_RUN");

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

  const ownerOverride = env("NEW_OWNER") || env("FINAL_OWNER") || "";

  if (!ownerOverride) throw new Error("Set NEW_OWNER or FINAL_OWNER to the reviewed ENSJobPages owner. Ownership is transferred in one step; the deployer is not selected implicitly.");

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
  if (managerPendingOwner !== ethers.ZeroAddress) throw new Error("The USDC manager has pending ownership acceptance. Complete and verify its two-step handover before deploying the ENS helper.");
  if (managerIntakePaused !== true) throw new Error("Pause intake on the reviewed USDC manager before deploying the ENS helper. Existing jobs can continue settlement while intake is paused.");
  if (ownerOverride && [ensRegistry, nameWrapper, publicResolver, jobManager, managerToken].some(address => address.toLowerCase() === ownerOverride.toLowerCase())) {
    throw new Error("The ENSJobPages owner cannot be a configured protocol dependency. Choose a reviewed wallet or governance contract able to operate owner functions.");
  }
  const tokenDecimals = await new ethers.Contract(managerToken, ["function decimals() view returns (uint8)"], ethers.provider).decimals();
  if (Number(tokenDecimals) !== 6) throw new Error("USDC must have six decimals");
  if (nameWrapper.toLowerCase() !== ethers.ZeroAddress.toLowerCase()) {
    await requireCode(nameWrapper, "NAME_WRAPPER");
  }

  let [deployer] = await ethers.getSigners();
  if (!deployer && dryRun && env("DEPLOYER_ADDRESS")) {
    const address = env("DEPLOYER_ADDRESS");
    if (!ethers.isAddress(address) || address.toLowerCase() === ethers.ZeroAddress.toLowerCase()) throw new Error("DEPLOYER_ADDRESS must be a valid nonzero address.");
    deployer = { address: ethers.getAddress(address) };
  }
  if (!deployer) throw new Error("A deployer account is required. For read-only DRY_RUN=1 without a key, set DEPLOYER_ADDRESS.");
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
  const constructorArgs = [ensRegistry, nameWrapper, publicResolver, jobsRootNode, jobsRootName];
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
  console.log("deployment limits:", JSON.stringify({ runtimeBytes, initcodeBytes: prepared.initcodeBytes,
    estimatedGas: prepared.estimatedGas.toString(), gasLimit: prepared.gasLimit.toString() }));

  if (dryRun) {
    console.log("\nDRY_RUN enabled. Exiting before broadcasting transactions.");
    return;
  }

  const journalDirectory = path.join(__dirname, '..', 'deployments', network.name);
  fs.mkdirSync(journalDirectory, { recursive: true });
  const journalPath = path.join(journalDirectory, `ens-job-pages.${chainId}.${randomUUID()}.json`);
  const solcInputPath = journalPath.replace(/\.json$/, '.solc-input.json');
  fs.writeFileSync(solcInputPath, `${JSON.stringify(buildInfo.input, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  const journal = { status: 'started', chainId, network: network.name, deployer: deployer.address,
    constructorArgs, namespace, jobManager, managerOwner, managerIntakePaused, finalOwner: ownerOverride, lockConfig,
    compiler: COMPILER_SETTINGS, solcInputPath, expectedRuntimeCodeHash: ethers.keccak256(artifact.deployedBytecode),
    runtimeBytes, initcodeBytes: prepared.initcodeBytes, estimatedGas: prepared.estimatedGas.toString(), gasLimit: prepared.gasLimit.toString(),
    verification: { status: verify ? 'pending' : 'not_requested' }, transactions: [] };
  const checkpoint = () => {
    fs.writeFileSync(`${journalPath}.tmp`, `${JSON.stringify(journal, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(`${journalPath}.tmp`, journalPath);
  };
  checkpoint();
  console.log(`ENS deployment journal: ${journalPath}`);
  const recordTransaction = async (action, tx, contractAddress) => {
    const entry = { action, txHash: tx.hash, status: 'broadcast' };
    journal.transactions.push(entry);
    checkpoint();
    const receipt = requireConfirmedReceipt(await tx.wait(confirmations), tx.hash, contractAddress);
    Object.assign(entry, { status: 'confirmed', blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, gasUsed: receipt.gasUsed.toString() });
    checkpoint();
  };
  try {
    const ensJobPages = await factory.deploy(...constructorArgs, { gasLimit: prepared.gasLimit });
    const ensJobPagesAddress = await ensJobPages.getAddress();
    journal.address = ensJobPagesAddress;
    await recordTransaction('deploy', ensJobPages.deploymentTransaction(), ensJobPagesAddress);
    await ensJobPages.waitForDeployment();
    const code = await ethers.provider.getCode(ensJobPagesAddress);
    requireArtifactMatch({ artifact, buildInfo, address: ensJobPagesAddress, code });
    journal.runtimeCodeHash = ethers.keccak256(code);
    checkpoint();
    console.log("\nENSJobPages deployed:", ensJobPagesAddress);

    console.log("Setting job manager...");
    await recordTransaction('setJobManager', await ensJobPages.setJobManager(jobManager));
    await recordTransaction('setJobLabelPrefix', await ensJobPages.setJobLabelPrefix(jobLabelPrefix));
    const [configuredRoot, configuredNode, configuredPrefix, configuredManagerAddress] = await Promise.all([
      ensJobPages.jobsRootName(), ensJobPages.jobsRootNode(), ensJobPages.jobLabelPrefix(), ensJobPages.jobManager(),
    ]);
    if (configuredRoot !== jobsRootName || configuredNode !== jobsRootNode || configuredPrefix !== jobLabelPrefix || configuredManagerAddress.toLowerCase() !== jobManager.toLowerCase()) {
      throw new Error('Configured ENS namespace differs from the plan. Stop before locking or ownership handoff.');
    }

    if (verify) {
      try {
        console.log(`\nWaiting ${verifyDelayMs}ms before verify...`);
        await sleep(verifyDelayMs);
        const verified = await run("verify:verify", { address: ensJobPagesAddress, constructorArguments: constructorArgs });
        if (verified !== true) throw new Error("Explorer verification did not return an explicit successful result.");
        journal.verification = { status: 'verified' };
      } catch (error) {
        journal.verification = { status: 'failed', error: String(error?.message || error) };
        checkpoint();
        throw new Error(`ENSJobPages ${ensJobPagesAddress} was deployed but explorer verification failed. Preserve ${journalPath} and finish verification before use; do not redeploy blindly. ${String(error?.message || error)}`);
      }
      checkpoint();
    }

    if (lockConfig) {
      console.log("Locking configuration...");
      await recordTransaction('lockConfiguration', await ensJobPages.lockConfiguration());
    }
    if (ownerOverride) {
      console.log("Transferring ENSJobPages ownership in one step to:", ownerOverride);
      await recordTransaction('transferOwnership', await ensJobPages.transferOwnership(ownerOverride));
    }
    const currentOwner = await ensJobPages.owner();
    const configuredManager = await ensJobPages.jobManager();
    const configLocked = await ensJobPages.configLocked();
    const [actualRootName, actualRootNode, actualPrefix] = await Promise.all([
      ensJobPages.jobsRootName(), ensJobPages.jobsRootNode(), ensJobPages.jobLabelPrefix(),
    ]);
    if (currentOwner.toLowerCase() !== journal.finalOwner.toLowerCase() || configuredManager.toLowerCase() !== jobManager.toLowerCase() || configLocked !== lockConfig ||
        actualRootName !== jobsRootName || actualRootNode !== jobsRootNode || actualPrefix !== jobLabelPrefix) {
      throw new Error('ENSJobPages final configuration did not match the reviewed plan. Preserve the journal and reconcile before use.');
    }
    Object.assign(journal, { status: 'configured', currentOwner, configuredManager, configLocked });
    checkpoint();
    console.log(`ENSJobPages configured; verification=${journal.verification.status}. Receipt: ${journalPath}`);
  } catch (error) {
    journal.status = 'failed';
    journal.error = String(error?.message || error);
    checkpoint();
    console.error(`ENS deployment incomplete. Preserve ${journalPath}; do not redeploy blindly.`);
    throw error;
  }

  console.log("\nManual next steps (not automated):");
  console.log(`Namespace (${namespace.mode}): ${namespace.exampleJobName}`);
  if (namespace.mode === 'replacement') console.log("Preserve the existing root and every historical job label. Reconcile the exact-label migration inventory before the same-manager cutover; do not create a new namespace.");
  console.log("1) Have the ENS parent owner establish direct helper ownership of the reviewed dedicated jobs root. For the qualified wrapped route, verify Registry owner(root)=NameWrapper and NameWrapper.ownerOf(root)=newEnsJobPages; an unwrapped root instead requires Registry owner(root)=newEnsJobPages.");
  console.log("   A fresh USDC manager must keep the legacy manager, helper and jobs namespace unchanged. Do not grant blanket approval over legacy names.");
  console.log("   For a same-manager helper replacement, review the existing root authority and replacement runbook separately.");
  console.log("2) On the reviewed USDC AGIJobManager, its accepted owner calls setEnsJobPages(newEnsJobPages).");
  console.log("3) Verify creation, actor delegation, authorized writes and terminal revocation with no skipped or best-effort failure events before opening general intake.");
}

if (require.main === module) main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

module.exports = { main, parseIntEnv, deriveJobsRootName, resolveNamespacePlan };
