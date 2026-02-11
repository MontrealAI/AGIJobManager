const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockRescueERC20 = artifacts.require("MockRescueERC20");
const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

contract("AGIJobManager rescue hardening", (accounts) => {
  const [owner, employer] = accounts;
  const ZERO32 = "0x" + "00".repeat(32);

  async function deployManager(token) {
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    return AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        wrapper.address,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32
      ),
      { from: owner }
    );
  }




  it("rescueERC20 rejects AGI token so escrow exits stay on withdrawAGI", async () => {
    const agi = await MockERC20.new({ from: owner });
    const manager = await deployManager(agi);

    await agi.mint(employer, web3.utils.toWei("10"), { from: owner });
    await agi.approve(manager.address, web3.utils.toWei("10"), { from: employer });
    await manager.createJob("ipfs://spec", web3.utils.toWei("10"), 1000, "details", { from: employer });

    await expectCustomError(
      manager.rescueERC20.call(agi.address, "1", { from: owner }),
      "InvalidParameters"
    );
  });

  it("rescueERC20 transfers arbitrary non-AGI tokens", async () => {
    const agi = await MockERC20.new({ from: owner });
    const manager = await deployManager(agi);
    const stray = await MockRescueERC20.new({ from: owner });

    await stray.mint(manager.address, 25, { from: owner });
    await manager.rescueERC20(stray.address, 25, { from: owner });
    assert.equal((await stray.balanceOf(owner)).toString(), "25");
  });


});
