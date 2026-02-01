const assert = require("assert");
const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { rootNode } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager dispute hardening", (accounts) => {
  const [owner, employer, agent, validatorA, validatorB] = accounts;
  let token;
  let manager;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      rootNode("club-root"),
      rootNode("agent-root"),
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 92, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validatorA, { from: owner });
    await manager.addAdditionalValidator(validatorB, { from: owner });
  });

  async function createAssignedJob(payout) {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs-job", payout, 1000, "details", { from: employer });
    const jobId = tx.logs.find((log) => log.event === "JobCreated").args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    return jobId;
  }

  async function requestCompletion(jobId, uri = "ipfs-complete") {
    await manager.requestJobCompletion(jobId, uri, { from: agent });
  }

  it("freezes validator voting once disputed", async () => {
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });

    const payout = toBN(toWei("10"));
    const jobId = await createAssignedJob(payout);
    await requestCompletion(jobId);

    await manager.disapproveJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    const job = await manager.jobs(jobId);
    assert.strictEqual(job.disputed, true, "job should be disputed after threshold");

    await expectCustomError(
      manager.validateJob.call(jobId, "validator-b", EMPTY_PROOF, { from: validatorB }),
      "InvalidState"
    );
    await expectCustomError(
      manager.disapproveJob.call(jobId, "validator-b", EMPTY_PROOF, { from: validatorB }),
      "InvalidState"
    );
  });

  it("prevents validator completion once disputed", async () => {
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });

    const payout = toBN(toWei("11"));
    const jobId = await createAssignedJob(payout);
    await requestCompletion(jobId);

    await manager.disapproveJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    await expectCustomError(
      manager.validateJob.call(jobId, "validator-b", EMPTY_PROOF, { from: validatorB }),
      "InvalidState"
    );

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.completed, false, "job should not complete while disputed");
  });

  it("only allows disputes after completion request", async () => {
    const payout = toBN(toWei("12"));
    const jobId = await createAssignedJob(payout);

    await expectCustomError(manager.disputeJob.call(jobId, { from: employer }), "InvalidState");
    await expectCustomError(manager.disputeJob.call(jobId, { from: agent }), "InvalidState");

    await requestCompletion(jobId, "ipfs-complete");
    await manager.disputeJob(jobId, { from: employer });

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.disputed, true, "job should be disputed after completion request");
  });

  it("allows owner stale dispute resolution to complete agent wins", async () => {
    await manager.setDisputeReviewPeriod(1, { from: owner });

    const payout = toBN(toWei("13"));
    const jobId = await createAssignedJob(payout);
    await requestCompletion(jobId);
    await manager.disputeJob(jobId, { from: employer });

    await time.increase(2);
    await manager.pause({ from: owner });

    await manager.resolveStaleDispute(jobId, false, { from: owner });

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.completed, true, "job should complete on stale dispute resolution");
    assert.strictEqual(job.disputed, false, "dispute should clear after resolution");

    const agentBalance = await token.balanceOf(agent);
    const expectedPayout = payout.muln(92).divn(100);
    assert.equal(agentBalance.toString(), expectedPayout.toString(), "agent should be paid on agent win");
    assert.equal((await manager.lockedEscrow()).toString(), "0", "escrow should be released");
    assert.equal((await manager.nextTokenId()).toNumber(), 1, "job NFT should be minted");
  });

  it("allows owner stale dispute resolution to refund employers", async () => {
    await manager.setDisputeReviewPeriod(1, { from: owner });

    const payout = toBN(toWei("14"));
    const jobId = await createAssignedJob(payout);
    await requestCompletion(jobId);
    await manager.disputeJob(jobId, { from: employer });

    await time.increase(2);
    await manager.pause({ from: owner });

    const employerBefore = await token.balanceOf(employer);
    await manager.resolveStaleDispute(jobId, true, { from: owner });
    const employerAfter = await token.balanceOf(employer);

    assert.equal(employerAfter.sub(employerBefore).toString(), payout.toString(), "employer should be refunded");
    const job = await manager.jobs(jobId);
    assert.strictEqual(job.completed, true, "job should close on employer-win stale resolution");
    assert.strictEqual(job.disputed, false, "dispute should clear after employer win");
    assert.equal((await token.balanceOf(manager.address)).toString(), "0", "escrow should be released");
  });
});
