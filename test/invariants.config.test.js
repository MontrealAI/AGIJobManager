const assert = require("assert");
const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const {
  setupAgiToken,
  AGI_TOKEN_ADDRESS,
  CLUB_ROOT_NODE,
  AGENT_ROOT_NODE,
} = require("./helpers/agiToken");

const ZERO_ROOT = "0x" + "00".repeat(32);

async function expectDeploymentFailure(promise) {
  try {
    await promise;
    assert.fail("expected deployment to revert");
  } catch (error) {
    const message = error.message || "";
    assert(
      message.includes("revert") || message.includes("code couldn't be stored") || message.includes("Custom error"),
      `unexpected error: ${message}`
    );
  }
}

contract("AGIJobManager invariants", (accounts) => {
  const [owner] = accounts;
  let ens;
  let nameWrapper;

  beforeEach(async () => {
    await setupAgiToken(MockERC20, accounts);
    ens = await MockENS.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });
  });

  it("rejects deployments with a non-canonical token address", async () => {
    await expectDeploymentFailure(
      AGIJobManager.new(
        "0x0000000000000000000000000000000000000001",
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        CLUB_ROOT_NODE,
        AGENT_ROOT_NODE,
        ZERO_ROOT,
        ZERO_ROOT,
        { from: owner }
      )
    );
  });

  it("rejects deployments with non-canonical root nodes", async () => {
    await expectDeploymentFailure(
      AGIJobManager.new(
        AGI_TOKEN_ADDRESS,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        ZERO_ROOT,
        AGENT_ROOT_NODE,
        ZERO_ROOT,
        ZERO_ROOT,
        { from: owner }
      )
    );
  });

  it("exposes the fixed AGI token address", async () => {
    const manager = await AGIJobManager.new(
      AGI_TOKEN_ADDRESS,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      CLUB_ROOT_NODE,
      AGENT_ROOT_NODE,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );

    const token = await manager.agiToken();
    assert.strictEqual(token, AGI_TOKEN_ADDRESS);
  });
});
