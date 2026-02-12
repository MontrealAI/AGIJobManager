const assert = require("assert");

const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { fundAgents } = require("./helpers/bonds");

contract("AGIJobManager platform revenue", (accounts) => {
  const [owner, employer, agent] = accounts;
  const ZERO32 = "0x" + "00".repeat(32);
  const EMPTY_PROOF = [];

  async function deployManager(agentPct) {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "",
        ens.address,
        nameWrapper.address,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32
      ),
      { from: owner }
    );
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, agentPct, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await fundAgents(token, manager, [agent], owner);
    return { token, manager };
  }

  async function completeJob(manager, token, payout) {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs://spec.json", payout, 50, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs://completion.json", { from: agent });

    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
    const finalizeTx = await manager.finalizeJob(jobId, { from: employer });
    return { jobId, finalizeTx };
  }

  it("retains settlement remainder in treasury on agent win", async () => {
    const agentPct = 60;
    const { token, manager } = await deployManager(agentPct);
    const payout = web3.utils.toBN(web3.utils.toWei("101"));

    const managerBalanceBefore = await token.balanceOf(manager.address);
    const { jobId } = await completeJob(manager, token, payout);

    const validationPct = await manager.validationRewardPercentage();
    const expectedRetained = payout
      .sub(payout.muln(agentPct).divn(100))
      .sub(payout.mul(validationPct).divn(100));

    assert.equal(jobId, 0, "jobId should match");
    const managerBalanceAfter = await token.balanceOf(manager.address);
    assert.equal(managerBalanceAfter.sub(managerBalanceBefore).toString(), expectedRetained.toString(), "retained amount mismatch");
  });

  it("does not retain extra treasury balance when retained remainder is zero", async () => {
    const agentPct = 92;
    const { token, manager } = await deployManager(agentPct);
    const payout = web3.utils.toBN(web3.utils.toWei("100"));

    const managerBalanceBefore = await token.balanceOf(manager.address);
    await completeJob(manager, token, payout);
    const managerBalanceAfter = await token.balanceOf(manager.address);
    assert.equal(managerBalanceAfter.sub(managerBalanceBefore).toString(), "0");
  });
});
