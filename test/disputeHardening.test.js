const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { expectCustomError } = require("./helpers/errors");
const { AGENT_ROOT_NODE, CLUB_ROOT_NODE } = require("./helpers/constants");
const { AGI_TOKEN_ADDRESS, createFixedTokenManager } = require("./helpers/fixedToken");

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

contract("AGIJobManager dispute hardening", (accounts) => {
  const [owner, employer, agent, validatorA, validatorB, validatorC] = accounts;
  let token;
  let manager;
  let fixedToken;

  before(async () => {
    fixedToken = await createFixedTokenManager(MockERC20);
  });

  beforeEach(async () => {
    token = await fixedToken.reset();
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(
      AGI_TOKEN_ADDRESS,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      CLUB_ROOT_NODE,
      AGENT_ROOT_NODE,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 90, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validatorA, { from: owner });
    await manager.addAdditionalValidator(validatorB, { from: owner });
    await manager.addAdditionalValidator(validatorC, { from: owner });

    await manager.setRequiredValidatorApprovals(2, { from: owner });
    await manager.setRequiredValidatorDisapprovals(2, { from: owner });
    await manager.setDisputeReviewPeriod(100, { from: owner });
  });

  async function createJob(payout) {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs-job", payout, 1000, "details", { from: employer });
    return tx.logs.find((log) => log.event === "JobCreated").args.jobId.toNumber();
  }

  async function setupCompletion(payout) {
    const jobId = await createJob(payout);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-completed", { from: agent });
    return jobId;
  }

  it("freezes validator voting once disputed", async () => {
    const payout = toBN(toWei("10"));
    const jobId = await setupCompletion(payout);

    await manager.disapproveJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    await manager.disapproveJob(jobId, "validator-b", EMPTY_PROOF, { from: validatorB });

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.disputed, true, "job should be disputed");

    await expectCustomError(
      manager.validateJob.call(jobId, "validator-c", EMPTY_PROOF, { from: validatorC }),
      "InvalidState"
    );
    await expectCustomError(
      manager.disapproveJob.call(jobId, "validator-c", EMPTY_PROOF, { from: validatorC }),
      "InvalidState"
    );
  });

  it("prevents validator completion after a dispute", async () => {
    const payout = toBN(toWei("12"));
    const jobId = await setupCompletion(payout);

    await manager.disapproveJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    await manager.disapproveJob(jobId, "validator-b", EMPTY_PROOF, { from: validatorB });

    await expectCustomError(
      manager.validateJob.call(jobId, "validator-c", EMPTY_PROOF, { from: validatorC }),
      "InvalidState"
    );

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.completed, false, "job should not be completed");
  });

  it("allows disputes only after completion is requested", async () => {
    const payout = toBN(toWei("8"));
    const jobId = await createJob(payout);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    await expectCustomError(manager.disputeJob.call(jobId, { from: employer }), "InvalidState");
    await expectCustomError(manager.disputeJob.call(jobId, { from: agent }), "InvalidState");

    await manager.requestJobCompletion(jobId, "ipfs-completed", { from: agent });
    await manager.disputeJob(jobId, { from: employer });

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.disputed, true, "job should be disputed after completion request");
  });

  it("resolves stale disputes through the owner recovery path", async () => {
    const payout = toBN(toWei("15"));
    const jobId = await setupCompletion(payout);

    await manager.disputeJob(jobId, { from: employer });
    await advanceTime(120);
    await manager.pause({ from: owner });

    const agentBefore = await token.balanceOf(agent);
    await manager.resolveStaleDispute(jobId, false, { from: owner });
    const agentAfter = await token.balanceOf(agent);

    const expected = payout.muln(90).divn(100);
    assert.equal(agentAfter.sub(agentBefore).toString(), expected.toString(), "agent should be paid");

    const resolvedJob = await manager.jobs(jobId);
    assert.strictEqual(resolvedJob.completed, true, "job should be completed");
    assert.strictEqual(resolvedJob.disputed, false, "dispute should be cleared");

    await manager.unpause({ from: owner });

    const payoutRefund = toBN(toWei("9"));
    const refundJobId = await setupCompletion(payoutRefund);
    await manager.disputeJob(refundJobId, { from: employer });
    await advanceTime(120);
    await manager.pause({ from: owner });

    const employerBefore = await token.balanceOf(employer);
    await manager.resolveStaleDispute(refundJobId, true, { from: owner });
    const employerAfter = await token.balanceOf(employer);

    assert.equal(
      employerAfter.sub(employerBefore).toString(),
      payoutRefund.toString(),
      "employer should be refunded"
    );
  });
});
