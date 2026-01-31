const assert = require("assert");
const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toWei } = web3.utils;

contract("AGIJobManager jobStatus", (accounts) => {
  const [owner, employer, agent, moderator] = accounts;
  let token;
  let ens;
  let nameWrapper;
  let manager;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      ZERO_ROOT,
      ZERO_ROOT,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addModerator(moderator, { from: owner });
  });

  it("reports canonical job status transitions", async () => {
    const payout = toWei("5");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    let status = await manager.jobStatus(jobId);
    assert.strictEqual(status.toString(), "1", "new job should be Open");
    let statusString = await manager.jobStatusString(jobId);
    assert.strictEqual(statusString, "Open", "jobStatusString should map Open");

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    status = await manager.jobStatus(jobId);
    assert.strictEqual(status.toString(), "2", "assigned job should be InProgress");

    await manager.requestJobCompletion(jobId, "ipfs-completed", { from: agent });
    status = await manager.jobStatus(jobId);
    assert.strictEqual(status.toString(), "3", "completion request should set CompletionRequested");

    await manager.disputeJob(jobId, { from: employer });
    status = await manager.jobStatus(jobId);
    assert.strictEqual(status.toString(), "4", "disputed job should be Disputed");

    await manager.resolveDispute(jobId, "agent win", { from: moderator });
    status = await manager.jobStatus(jobId);
    assert.strictEqual(status.toString(), "5", "resolved job should be Completed");
  });

  it("marks cancelled jobs and rejects out-of-range status", async () => {
    const payout = toWei("2");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.cancelJob(jobId, { from: employer });
    const status = await manager.jobStatus(jobId);
    assert.strictEqual(status.toString(), "0", "cancelled job should be DeletedOrCancelled");

    await expectCustomError(manager.jobStatus.call(999), "JobNotFound");
  });

  it("computes Expired when assigned jobs pass their duration", async () => {
    const payout = toWei("1");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs-job", payout, 5, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await time.increase(6);

    const status = await manager.jobStatus(jobId);
    assert.strictEqual(status.toString(), "6", "expired jobs should return Expired");
  });
});
