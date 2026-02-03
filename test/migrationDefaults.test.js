const assert = require("assert");

const { resolveDeploymentConfig } = require("../migrations/2_deploy_contracts");

describe("deployment config resolution", () => {
  it("defaults to canonical mainnet wiring when env vars are missing", () => {
    const config = resolveDeploymentConfig({ network: "mainnet", networkId: 1, env: {} });

    assert.equal(
      config.tokenAddress,
      "0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA",
      "mainnet token should default to canonical AGIALPHA",
    );
    assert.equal(
      config.ensAddress,
      "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
      "mainnet ENS registry should default to canonical address",
    );
    assert.equal(
      config.nameWrapperAddress,
      "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
      "mainnet NameWrapper should default to canonical address",
    );
    assert.equal(
      config.clubRootNode,
      "0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16",
    );
    assert.equal(
      config.alphaClubRootNode,
      "0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e",
    );
    assert.equal(
      config.agentRootNode,
      "0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d",
    );
    assert.equal(
      config.alphaAgentRootNode,
      "0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e",
    );
    assert.equal(config.baseIpfsUrl, "https://ipfs.io/ipfs/");
  });

  it("requires explicit non-mainnet wiring", () => {
    assert.throws(
      () => resolveDeploymentConfig({ network: "sepolia", networkId: 11155111, env: {} }),
      /Missing AGI_TOKEN_ADDRESS/,
    );
  });

  it("uses env overrides for non-mainnet deployments", () => {
    const env = {
      AGI_TOKEN_ADDRESS: "0x0000000000000000000000000000000000000001",
      AGI_ENS_REGISTRY: "0x0000000000000000000000000000000000000002",
      AGI_NAMEWRAPPER: "0x0000000000000000000000000000000000000003",
      AGI_CLUB_ROOT_NODE: "0x" + "11".repeat(32),
      AGI_ALPHA_CLUB_ROOT_NODE: "0x" + "22".repeat(32),
      AGI_AGENT_ROOT_NODE: "0x" + "33".repeat(32),
      AGI_ALPHA_AGENT_ROOT_NODE: "0x" + "44".repeat(32),
      AGI_VALIDATOR_MERKLE_ROOT: "0x" + "55".repeat(32),
      AGI_AGENT_MERKLE_ROOT: "0x" + "66".repeat(32),
      AGI_BASE_IPFS_URL: "ipfs://custom",
    };

    const config = resolveDeploymentConfig({ network: "sepolia", networkId: 11155111, env });
    assert.equal(config.tokenAddress, env.AGI_TOKEN_ADDRESS);
    assert.equal(config.ensAddress, env.AGI_ENS_REGISTRY);
    assert.equal(config.nameWrapperAddress, env.AGI_NAMEWRAPPER);
    assert.equal(config.clubRootNode, env.AGI_CLUB_ROOT_NODE);
    assert.equal(config.alphaClubRootNode, env.AGI_ALPHA_CLUB_ROOT_NODE);
    assert.equal(config.agentRootNode, env.AGI_AGENT_ROOT_NODE);
    assert.equal(config.alphaAgentRootNode, env.AGI_ALPHA_AGENT_ROOT_NODE);
    assert.equal(config.validatorMerkleRoot, env.AGI_VALIDATOR_MERKLE_ROOT);
    assert.equal(config.agentMerkleRoot, env.AGI_AGENT_MERKLE_ROOT);
    assert.equal(config.baseIpfsUrl, env.AGI_BASE_IPFS_URL);
  });
});
