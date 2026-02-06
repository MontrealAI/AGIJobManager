const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockERC721 = artifacts.require("MockERC721");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { rootNode } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");
const { fundValidators, fundAgents, fundDisputeBond, computeAgentBond } = require("./helpers/bonds");

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
  const [owner, employer, agent, validator, moderator, other, validatorTwo, validatorThree] = accounts;
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
        rootNode("club-root"),
        rootNode("agent-root"),
        rootNode("club-root"),
        rootNode("agent-root"),
        ZERO_ROOT,
        ZERO_ROOT,
      ),
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
    await manager.setChallengePeriodAfterApproval(100, { from: owner });

    await fundValidators(token, manager, [validator], owner);
    await fundAgents(token, manager, [agent], owner);
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
    const agentBond = await computeAgentBond(manager, payout, toBN(100));
    assert.equal(
      employerAfter.toString(),
      employerBefore.add(payout).add(agentBond).toString(),
      "employer should be refunded"
    );

    const job = await manager.getJobCore(jobId);
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

  it("0 votes remains live", async () => {
    const payout = toBN(toWei("25"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await advanceTime(120);

    const agentBefore = await token.balanceOf(agent);
    const employerBefore = await token.balanceOf(employer);
    await manager.finalizeJob(jobId, { from: other });
    const agentAfter = await token.balanceOf(agent);
    const employerAfter = await token.balanceOf(employer);
    const agentBond = await computeAgentBond(manager, payout, toBN(1000));
    const validatorBudget = payout.mul(await manager.validationRewardPercentage()).divn(100);
    assert.equal(
      agentAfter.sub(agentBefore).toString(),
      payout.muln(90).divn(100).add(agentBond).toString(),
      "agent should be paid on no-vote finalize"
    );
    assert.equal(
      employerAfter.sub(employerBefore).toString(),
      validatorBudget.toString(),
      "employer should receive validator budget rebate on no-vote finalize"
    );
  });

  it("under-quorum votes cannot flip the slow-path", async () => {
    const payout = toBN(toWei("8"));
    await token.mint(employer, payout, { from: owner });
    await manager.setRequiredValidatorApprovals(3, { from: owner });
    await manager.setRequiredValidatorDisapprovals(3, { from: owner });

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.disapproveJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await advanceTime(120);

    const agentBefore = await token.balanceOf(agent);
    const employerBefore = await token.balanceOf(employer);
    const tx = await manager.finalizeJob(jobId, { from: other });
    const agentAfter = await token.balanceOf(agent);
    const employerAfter = await token.balanceOf(employer);
    const job = await manager.getJobCore(jobId);
    assert.strictEqual(job.disputed, true, "job should dispute on under-quorum finalize");
    assert.strictEqual(employerAfter.toString(), employerBefore.toString(), "employer should not be refunded");
    assert.strictEqual(agentAfter.toString(), agentBefore.toString(), "agent should not be paid on dispute");
    assert.ok(
      tx.logs.some((log) => log.event === "JobDisputed"),
      "JobDisputed should be emitted on under-quorum finalize"
    );
  });

  it("at-quorum ties escalate to dispute", async () => {
    const payout = toBN(toWei("10"));
    await token.mint(employer, payout, { from: owner });
    await manager.setRequiredValidatorApprovals(3, { from: owner });
    await manager.setRequiredValidatorDisapprovals(3, { from: owner });

    await manager.addAdditionalValidator(validatorTwo, { from: owner });
    await manager.addAdditionalValidator(validatorThree, { from: owner });
    await manager.addAdditionalValidator(other, { from: owner });
    await fundValidators(token, manager, [validatorTwo, validatorThree, other], owner);

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await manager.validateJob(jobId, "validatorTwo", EMPTY_PROOF, { from: validatorTwo });
    await manager.disapproveJob(jobId, "validatorThree", EMPTY_PROOF, { from: validatorThree });
    await manager.disapproveJob(jobId, "validatorFour", EMPTY_PROOF, { from: other });
    await advanceTime(120);

    const tx = await manager.finalizeJob(jobId, { from: employer });
    const job = await manager.getJobCore(jobId);
    assert.strictEqual(job.disputed, true, "job should escalate to dispute on at-quorum tie");
    assert.ok(
      tx.logs.some((log) => log.event === "JobDisputed"),
      "JobDisputed should be emitted on at-quorum tie"
    );
  });

  it("at-quorum votes still decide the slow-path", async () => {
    const payout = toBN(toWei("11"));
    await token.mint(employer, payout, { from: owner });
    await manager.setRequiredValidatorApprovals(3, { from: owner });
    await manager.setRequiredValidatorDisapprovals(3, { from: owner });

    await manager.addAdditionalValidator(validatorTwo, { from: owner });
    await manager.addAdditionalValidator(validatorThree, { from: owner });
    await fundValidators(token, manager, [validatorTwo, validatorThree], owner);

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await manager.disapproveJob(jobId, "validatorTwo", EMPTY_PROOF, { from: validatorTwo });
    await manager.disapproveJob(jobId, "validatorThree", EMPTY_PROOF, { from: validatorThree });
    await advanceTime(120);

    const agentBefore = await token.balanceOf(agent);
    const employerBefore = await token.balanceOf(employer);
    await manager.finalizeJob(jobId, { from: other });
    const agentAfter = await token.balanceOf(agent);
    const employerAfter = await token.balanceOf(employer);
    assert.strictEqual(agentAfter.toString(), agentBefore.toString(), "agent should not be paid");
    assert.ok(employerAfter.gt(employerBefore), "employer should be refunded when disapprovals win");
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

  it("rejects finalize once a dispute is raised", async () => {
    const payout = toBN(toWei("9"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await fundDisputeBond(token, manager, employer, payout, owner);
    await manager.disputeJob(jobId, { from: employer });
    await advanceTime(120);

    await expectCustomError(manager.finalizeJob.call(jobId, { from: other }), "InvalidState");
  });

  it("finalizes in favor of the agent when validators lean positive", async () => {
    const payout = toBN(toWei("5"));
    await token.mint(employer, payout, { from: owner });
    await manager.addAdditionalValidator(validatorTwo, { from: owner });
    await fundValidators(token, manager, [validatorTwo], owner);

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await manager.validateJob(jobId, "validatorTwo", EMPTY_PROOF, { from: validatorTwo });
    await advanceTime(120);

    const agentBefore = await token.balanceOf(agent);
    await manager.finalizeJob(jobId, { from: other });
    const agentAfter = await token.balanceOf(agent);
    const agentBond = await computeAgentBond(manager, payout, toBN(1000));
    const expected = payout.muln(90).divn(100).add(agentBond);
    assert.equal(agentAfter.sub(agentBefore).toString(), expected.toString(), "agent should be paid");
  });

  it("finalizes in favor of the employer when validators lean negative", async () => {
    const payout = toBN(toWei("6"));
    await token.mint(employer, payout, { from: owner });
    await manager.setRequiredValidatorApprovals(2, { from: owner });
    await manager.setRequiredValidatorDisapprovals(3, { from: owner });
    await manager.addAdditionalValidator(validatorTwo, { from: owner });
    await fundValidators(token, manager, [validatorTwo], owner);

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    const validatorBefore = await token.balanceOf(validator);
    const validatorTwoBefore = await token.balanceOf(validatorTwo);
    await manager.disapproveJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await manager.disapproveJob(jobId, "validatorTwo", EMPTY_PROOF, { from: validatorTwo });
    await advanceTime(120);

    const employerBefore = await token.balanceOf(employer);
    await manager.finalizeJob(jobId, { from: other });
    const employerAfter = await token.balanceOf(employer);
    const validationPct = await manager.validationRewardPercentage();
    const validatorReward = payout.mul(validationPct).divn(100);
    const agentBond = await computeAgentBond(manager, payout, toBN(1000));
    assert.equal(
      employerAfter.sub(employerBefore).toString(),
      payout.sub(validatorReward).add(agentBond).toString(),
      "employer should be refunded minus validator reward plus agent bond"
    );
    const validatorAfter = await token.balanceOf(validator);
    const validatorTwoAfter = await token.balanceOf(validatorTwo);
    assert.equal(
      validatorAfter.sub(validatorBefore).toString(),
      validatorReward.divn(2).toString(),
      "disapproving validator should be rewarded on employer win"
    );
    assert.equal(
      validatorTwoAfter.sub(validatorTwoBefore).toString(),
      validatorReward.divn(2).toString(),
      "second disapproving validator should be rewarded on employer win"
    );

    const job = await manager.getJobCore(jobId);
    assert.strictEqual(job.completed, true, "job should be completed after refund");
  });

  it("rejects expiry after completion was requested and blocks finalize when disputed", async () => {
    const payout = toBN(toWei("7"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 100);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await expectCustomError(manager.expireJob.call(jobId, { from: other }), "InvalidState");

    await fundDisputeBond(token, manager, employer, payout, owner);
    await manager.disputeJob(jobId, { from: employer });
    await advanceTime(120);
    await expectCustomError(manager.finalizeJob.call(jobId, { from: agent }), "InvalidState");
  });

  it("rejects disputes after the completion review window", async () => {
    const payout = toBN(toWei("8"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await advanceTime(120);
    await fundDisputeBond(token, manager, employer, payout, owner);
    await expectCustomError(manager.disputeJob.call(jobId, { from: employer }), "InvalidState");
  });

  it("allows the owner to resolve stale disputes only after the dispute review period", async () => {
    const payout = toBN(toWei("9"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, 1000);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    const disputeBond = await fundDisputeBond(token, manager, employer, payout, owner);
    await manager.disputeJob(jobId, { from: employer });

    await advanceTime(120);

    const employerBefore = await token.balanceOf(employer);
    await manager.resolveStaleDispute(jobId, true, { from: owner });
    const employerAfter = await token.balanceOf(employer);

    const agentBond = await computeAgentBond(manager, payout, toBN(1000));
    assert.equal(
      employerAfter.sub(employerBefore).toString(),
      payout.add(agentBond).add(disputeBond).toString(),
      "employer should be refunded"
    );
    const job = await manager.getJobCore(jobId);
    assert.strictEqual(job.completed, true, "job should be completed after timeout resolution");
    assert.strictEqual(job.disputed, false, "job should no longer be disputed");
  });
});
