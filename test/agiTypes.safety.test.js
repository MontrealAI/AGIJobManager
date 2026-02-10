const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");
const MockNoSupportsInterface = artifacts.require("MockNoSupportsInterface");
const MockRevertingBalanceOf = artifacts.require("MockBrokenERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);

contract("AGIJobManager AGI type safety", (accounts) => {
  const [owner, user] = accounts;

  async function deploy() {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    return AGIJobManager.new(...buildInitConfig(token.address, "ipfs://base", ens.address, wrapper.address, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT), { from: owner });
  }

  it("rejects invalid AGI type addresses and non-ERC721 contracts", async () => {
    const manager = await deploy();
    await expectCustomError(manager.addAGIType.call("0x0000000000000000000000000000000000000000", 50, { from: owner }), "InvalidParameters");
    await expectCustomError(manager.addAGIType.call(user, 50, { from: owner }), "InvalidParameters");

    const non721 = await MockNoSupportsInterface.new({ from: owner });
    await expectCustomError(manager.addAGIType.call(non721.address, 50, { from: owner }), "InvalidParameters");
  });

  it("ignores disabled and misbehaving AGI types when computing payout tiers", async () => {
    const manager = await deploy();
    const good = await MockERC721.new({ from: owner });
    const bad = await MockRevertingBalanceOf.new({ from: owner });

    await manager.addAGIType(good.address, 60, { from: owner });
    await manager.addAGIType(bad.address, 90, { from: owner });
    await manager.disableAGIType(bad.address, { from: owner });

    await good.mint(user, { from: owner });
    const payoutPct = await manager.getHighestPayoutPercentage(user);
    assert.equal(payoutPct.toString(), "60", "disabled/reverting AGI type must not brick lookup");
  });
});
