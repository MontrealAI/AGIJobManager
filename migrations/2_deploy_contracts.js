const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockResolver = artifacts.require("MockResolver");

const ZERO_ROOT = "0x" + "00".repeat(32);
const MAINNET_TOKEN = "0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA";
const MAINNET_ENS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const MAINNET_NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const MAINNET_CLUB_ROOT = "0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16";
const MAINNET_ALPHA_CLUB_ROOT = "0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e";
const MAINNET_AGENT_ROOT = "0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d";
const MAINNET_ALPHA_AGENT_ROOT = "0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e";

function envOr(value, fallback) {
  return value && value.trim() ? value.trim() : fallback;
}

function requiredEnv(value, label) {
  const out = envOr(value, "");
  if (!out) {
    throw new Error(`Missing ${label}. Set ${label} in your environment before deploying.`);
  }
  return out;
}

function isMainnet(network, networkId) {
  return network === "mainnet" || Number(networkId) === 1;
}

async function logDeploymentSummary(instance, summary) {
  console.log("AGIJobManager deployment summary:");
  Object.entries(summary).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });
  const locked = await instance.configLocked();
  console.log(`- configLocked: ${locked}`);
}

module.exports = async function (deployer, network, accounts) {
  if (network === "development" || network === "test") {
    await deployer.deploy(MockERC20);
    const token = await MockERC20.deployed();

    await deployer.deploy(MockENS);
    const ens = await MockENS.deployed();

    await deployer.deploy(MockNameWrapper);
    const nameWrapper = await MockNameWrapper.deployed();

    await deployer.deploy(MockResolver);
    await MockResolver.deployed();

    await deployer.deploy(
      AGIJobManager,
      token.address,
      "https://ipfs.io/ipfs/",
      ens.address,
      nameWrapper.address,
      ZERO_ROOT,
      ZERO_ROOT,
      ZERO_ROOT,
      ZERO_ROOT
    );

    const instance = await AGIJobManager.deployed();
    await instance.setAlphaRootNodes(ZERO_ROOT, ZERO_ROOT);

    const mintAmount = web3.utils.toWei("100000");
    await token.mint(accounts[0], mintAmount);
    return;
  }

  const mainnet = isMainnet(network, deployer.network_id);
  const token = envOr(process.env.AGI_TOKEN_ADDRESS, mainnet ? MAINNET_TOKEN : "");
  const ens = envOr(process.env.AGI_ENS_ADDRESS, mainnet ? MAINNET_ENS : "");
  const nameWrapper = envOr(process.env.AGI_NAME_WRAPPER_ADDRESS, mainnet ? MAINNET_NAME_WRAPPER : "");
  const baseIpfsUrl = envOr(process.env.AGI_BASE_IPFS_URL, "https://ipfs.io/ipfs/");

  const clubRootNode = envOr(process.env.AGI_CLUB_ROOT_NODE, mainnet ? MAINNET_CLUB_ROOT : "");
  const alphaClubRootNode = envOr(
    process.env.AGI_ALPHA_CLUB_ROOT_NODE,
    mainnet ? MAINNET_ALPHA_CLUB_ROOT : ""
  );
  const agentRootNode = envOr(process.env.AGI_AGENT_ROOT_NODE, mainnet ? MAINNET_AGENT_ROOT : "");
  const alphaAgentRootNode = envOr(
    process.env.AGI_ALPHA_AGENT_ROOT_NODE,
    mainnet ? MAINNET_ALPHA_AGENT_ROOT : ""
  );
  const validatorMerkleRoot = requiredEnv(process.env.AGI_VALIDATOR_MERKLE_ROOT, "AGI_VALIDATOR_MERKLE_ROOT");
  const agentMerkleRoot = requiredEnv(process.env.AGI_AGENT_MERKLE_ROOT, "AGI_AGENT_MERKLE_ROOT");

  const resolvedToken = requiredEnv(token, "AGI_TOKEN_ADDRESS");
  const resolvedEns = requiredEnv(ens, "AGI_ENS_ADDRESS");
  const resolvedNameWrapper = requiredEnv(nameWrapper, "AGI_NAME_WRAPPER_ADDRESS");
  const resolvedClubRoot = requiredEnv(clubRootNode, "AGI_CLUB_ROOT_NODE");
  const resolvedAlphaClubRoot = requiredEnv(alphaClubRootNode, "AGI_ALPHA_CLUB_ROOT_NODE");
  const resolvedAgentRoot = requiredEnv(agentRootNode, "AGI_AGENT_ROOT_NODE");
  const resolvedAlphaAgentRoot = requiredEnv(alphaAgentRootNode, "AGI_ALPHA_AGENT_ROOT_NODE");

  await deployer.deploy(
    AGIJobManager,
    resolvedToken,
    baseIpfsUrl,
    resolvedEns,
    resolvedNameWrapper,
    resolvedClubRoot,
    resolvedAgentRoot,
    validatorMerkleRoot,
    agentMerkleRoot
  );

  const instance = await AGIJobManager.deployed();
  await instance.setAlphaRootNodes(resolvedAlphaClubRoot, resolvedAlphaAgentRoot);
  const shouldLock = (process.env.AGI_LOCK_CONFIG || "false").toLowerCase() === "true";
  if (shouldLock) {
    await instance.lockConfiguration();
  }

  await logDeploymentSummary(instance, {
    token: resolvedToken,
    baseIpfsUrl,
    ens: resolvedEns,
    nameWrapper: resolvedNameWrapper,
    clubRootNode: resolvedClubRoot,
    alphaClubRootNode: resolvedAlphaClubRoot,
    agentRootNode: resolvedAgentRoot,
    alphaAgentRootNode: resolvedAlphaAgentRoot,
    validatorMerkleRoot,
    agentMerkleRoot,
  });
};
