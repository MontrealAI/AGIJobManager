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
  return v === undefined || v === null ? d : String(v).trim();
}

function isTruthy(v) {
  const n = String(v || "").trim().toLowerCase();
  return n === "1" || n === "true" || n === "yes" || n === "y" || n === "on";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function namehash(name) {
  if (!name || !name.trim()) return ethers.ZeroHash;

  let node = ethers.ZeroHash;
  const labels = name
    .trim()
    .toLowerCase()
    .split(".")
    .filter(Boolean)
    .reverse();

  for (const label of labels) {
    const labelHash = ethers.keccak256(ethers.toUtf8Bytes(label));
    node = ethers.keccak256(ethers.concat([node, labelHash]));
  }

  return node;
}

async function requireCode(addr, label) {
  if (!ethers.isAddress(addr)) {
    throw new Error(`${label} must be a valid address. Received: ${addr}`);
  }

  const code = await ethers.provider.getCode(addr);
  if (!code || code === "0x") {
    throw new Error(`${label} has no bytecode at ${addr}`);
  }
}

function parsePositiveInt(value, label, fallback, min = 0) {
  if (value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${label} must be an integer >= ${min}. Received: ${value}`);
  }
  return parsed;
}

async function main() {
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = Number(providerNetwork.chainId);

  const confirmations = parsePositiveInt(env("CONFIRMATIONS"), "CONFIRMATIONS", 3, 0);
  const verifyDelayMs = parsePositiveInt(env("VERIFY_DELAY_MS"), "VERIFY_DELAY_MS", 3500, 0);

  if (network.name === "mainnet") {
    const gate = env("DEPLOY_CONFIRM_MAINNET");
    if (gate !== MAINNET_SAFETY_PHRASE) {
      throw new Error(
        `Refusing mainnet deploy without DEPLOY_CONFIRM_MAINNET=${MAINNET_SAFETY_PHRASE}`
      );
    }
  }

  const ensRegistry = env("ENS_REGISTRY", MAINNET_ENS_REGISTRY);
  const nameWrapper = env("NAME_WRAPPER", MAINNET_NAME_WRAPPER);
  const publicResolver = env("PUBLIC_RESOLVER", MAINNET_PUBLIC_RESOLVER);
  const jobsRootName = env("JOBS_ROOT_NAME", DEFAULT_ROOT_NAME);
  const computedRootNode = namehash(jobsRootName);
  const jobsRootNode = env("JOBS_ROOT_NODE", computedRootNode);
  const jobManager = env("JOB_MANAGER", DEFAULT_JOB_MANAGER);

  const verify = isTruthy(env("VERIFY"));
  const lockConfig = isTruthy(env("LOCK_CONFIG"));
  const dryRun = isTruthy(env("DRY_RUN"));

  const resolvedOwner = env("NEW_OWNER") || env("FINAL_OWNER") || "";

  if (jobsRootNode.toLowerCase() !== computedRootNode.toLowerCase()) {
    throw new Error(
      `JOBS_ROOT_NODE mismatch for JOBS_ROOT_NAME. computed=${computedRootNode}, provided=${jobsRootNode}`
    );
  }

  await requireCode(ensRegistry, "ENS_REGISTRY");
  await requireCode(publicResolver, "PUBLIC_RESOLVER");
  await requireCode(jobManager, "JOB_MANAGER");
  if (nameWrapper.toLowerCase() !== ethers.ZeroAddress.toLowerCase()) {
    await requireCode(nameWrapper, "NAME_WRAPPER");
  }

  const [deployer] = await ethers.getSigners();

  const ensRegistryRead = new ethers.Contract(
    ensRegistry,
    ["function owner(bytes32 node) view returns (address)"],
    ethers.provider
  );
  const currentRootOwner = await ensRegistryRead.owner(jobsRootNode);

  console.log("\nENSJobPages deployment plan");
  console.log("===========================");
  console.log(`network:             ${network.name}`);
  console.log(`chainId:             ${chainId}`);
  console.log(`deployer:            ${deployer.address}`);
  console.log(`ENS_REGISTRY:        ${ensRegistry}`);
  console.log(`NAME_WRAPPER:        ${nameWrapper}`);
  console.log(`PUBLIC_RESOLVER:     ${publicResolver}`);
  console.log(`JOBS_ROOT_NAME:      ${jobsRootName}`);
  console.log(`JOBS_ROOT_NODE:      ${jobsRootNode}`);
  console.log(`current root owner:  ${currentRootOwner}`);
  console.log(`root tokenId:        ${BigInt(jobsRootNode).toString()}`);
  console.log(`JOB_MANAGER:         ${jobManager}`);
  console.log(`LOCK_CONFIG:         ${lockConfig}`);
  console.log(`NEW_OWNER/FINAL_OWNER: ${resolvedOwner || "(none)"}`);
  console.log(`VERIFY:              ${verify}`);
  console.log(`CONFIRMATIONS:       ${confirmations}`);
  console.log(`VERIFY_DELAY_MS:     ${verifyDelayMs}`);
  console.log(`DRY_RUN:             ${dryRun}`);

  if (dryRun) {
    console.log("\nDRY_RUN enabled; exiting before sending transactions.");
    return;
  }

  const constructorArgs = [ensRegistry, nameWrapper, publicResolver, jobsRootNode, jobsRootName];
  const factory = await ethers.getContractFactory("ENSJobPages");
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();

  const deploymentTx = contract.deploymentTransaction();
  if (deploymentTx) {
    await deploymentTx.wait(confirmations);
  }

  const deployedAddress = await contract.getAddress();
  console.log(`\nENSJobPages deployed at: ${deployedAddress}`);

  const setJobManagerTx = await contract.setJobManager(jobManager);
  await setJobManagerTx.wait(confirmations);
  console.log(`setJobManager(${jobManager}) confirmed in ${setJobManagerTx.hash}`);

  if (lockConfig) {
    const lockTx = await contract.lockConfiguration();
    await lockTx.wait(confirmations);
    console.log(`lockConfiguration() confirmed in ${lockTx.hash}`);
  }

  if (resolvedOwner) {
    if (!ethers.isAddress(resolvedOwner)) {
      throw new Error(`Resolved owner is not a valid address: ${resolvedOwner}`);
    }
    const transferTx = await contract.transferOwnership(resolvedOwner);
    await transferTx.wait(confirmations);
    console.log(`transferOwnership(${resolvedOwner}) confirmed in ${transferTx.hash}`);
  }

  if (verify && network.name !== "hardhat") {
    console.log(`\nWaiting ${verifyDelayMs}ms before Etherscan verification...`);
    await sleep(verifyDelayMs);
    try {
      await run("verify:verify", {
        address: deployedAddress,
        constructorArguments: constructorArgs,
      });
      console.log("Verification submitted successfully.");
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      console.warn(`Verification skipped/failed: ${message}`);
    }
  }

  console.log("\nManual next steps:");
  console.log(
    `1) From the wrapped root owner, call NameWrapper.setApprovalForAll(${deployedAddress}, true) for ${jobsRootName}.`
  );
  console.log(
    `2) From the AGIJobManager owner, call AGIJobManager.setEnsJobPages(${deployedAddress}).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
