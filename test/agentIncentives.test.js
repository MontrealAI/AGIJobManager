const assert = require("assert");

const { expectRevert, time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { computeAgentBond } = require("./helpers/bonds");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager agent incentives", (accounts) => {
  const [owner, employer, agent] = accounts;
  let token;
  let manager;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 80, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });
  });

  const createJob = async (payout) => {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const receipt = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    return receipt.logs[0].args.jobId.toNumber();
  };

  const fundAgentBond = async (payout) => {
    const bond = await computeAgentBond(manager, payout);
    if (bond.gt(toBN(0))) {
      await token.mint(agent, bond, { from: owner });
      await token.approve(manager.address, bond, { from: agent });
    }
    return bond;
  };

  it("refunds agent bonds on agent wins and clears active job count", async () => {
    const payout = toBN(toWei("10"));
    const jobId = await createJob(payout);
    const bond = await fundAgentBond(payout);

    const agentBalanceBefore = await token.balanceOf(agent);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    const agentBalanceAfterApply = await token.balanceOf(agent);
    assert.equal(
      agentBalanceBefore.sub(agentBalanceAfterApply).toString(),
      bond.toString(),
      "bond should be transferred on assignment"
    );

    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await time.increase(2);
    await manager.finalizeJob(jobId, { from: employer });

    const locked = await manager.lockedAgentBonds();
    assert.equal(locked.toString(), "0", "agent bonds should be unlocked on completion");
    assert.equal((await manager.activeJobsByAgent(agent)).toString(), "0", "active jobs should decrement");

    const agentPayout = payout.muln(80).divn(100);
    const agentBalanceAfterFinalize = await token.balanceOf(agent);
    assert.equal(
      agentBalanceAfterFinalize.sub(agentBalanceAfterApply).toString(),
      agentPayout.add(bond).toString(),
      "agent should receive payout plus bond refund"
    );
  });

  it("slashes bonds and refunds escrow when agents abandon jobs", async () => {
    const payout = toBN(toWei("12"));
    const jobId = await createJob(payout);
    const bond = await fundAgentBond(payout);

    const employerBefore = await token.balanceOf(employer);
    const agentBefore = await token.balanceOf(agent);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    await manager.abandonJob(jobId, { from: agent });

    const employerAfter = await token.balanceOf(employer);
    const agentAfter = await token.balanceOf(agent);
    assert.equal(
      employerAfter.sub(employerBefore).toString(),
      payout.add(bond).toString(),
      "employer should receive escrow plus slashed bond"
    );
    assert.equal(
      agentBefore.sub(agentAfter).toString(),
      bond.toString(),
      "agent should lose the slashed bond"
    );
    assert.equal((await manager.lockedAgentBonds()).toString(), "0", "bond should be cleared");
    assert.equal((await manager.activeJobsByAgent(agent)).toString(), "0", "active jobs should decrement");
  });

  it("enforces the per-agent active job cap", async () => {
    const payout = toBN(toWei("5"));
    const jobIdOne = await createJob(payout);
    const jobIdTwo = await createJob(payout);
    await fundAgentBond(payout);

    await manager.applyForJob(jobIdOne, "agent", EMPTY_PROOF, { from: agent });
    await expectCustomError(
      manager.applyForJob.call(jobIdTwo, "agent", EMPTY_PROOF, { from: agent }),
      "InvalidState"
    );
  });

  it("prevents abandoning after completion is requested", async () => {
    const payout = toBN(toWei("6"));
    const jobId = await createJob(payout);
    await fundAgentBond(payout);

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await expectCustomError(manager.abandonJob.call(jobId, { from: agent }), "InvalidState");
  });

  it("rejects abandon attempts by non-assigned callers", async () => {
    const payout = toBN(toWei("6"));
    const jobId = await createJob(payout);
    await expectRevert.unspecified(manager.abandonJob(jobId, { from: employer }));
  });
});
