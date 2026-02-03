const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockResolver = artifacts.require("MockResolver");

const ZERO_ROOT = "0x" + "00".repeat(32);
const MAINNET_TOKEN = "0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA";
const MAINNET_ENS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const MAINNET_NAMEWRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const MAINNET_CLUB_ROOT = "0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16";
const MAINNET_ALPHA_CLUB_ROOT = "0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e";
const MAINNET_AGENT_ROOT = "0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d";
const MAINNET_ALPHA_AGENT_ROOT = "0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e";
const MAINNET_VALIDATOR_MERKLE = "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b";
const MAINNET_AGENT_MERKLE = "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b";

function envOr(key, fallback) {
  const value = (process.env[key] || "").trim();
  return value || fallback;
}

function boolEnv(key, fallback = false) {
  const value = (process.env[key] || "").trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(value);
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
      envOr("AGI_BASE_IPFS_URL", "https://ipfs.io/ipfs/"),
      ens.address,
      nameWrapper.address,
      envOr("AGI_CLUB_ROOT_NODE", ZERO_ROOT),
      envOr("AGI_ALPHA_CLUB_ROOT_NODE", ZERO_ROOT),
      envOr("AGI_AGENT_ROOT_NODE", ZERO_ROOT),
      envOr("AGI_ALPHA_AGENT_ROOT_NODE", ZERO_ROOT),
      envOr("AGI_VALIDATOR_MERKLE_ROOT", ZERO_ROOT),
      envOr("AGI_AGENT_MERKLE_ROOT", ZERO_ROOT)
    );

    const mintAmount = web3.utils.toWei("100000");
    await token.mint(accounts[0], mintAmount);
    return;
  }

  const chainId = await web3.eth.getChainId();
  const isMainnet = chainId === 1 || network === "mainnet";
  const ipfsBase = envOr("AGI_BASE_IPFS_URL", "https://ipfs.io/ipfs/");
  const tokenAddress = envOr("AGI_TOKEN_ADDRESS", isMainnet ? MAINNET_TOKEN : "");
  const ensAddress = envOr("AGI_ENS_REGISTRY_ADDRESS", isMainnet ? MAINNET_ENS : "");
  const nameWrapperAddress = envOr("AGI_NAMEWRAPPER_ADDRESS", isMainnet ? MAINNET_NAMEWRAPPER : "");
  const clubRoot = envOr("AGI_CLUB_ROOT_NODE", isMainnet ? MAINNET_CLUB_ROOT : ZERO_ROOT);
  const alphaClubRoot = envOr(
    "AGI_ALPHA_CLUB_ROOT_NODE",
    isMainnet ? MAINNET_ALPHA_CLUB_ROOT : ZERO_ROOT
  );
  const agentRoot = envOr("AGI_AGENT_ROOT_NODE", isMainnet ? MAINNET_AGENT_ROOT : ZERO_ROOT);
  const alphaAgentRoot = envOr(
    "AGI_ALPHA_AGENT_ROOT_NODE",
    isMainnet ? MAINNET_ALPHA_AGENT_ROOT : ZERO_ROOT
  );
  const validatorMerkle = envOr(
    "AGI_VALIDATOR_MERKLE_ROOT",
    isMainnet ? MAINNET_VALIDATOR_MERKLE : ZERO_ROOT
  );
  const agentMerkle = envOr("AGI_AGENT_MERKLE_ROOT", isMainnet ? MAINNET_AGENT_MERKLE : ZERO_ROOT);

  if (!tokenAddress || !ensAddress || !nameWrapperAddress) {
    throw new Error(
      "Missing deployment addresses. Set AGI_TOKEN_ADDRESS, AGI_ENS_REGISTRY_ADDRESS, AGI_NAMEWRAPPER_ADDRESS."
    );
  }

  await deployer.deploy(
    AGIJobManager,
    tokenAddress,
    ipfsBase,
    ensAddress,
    nameWrapperAddress,
    clubRoot,
    alphaClubRoot,
    agentRoot,
    alphaAgentRoot,
    validatorMerkle,
    agentMerkle
  );

  const manager = await AGIJobManager.deployed();
  if (boolEnv("LOCK_CONFIG", false)) {
    await manager.lockConfiguration();
  }

  console.log("Deployment summary:");
  console.log(`- network: ${network} (chainId ${chainId})`);
  console.log(`- AGIJobManager: ${manager.address}`);
  console.log(`- token: ${tokenAddress}`);
  console.log(`- ENS registry: ${ensAddress}`);
  console.log(`- NameWrapper: ${nameWrapperAddress}`);
  console.log(`- clubRootNode: ${clubRoot}`);
  console.log(`- alphaClubRootNode: ${alphaClubRoot}`);
  console.log(`- agentRootNode: ${agentRoot}`);
  console.log(`- alphaAgentRootNode: ${alphaAgentRoot}`);
  console.log(`- validatorMerkleRoot: ${validatorMerkle}`);
  console.log(`- agentMerkleRoot: ${agentMerkle}`);
  console.log(`- configLocked: ${await manager.configLocked()}`);
};
