const assert = require("assert");
const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockERC721 = artifacts.require("MockERC721");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");
const { fundAgents, computeDisputeBond } = require("./helpers/bonds");

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
    await manager.addAGIType(agiType.address, 25, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addModerator(moderator, { from: owner });
    await fundAgents(token, manager, [agent], owner);
  });

  async function fundEmployerDisputeBond(payout) {
    const disputeBond = await computeDisputeBond(manager, payout);
    await token.mint(employer, disputeBond, { from: owner });
    await token.approve(manager.address, disputeBond, { from: employer });
    return disputeBond;
  }

  it("tracks canonical job lifecycle flags", async () => {
    const payout = web3.utils.toBN(toWei("5"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    let job = await manager.getJobCore(jobId);
    let jobValidation = await manager.getJobValidation(jobId);
    assert.strictEqual(job.completed, false, "new job should not be completed");
    assert.strictEqual(job.disputed, false, "new job should not be disputed");
    assert.strictEqual(jobValidation.completionRequested, false, "new job should not be completion requested");

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    job = await manager.getJobCore(jobId);
    assert.strictEqual(job.assignedAgent, agent, "assigned job should set agent");

    await manager.requestJobCompletion(jobId, "ipfs-completed", { from: agent });
    jobValidation = await manager.getJobValidation(jobId);
    assert.strictEqual(jobValidation.completionRequested, true, "completion request should be recorded");

    await fundEmployerDisputeBond(payout);
    await manager.disputeJob(jobId, { from: employer });
    job = await manager.getJobCore(jobId);
    assert.strictEqual(job.disputed, true, "disputed job should be flagged");

    await manager.resolveDispute(jobId, "agent win", { from: moderator });
    job = await manager.getJobCore(jobId);
    assert.strictEqual(job.completed, true, "resolved job should be completed");
  });

  it("marks cancelled jobs and rejects out-of-range status", async () => {
    const payout = toWei("2");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.cancelJob(jobId, { from: employer });
    await expectCustomError(manager.getJobCore.call(jobId), "JobNotFound");
    await expectCustomError(manager.getJobCore.call(999), "JobNotFound");
  });

  it("marks expired jobs when expireJob is called", async () => {
    const payout = toWei("1");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs-job", payout, 5, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await time.increase(6);
    await manager.expireJob(jobId);
    const job = await manager.getJobCore(jobId);
    assert.strictEqual(job.expired, true, "expired jobs should be flagged");
  });
});
