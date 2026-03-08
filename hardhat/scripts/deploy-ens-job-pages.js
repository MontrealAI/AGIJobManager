const hre = require("hardhat");

const { ethers, run, network } = hre;

const MAINNET_ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const MAINNET_NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const MAINNET_PUBLIC_RESOLVER = "0xF29100983E058B709F3D539b0c765937B804AC15";
const DEFAULT_JOB_MANAGER = "0xB3AAeb69b630f0299791679c063d68d6687481d1";
const DEFAULT_ROOT_NAME = "alpha.jobs.agi.eth";
const MAINNET_SAFETY_PHRASE = "I_UNDERSTAND_MAINNET_DEPLOYMENT";

function env(k, d = "") {
  const v = process.env[k];
  return v === undefined || v === null || v === "" ? d : v;
}

function isTruthy(v) {
  return ["1", "true", "yes", "y", "on"].includes(String(v || "").trim().toLowerCase());
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
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${key} must be an integer >= ${min}. Received: ${raw}`);
  }
  return parsed;
}

async function main() {
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  const confirmations = parseIntEnv("CONFIRMATIONS", 3, 0);
  const verifyDelayMs = parseIntEnv("VERIFY_DELAY_MS", 3500, 0);

  if (chainId === 1) {
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

  const verify = isTruthy(env("VERIFY"));
  const lockConfig = isTruthy(env("LOCK_CONFIG"));
  const dryRun = isTruthy(env("DRY_RUN"));

  const ownerOverride = env("NEW_OWNER") || env("FINAL_OWNER") || "";

  if (ownerOverride && !ethers.isAddress(ownerOverride)) {
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
  if (nameWrapper.toLowerCase() !== ethers.ZeroAddress.toLowerCase()) {
    await requireCode(nameWrapper, "NAME_WRAPPER");
  }

  const [deployer] = await ethers.getSigners();
  const ens = await ethers.getContractAt(
    ["function owner(bytes32 node) view returns (address)"],
    ensRegistry,
    deployer,
  );
  const currentRootOwner = await ens.owner(jobsRootNode);

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

  if (dryRun) {
    console.log("\nDRY_RUN enabled. Exiting before broadcasting transactions.");
    return;
  }

  const constructorArgs = [ensRegistry, nameWrapper, publicResolver, jobsRootNode, jobsRootName];
  const factory = await ethers.getContractFactory("ENSJobPages");
  const ensJobPages = await factory.deploy(...constructorArgs);
  await ensJobPages.waitForDeployment();
  const deploymentTx = ensJobPages.deploymentTransaction();
  if (deploymentTx && confirmations > 0) {
    await deploymentTx.wait(confirmations);
  }

  const ensJobPagesAddress = await ensJobPages.getAddress();
  console.log("\nENSJobPages deployed:", ensJobPagesAddress);

  console.log("Setting job manager...");
  const setJobManagerTx = await ensJobPages.setJobManager(jobManager);
  await setJobManagerTx.wait(confirmations);

  if (lockConfig) {
    console.log("Locking configuration...");
    const lockTx = await ensJobPages.lockConfiguration();
    await lockTx.wait(confirmations);
  }

  if (ownerOverride) {
    console.log("Transferring ownership to:", ownerOverride);
    const transferTx = await ensJobPages.transferOwnership(ownerOverride);
    await transferTx.wait(confirmations);
  }

  if (verify && network.name !== "hardhat") {
    try {
      console.log(`\nWaiting ${verifyDelayMs}ms before verify...`);
      await sleep(verifyDelayMs);
      await run("verify:verify", {
        address: ensJobPagesAddress,
        constructorArguments: constructorArgs,
      });
      console.log("Verification submitted.");
    } catch (err) {
      console.warn("Verification skipped/failed:", err && err.message ? err.message : err);
    }
  }

  console.log("\nManual next steps (not automated):");
  console.log("1) On NameWrapper, wrapped-root owner calls setApprovalForAll(newEnsJobPages, true).");
  console.log("2) On AGIJobManager, owner calls setEnsJobPages(newEnsJobPages).");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
