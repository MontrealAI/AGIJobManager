const ZERO_ROOT = "0x" + "00".repeat(32);
const MAINNET_TOKEN = "0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA";
const MAINNET_ENS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const MAINNET_NAMEWRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const MAINNET_CLUB_ROOT = "0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16";
const MAINNET_ALPHA_CLUB_ROOT = "0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e";
const MAINNET_AGENT_ROOT = "0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d";
const MAINNET_ALPHA_AGENT_ROOT = "0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e";
const DEFAULT_MERKLE_ROOT = "0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b";
const DEFAULT_IPFS_BASE = "https://ipfs.io/ipfs/";

function envValue(key, fallback) {
  const value = (process.env[key] || "").trim();
  return value || fallback;
}

function requireEnv(key, fallback) {
  const value = envValue(key, fallback);
  if (!value) {
    throw new Error(`Missing ${key} (set in .env or environment)`);
  }
  return value;
}

function buildInitConfig(
  tokenAddress,
  baseIpfsUrl,
  ensAddress,
  nameWrapperAddress,
  clubRootNode,
  agentRootNode,
  alphaClubRootNode,
  alphaAgentRootNode,
  validatorMerkleRoot,
  agentMerkleRoot,
) {
  return [
    tokenAddress,
    baseIpfsUrl,
    [ensAddress, nameWrapperAddress],
    [clubRootNode, agentRootNode, alphaClubRootNode, alphaAgentRootNode],
    [validatorMerkleRoot, agentMerkleRoot],
  ];
}

function resolveDeployConfig(network, networkId) {
  const isMainnet = network === "mainnet" || Number(networkId) === 1;
  const baseIpfsUrl = envValue("AGI_BASE_IPFS_URL", DEFAULT_IPFS_BASE);

  const tokenAddress = isMainnet
    ? envValue("AGI_TOKEN_ADDRESS", MAINNET_TOKEN)
    : requireEnv("AGI_TOKEN_ADDRESS");
  const ensAddress = isMainnet
    ? envValue("AGI_ENS_REGISTRY", MAINNET_ENS)
    : requireEnv("AGI_ENS_REGISTRY");
  const nameWrapperAddress = isMainnet
    ? envValue("AGI_NAMEWRAPPER", MAINNET_NAMEWRAPPER)
    : requireEnv("AGI_NAMEWRAPPER");
  const clubRootNode = isMainnet
    ? envValue("AGI_CLUB_ROOT_NODE", MAINNET_CLUB_ROOT)
    : requireEnv("AGI_CLUB_ROOT_NODE");
  const alphaClubRootNode = isMainnet
    ? envValue("AGI_ALPHA_CLUB_ROOT_NODE", MAINNET_ALPHA_CLUB_ROOT)
    : requireEnv("AGI_ALPHA_CLUB_ROOT_NODE");
  const agentRootNode = isMainnet
    ? envValue("AGI_AGENT_ROOT_NODE", MAINNET_AGENT_ROOT)
    : requireEnv("AGI_AGENT_ROOT_NODE");
  const alphaAgentRootNode = isMainnet
    ? envValue("AGI_ALPHA_AGENT_ROOT_NODE", MAINNET_ALPHA_AGENT_ROOT)
    : requireEnv("AGI_ALPHA_AGENT_ROOT_NODE");
  const validatorMerkleRoot = envValue("AGI_VALIDATOR_MERKLE_ROOT", DEFAULT_MERKLE_ROOT);
  const agentMerkleRoot = envValue("AGI_AGENT_MERKLE_ROOT", DEFAULT_MERKLE_ROOT);

  return {
    tokenAddress,
    baseIpfsUrl,
    ensAddress,
    nameWrapperAddress,
    clubRootNode,
    agentRootNode,
    alphaClubRootNode,
    alphaAgentRootNode,
    validatorMerkleRoot,
    agentMerkleRoot,
    isMainnet,
  };
}

module.exports = {
  ZERO_ROOT,
  MAINNET_TOKEN,
  MAINNET_ENS,
  MAINNET_NAMEWRAPPER,
  MAINNET_CLUB_ROOT,
  MAINNET_ALPHA_CLUB_ROOT,
  MAINNET_AGENT_ROOT,
  MAINNET_ALPHA_AGENT_ROOT,
  DEFAULT_MERKLE_ROOT,
  DEFAULT_IPFS_BASE,
  envValue,
  requireEnv,
  buildInitConfig,
  resolveDeployConfig,
};
