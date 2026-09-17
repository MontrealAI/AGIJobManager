const { getRuntime } = require('./runtime.cjs');
let hre, ethers, run, network;
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");



const MAINNET_ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const MAINNET_NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const MAINNET_PUBLIC_RESOLVER = "0xF29100983E058B709F3D539b0c765937B804AC15";
const DEFAULT_JOB_MANAGER = ""; // Explicit verified USDC manager required.
const { requireCanonicalUSDC } = require("../../scripts/lib/usdc");
const { parseBooleanSetting, requireExplorerEnabled, requireConfirmedReceipt, requireDeploymentNetwork, requireRuntimeSize, prepareDeployment } = require("./deployment-safety.cjs");
const DEFAULT_ROOT_NAME = "alpha.jobs.agi.eth";
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

  const ensRegistry = env("ENS_REGISTRY", MAINNET_ENS_REGISTRY);
  const nameWrapper = env("NAME_WRAPPER", MAINNET_NAME_WRAPPER);
  const publicResolver = env("PUBLIC_RESOLVER", MAINNET_PUBLIC_RESOLVER);
  const jobsRootNameInput = env("JOBS_ROOT_NAME", DEFAULT_ROOT_NAME);
  const jobsRootName = ethers.ensNormalize(jobsRootNameInput);
  const computedJobsRootNode = namehash(jobsRootName);
  const jobsRootNode = env("JOBS_ROOT_NODE", computedJobsRootNode);
  const jobManager = env("JOB_MANAGER", DEFAULT_JOB_MANAGER);

  const verify = parseBooleanSetting(env("VERIFY"), "VERIFY");
  const lockConfig = parseBooleanSetting(env("LOCK_CONFIG"), "LOCK_CONFIG");
  if (verify && !dryRun) requireExplorerEnabled(hre.config);

  const ownerOverride = env("NEW_OWNER") || env("FINAL_OWNER") || "";

  if (ownerOverride && (!ethers.isAddress(ownerOverride) || ownerOverride.toLowerCase() === ethers.ZeroAddress.toLowerCase())) {
    throw new Error(`Resolved owner override is not a valid address: ${ownerOverride}`);
  }

  if (!ethers.isHexString(jobsRootNode, 32)) {
    throw new Error(`JOBS_ROOT_NODE must be bytes32. Received: ${jobsRootNode}`);
  }
  if (jobsRootNode.toLowerCase() !== computedJobsRootNode.toLowerCase()) {
    throw new Error(
      `JOBS_ROOT_NODE mismatch for JOBS_ROOT_NAME (${jobsRootName}). Expected ${computedJobsRootNode}, got ${jobsRootNode}`,
    );
  }

  await requireCode(ensRegistry, "ENS_REGISTRY");
  await requireCode(publicResolver, "PUBLIC_RESOLVER");
  await requireCode(jobManager, "JOB_MANAGER");
  const managerToken = await new ethers.Contract(jobManager, ["function usdcToken() view returns (address)"], ethers.provider).usdcToken();
  requireCanonicalUSDC(chainId, managerToken);
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
    ["function owner(bytes32 node) view returns (address)"],
    ensRegistry,
    ethers.provider,
  );
  const currentRootOwner = await ens.owner(jobsRootNode);
  const constructorArgs = [ensRegistry, nameWrapper, publicResolver, jobsRootNode, jobsRootName];
  const factory = await ethers.getContractFactory("ENSJobPages");
  const runtimeBytes = requireRuntimeSize('ENSJobPages', (await hre.artifacts.readArtifact('ENSJobPages')).deployedBytecode);
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
  console.log("current root owner:", currentRootOwner);
  console.log("root tokenId decimal:", BigInt(jobsRootNode).toString());
  console.log("JOB_MANAGER:", jobManager);
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
  const journal = { status: 'started', chainId, network: network.name, deployer: deployer.address,
    constructorArgs, jobManager, finalOwner: ownerOverride || deployer.address, lockConfig,
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
    console.log("\nENSJobPages deployed:", ensJobPagesAddress);

    console.log("Setting job manager...");
    await recordTransaction('setJobManager', await ensJobPages.setJobManager(jobManager));

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
    if (currentOwner.toLowerCase() !== journal.finalOwner.toLowerCase() || configuredManager.toLowerCase() !== jobManager.toLowerCase() || configLocked !== lockConfig) {
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
  console.log("1) On NameWrapper, wrapped-root owner calls setApprovalForAll(newEnsJobPages, true).");
  console.log("2) On AGIJobManager, owner calls setEnsJobPages(newEnsJobPages).");
}

if (require.main === module) main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

module.exports = { main, parseIntEnv };
