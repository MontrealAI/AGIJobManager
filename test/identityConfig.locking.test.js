const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");
const { fundAgents } = require("./helpers/bonds");

const ZERO = "0x" + "00".repeat(32);

contract("AGIJobManager identity configuration locking", (accounts) => {
  const [owner, employer, agent] = accounts;

  it("rejects identity config updates while obligations are locked and after permanent lock", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, "ipfs://base", ens.address, wrapper.address, ZERO, ZERO, ZERO, ZERO, ZERO, ZERO), { from: owner });

    const nft = await MockERC721.new({ from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAGIType(nft.address, 80, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await fundAgents(token, manager, [agent], owner);

    const payout = web3.utils.toWei("3");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs://job", payout, 1000, "details", { from: employer });

    await expectCustomError(manager.updateAGITokenAddress.call(token.address, { from: owner }), "InvalidState");

    await manager.cancelJob(0, { from: employer });
    await manager.updateAGITokenAddress(token.address, { from: owner });

    await manager.lockIdentityConfiguration({ from: owner });
    await expectCustomError(manager.setEnsJobPages.call(ens.address, { from: owner }), "ConfigLocked");
    assert.equal(await manager.lockIdentityConfig(), true);
  });
});
