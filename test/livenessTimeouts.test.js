const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockERC721 = artifacts.require("MockERC721");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { rootNode } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

async function advanceTime(seconds) {
  await new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [seconds],
        id: Date.now(),
      },
      (error) => {
        if (error) return reject(error);
        resolve();
      }
    );
  });

  await new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        params: [],
        id: Date.now() + 1,
      },
      (error) => {
        if (error) return reject(error);
        resolve();
      }
    );
  });
}

contract("AGIJobManager liveness timeouts", (accounts) => {
  const [owner, employer, agent, validator, moderator, other] = accounts;
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
    await manager.addAGIType(agiType.address, 90, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.addModerator(moderator, { from: owner });

    await manager.setRequiredValidatorApprovals(2, { from: owner });
    await manager.setRequiredValidatorDisapprovals(2, { from: owner });
    await manager.setCompletionReviewPeriod(100, { from: owner });
    await manager.setDisputeReviewPeriod(100, { from: owner });
  });

  async function createJob(payout, duration = 1000) {
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs-job", payout, duration, "details", { from: employer });
    const jobId = tx.logs.find((log) => log.event === "JobCreated").args.jobId.toNumber();
    return jobId;
  }

  it("expires jobs after the deadline when completion was never requested", async () => {
    const payout = toBN(toWei("10"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 100);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    await advanceTime(120);

    const employerBefore = await token.balanceOf(employer);
    await manager.expireJob(jobId, { from: other });
    const employerAfter = await token.balanceOf(employer);
    assert.equal(employerAfter.toString(), employerBefore.add(payout).toString(), "employer should be refunded");

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.expired, true, "job should be marked expired");
    assert.strictEqual(job.completed, false, "job should not be marked completed");

    await expectCustomError(manager.expireJob.call(jobId, { from: other }), "InvalidState");
    await expectCustomError(
      manager.validateJob.call(jobId, "validator", EMPTY_PROOF, { from: validator }),
      "InvalidState"
    );
    await expectCustomError(
      manager.requestJobCompletion.call(jobId, "ipfs-complete", { from: agent }),
      "InvalidState"
    );
  });

  it("rejects expiry before the job deadline", async () => {
    const payout = toBN(toWei("3"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 500);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    await advanceTime(100);
    await expectCustomError(manager.expireJob.call(jobId, { from: other }), "InvalidState");
  });

  it("finalizes completion after the review window when validators are silent", async () => {
    const payout = toBN(toWei("25"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await advanceTime(120);

    const agentBefore = await token.balanceOf(agent);
    await manager.finalizeJob(jobId, { from: agent });
    const agentAfter = await token.balanceOf(agent);

    const expected = payout.muln(90).divn(100);
    assert.equal(agentAfter.sub(agentBefore).toString(), expected.toString(), "agent should be paid after finalization");

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.completed, true, "job should be completed");
    assert.strictEqual(job.disputed, false, "job should not be disputed");

    await expectCustomError(manager.finalizeJob.call(jobId, { from: agent }), "InvalidState");
  });

  it("rejects finalize before the review window elapses", async () => {
    const payout = toBN(toWei("4"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await advanceTime(50);
    await expectCustomError(manager.finalizeJob.call(jobId, { from: agent }), "InvalidState");
  });

  it("finalizes in favor of the agent when validators lean positive", async () => {
    const payout = toBN(toWei("5"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await advanceTime(120);

    const agentBefore = await token.balanceOf(agent);
    await manager.finalizeJob(jobId, { from: other });
    const agentAfter = await token.balanceOf(agent);
    const expected = payout.muln(90).divn(100);
    assert.equal(agentAfter.sub(agentBefore).toString(), expected.toString(), "agent should be paid");
  });

  it("finalizes in favor of the employer when validators lean negative", async () => {
    const payout = toBN(toWei("6"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.disapproveJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await advanceTime(120);

    const employerBefore = await token.balanceOf(employer);
    await manager.finalizeJob(jobId, { from: other });
    const employerAfter = await token.balanceOf(employer);
    assert.equal(employerAfter.sub(employerBefore).toString(), payout.toString(), "employer should be refunded");

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.completed, true, "job should be completed after refund");
  });

  it("rejects expiry after completion was requested and blocks finalize when disputed", async () => {
    const payout = toBN(toWei("7"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 100);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await advanceTime(120);
    await expectCustomError(manager.expireJob.call(jobId, { from: other }), "InvalidState");

    await manager.disputeJob(jobId, { from: employer });
    await advanceTime(120);
    await expectCustomError(manager.finalizeJob.call(jobId, { from: agent }), "InvalidState");
  });

  it("allows the owner to resolve stale disputes only after the dispute review period", async () => {
    const payout = toBN(toWei("9"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-stale", { from: agent });
    await manager.disputeJob(jobId, { from: employer });

    await manager.pause({ from: owner });
    await advanceTime(120);

    const employerBefore = await token.balanceOf(employer);
    await manager.resolveStaleDispute(jobId, true, { from: owner });
    const employerAfter = await token.balanceOf(employer);

    assert.equal(employerAfter.sub(employerBefore).toString(), payout.toString(), "employer should be refunded");
    const job = await manager.jobs(jobId);
    assert.strictEqual(job.completed, true, "job should be completed after timeout resolution");
    assert.strictEqual(job.disputed, false, "job should no longer be disputed");
  });
});
