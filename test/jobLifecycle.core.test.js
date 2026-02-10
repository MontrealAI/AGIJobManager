const assert = require("assert");
const { expectRevert, time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");
const { fundAgents, fundValidators } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager lifecycle core", (accounts) => {
  const [owner, employer, agent, validatorA, validatorB] = accounts;
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
      ZERO_ROOT
    ), { from: owner });

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 80, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validatorA, { from: owner });
    await manager.addAdditionalValidator(validatorB, { from: owner });
    await manager.setRequiredValidatorApprovals(2, { from: owner });
    await manager.setRequiredValidatorDisapprovals(2, { from: owner });
    await manager.setVoteQuorum(2, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });

    await fundAgents(token, manager, [agent], owner);
    await fundValidators(token, manager, [validatorA, validatorB], owner);
  });

  async function createJob(payout, duration = 1000) {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs://job", payout, duration, "details", { from: employer });
    return tx.logs[0].args.jobId.toNumber();
  }

  it("validates create/apply/request/finalize transitions with challenge-window gating", async () => {
    const payout = toBN(toWei("7"));
    await expectCustomError(
      manager.createJob.call("", payout, 1000, "details", { from: employer }),
      "InvalidParameters"
    );

    const jobId = await createJob(payout, 1200);
    assert.equal((await manager.lockedEscrow()).toString(), payout.toString());

    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs://completion", { from: agent });

    await manager.validateJob(jobId, "", EMPTY_PROOF, { from: validatorA });
    await manager.validateJob(jobId, "", EMPTY_PROOF, { from: validatorB });

    await expectCustomError(manager.finalizeJob.call(jobId, { from: employer }), "InvalidState");
    await time.increase(2);
    await manager.finalizeJob(jobId, { from: employer });

    const job = await manager.getJobCore(jobId);
    assert.equal(job.completed, true, "job should settle as completed");
    assert.equal((await manager.lockedEscrow()).toString(), "0", "escrow must unlock at terminal settlement");
  });

  it("forces dispute on tie/under-quorum and supports expiry path", async () => {
    const payoutA = toBN(toWei("5"));
    const payoutB = toBN(toWei("6"));
    const tieJobId = await createJob(payoutA, 1000);
    const expireJobId = await createJob(payoutB, 1);

    await manager.applyForJob(tieJobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(tieJobId, "ipfs://c1", { from: agent });
    await manager.validateJob(tieJobId, "", EMPTY_PROOF, { from: validatorA });
    await manager.disapproveJob(tieJobId, "", EMPTY_PROOF, { from: validatorB });
    await time.increase(2);
    await manager.finalizeJob(tieJobId, { from: employer });
    const tieJob = await manager.getJobCore(tieJobId);
    assert.equal(tieJob.disputed, true, "under-quorum/tie should force dispute");

    await manager.applyForJob(expireJobId, "", EMPTY_PROOF, { from: agent });
    await time.increase(3);
    await manager.expireJob(expireJobId, { from: employer });
    const expired = await manager.getJobCore(expireJobId);
    assert.equal(expired.expired, true, "expiry branch should mark job expired");
  });
});
