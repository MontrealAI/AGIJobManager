const assert = require("assert");

const {
  MAINNET_TOKEN,
  MAINNET_ENS,
  MAINNET_NAMEWRAPPER,
  MAINNET_CLUB_ROOT,
  MAINNET_ALPHA_CLUB_ROOT,
  MAINNET_AGENT_ROOT,
  MAINNET_ALPHA_AGENT_ROOT,
  DEFAULT_MERKLE_ROOT,
  DEFAULT_IPFS_BASE,
  resolveDeployConfig,
} = require("../migrations/deploy-config");

function withEnv(overrides, fn) {
  const original = { ...process.env };
  Object.assign(process.env, overrides);
  try {
    fn();
  } finally {
    process.env = original;
  }
}

describe("deployment config defaults", () => {
  it("uses canonical mainnet defaults when env overrides are unset", () => {
    withEnv(
      {
        AGI_TOKEN_ADDRESS: "",
        AGI_ENS_REGISTRY: "",
        AGI_NAMEWRAPPER: "",
        AGI_CLUB_ROOT_NODE: "",
        AGI_ALPHA_CLUB_ROOT_NODE: "",
        AGI_AGENT_ROOT_NODE: "",
        AGI_ALPHA_AGENT_ROOT_NODE: "",
        AGI_VALIDATOR_MERKLE_ROOT: "",
        AGI_AGENT_MERKLE_ROOT: "",
        AGI_BASE_IPFS_URL: "",
      },
      () => {
        const config = resolveDeployConfig("mainnet", 1);
        assert.equal(config.tokenAddress, MAINNET_TOKEN);
        assert.equal(config.ensAddress, MAINNET_ENS);
        assert.equal(config.nameWrapperAddress, MAINNET_NAMEWRAPPER);
        assert.equal(config.clubRootNode, MAINNET_CLUB_ROOT);
        assert.equal(config.alphaClubRootNode, MAINNET_ALPHA_CLUB_ROOT);
        assert.equal(config.agentRootNode, MAINNET_AGENT_ROOT);
        assert.equal(config.alphaAgentRootNode, MAINNET_ALPHA_AGENT_ROOT);
        assert.equal(config.validatorMerkleRoot, DEFAULT_MERKLE_ROOT);
        assert.equal(config.agentMerkleRoot, DEFAULT_MERKLE_ROOT);
        assert.equal(config.baseIpfsUrl, DEFAULT_IPFS_BASE);
      },
    );
  });

  it("requires explicit wiring on non-mainnet deployments", () => {
    withEnv(
      {
        AGI_TOKEN_ADDRESS: "",
        AGI_ENS_REGISTRY: "",
        AGI_NAMEWRAPPER: "",
        AGI_CLUB_ROOT_NODE: "",
        AGI_ALPHA_CLUB_ROOT_NODE: "",
        AGI_AGENT_ROOT_NODE: "",
        AGI_ALPHA_AGENT_ROOT_NODE: "",
      },
      () => {
        assert.throws(
          () => resolveDeployConfig("sepolia", 11155111),
          /Missing AGI_TOKEN_ADDRESS/,
        );
      },
    );
  });
});
