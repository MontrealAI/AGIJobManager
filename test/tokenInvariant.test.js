const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC20 = artifacts.require("MockERC20");

const { AGENT_ROOT_NODE, CLUB_ROOT_NODE } = require("./helpers/constants");
const { AGI_TOKEN_ADDRESS, createFixedTokenManager } = require("./helpers/fixedToken");

const ZERO_ROOT = "0x" + "00".repeat(32);

contract("AGIJobManager token invariant", (accounts) => {
  const [owner, outsider] = accounts;
  let fixedToken;

  before(async () => {
    fixedToken = await createFixedTokenManager(MockERC20);
  });

  it("uses the canonical AGI token address", async () => {
    await fixedToken.reset();
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

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

    const tokenAddress = await manager.agiToken();
    assert.equal(tokenAddress, AGI_TOKEN_ADDRESS);
  });

  it("rejects non-canonical token addresses at deploy time", async () => {
    await fixedToken.reset();
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    let reverted = false;
    try {
      await AGIJobManager.new(
        outsider,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        CLUB_ROOT_NODE,
        AGENT_ROOT_NODE,
        ZERO_ROOT,
        ZERO_ROOT,
        { from: owner }
      );
    } catch (error) {
      reverted = true;
    }
    assert.ok(reverted, "expected deployment to revert for non-canonical token");
  });
});
