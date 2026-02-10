const { expectRevert } = require("@openzeppelin/test-helpers");
const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { fundAgents } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager pause & settlement pause access", (accounts) => {
  const [owner, employer, agent] = accounts;

  it("enforces whenNotPaused and settlement pause rules", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, "ipfs://base", ens.address, wrapper.address, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT), { from: owner });
    const nft = await MockERC721.new({ from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAGIType(nft.address, 80, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await fundAgents(token, manager, [agent], owner);

    const payout = toBN(toWei("4"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.pause({ from: owner });
    await expectRevert.unspecified(manager.createJob("ipfs://job", payout, 1000, "details", { from: employer }));

    await manager.unpause({ from: owner });
    const tx = await manager.createJob("ipfs://job", payout, 1000, "details", { from: employer });
    const jobId = tx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });

    await manager.setSettlementPaused(true, { from: owner });
    await expectRevert.unspecified(manager.expireJob(jobId, { from: employer }));

    await manager.pause({ from: owner });
    await manager.setSettlementPaused(false, { from: owner });
    await expectRevert.unspecified(manager.withdrawAGI(toBN(1), { from: owner }));
  });
});
