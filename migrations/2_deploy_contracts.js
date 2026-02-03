const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockResolver = artifacts.require("MockResolver");

const ZERO_ROOT = "0x" + "00".repeat(32);
const MAINNET_TOKEN = "0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA";
const MAINNET_ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const MAINNET_NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const MAINNET_CLUB_ROOT = "0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16";
const MAINNET_ALPHA_CLUB_ROOT = "0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e";
const MAINNET_AGENT_ROOT = "0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d";
const MAINNET_ALPHA_AGENT_ROOT = "0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e";
const MAINNET_MERKLE_ROOT = "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b";

function envOrDefault(envKey, fallback) {
  const value = (process.env[envKey] || "").trim();
  return value || fallback;
}

module.exports = async function (deployer, network, accounts) {
  const chainId = await web3.eth.getChainId();
  const isMainnet = chainId === 1 || network === "mainnet";
  const baseIpfsUrl = envOrDefault("AGI_BASE_IPFS_URL", "https://ipfs.io/ipfs/");

  if (network === "development" || network === "test") {
    await deployer.deploy(MockERC20);
    const token = await MockERC20.deployed();

    await deployer.deploy(MockENS);
    const ens = await MockENS.deployed();

    await deployer.deploy(MockNameWrapper);
    const nameWrapper = await MockNameWrapper.deployed();

    await deployer.deploy(MockResolver);
    await MockResolver.deployed();

    const validatorMerkleRoot = envOrDefault("AGI_VALIDATOR_MERKLE_ROOT", ZERO_ROOT);
    const agentMerkleRoot = envOrDefault("AGI_AGENT_MERKLE_ROOT", ZERO_ROOT);
    const clubRootNode = envOrDefault("AGI_CLUB_ROOT_NODE", ZERO_ROOT);
    const alphaClubRootNode = envOrDefault("AGI_ALPHA_CLUB_ROOT_NODE", ZERO_ROOT);
    const agentRootNode = envOrDefault("AGI_AGENT_ROOT_NODE", ZERO_ROOT);
    const alphaAgentRootNode = envOrDefault("AGI_ALPHA_AGENT_ROOT_NODE", ZERO_ROOT);

    await deployer.deploy(
      AGIJobManager,
      token.address,
      baseIpfsUrl,
      ens.address,
      nameWrapper.address,
      clubRootNode,
      agentRootNode,
      alphaClubRootNode,
      alphaAgentRootNode,
      validatorMerkleRoot,
      agentMerkleRoot
    );

    const mintAmount = web3.utils.toWei("100000");
    await token.mint(accounts[0], mintAmount);
    return;
  }

  const tokenAddress = envOrDefault("AGI_TOKEN_ADDRESS", isMainnet ? MAINNET_TOKEN : "");
  const ensRegistry = envOrDefault("AGI_ENS_REGISTRY", isMainnet ? MAINNET_ENS_REGISTRY : "");
  const nameWrapper = envOrDefault("AGI_NAME_WRAPPER", isMainnet ? MAINNET_NAME_WRAPPER : "");
  const clubRootNode = envOrDefault("AGI_CLUB_ROOT_NODE", MAINNET_CLUB_ROOT);
  const alphaClubRootNode = envOrDefault("AGI_ALPHA_CLUB_ROOT_NODE", MAINNET_ALPHA_CLUB_ROOT);
  const agentRootNode = envOrDefault("AGI_AGENT_ROOT_NODE", MAINNET_AGENT_ROOT);
  const alphaAgentRootNode = envOrDefault("AGI_ALPHA_AGENT_ROOT_NODE", MAINNET_ALPHA_AGENT_ROOT);
  const validatorMerkleRoot = envOrDefault(
    "AGI_VALIDATOR_MERKLE_ROOT",
    isMainnet ? MAINNET_MERKLE_ROOT : ZERO_ROOT
  );
  const agentMerkleRoot = envOrDefault(
    "AGI_AGENT_MERKLE_ROOT",
    isMainnet ? MAINNET_MERKLE_ROOT : ZERO_ROOT
  );

  if (!tokenAddress || !ensRegistry || !nameWrapper) {
    throw new Error(
      "Missing deploy-time addresses. Set AGI_TOKEN_ADDRESS, AGI_ENS_REGISTRY, and AGI_NAME_WRAPPER."
    );
  }

  await deployer.deploy(
    AGIJobManager,
    tokenAddress,
    baseIpfsUrl,
    ensRegistry,
    nameWrapper,
    clubRootNode,
    agentRootNode,
    alphaClubRootNode,
    alphaAgentRootNode,
    validatorMerkleRoot,
    agentMerkleRoot
  );

  const manager = await AGIJobManager.deployed();
  const shouldLock = (process.env.LOCK_CONFIG || "").toLowerCase() === "true";
  if (shouldLock) {
    await manager.lockConfiguration();
  }

  console.log("Deployment summary:");
  console.log(`- network: ${network} (chainId=${chainId})`);
  console.log(`- agiToken: ${tokenAddress}`);
  console.log(`- ensRegistry: ${ensRegistry}`);
  console.log(`- nameWrapper: ${nameWrapper}`);
  console.log(`- clubRootNode: ${clubRootNode}`);
  console.log(`- alphaClubRootNode: ${alphaClubRootNode}`);
  console.log(`- agentRootNode: ${agentRootNode}`);
  console.log(`- alphaAgentRootNode: ${alphaAgentRootNode}`);
  console.log(`- validatorMerkleRoot: ${validatorMerkleRoot}`);
  console.log(`- agentMerkleRoot: ${agentMerkleRoot}`);
  console.log(`- configLocked: ${await manager.configLocked()}`);
};
