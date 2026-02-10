const assert = require("assert");
const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");
const { fundAgents, fundDisputeBond } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager disputes moderator paths", (accounts) => {
  const [owner, employer, agent, moderator, outsider] = accounts;
  let manager;
  let token;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    manager = await AGIJobManager.new(...buildInitConfig(token.address, "ipfs://base", ens.address, nameWrapper.address, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT), { from: owner });

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 90, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addModerator(moderator, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });
    await manager.setDisputeReviewPeriod(1, { from: owner });

    await fundAgents(token, manager, [agent], owner);
  });

  async function createDisputedJob(payout) {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs://job", payout, 1000, "details", { from: employer });
    const jobId = tx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs://done", { from: agent });
    await fundDisputeBond(token, manager, employer, payout, owner);
    await manager.disputeJob(jobId, { from: employer });
    return jobId;
  }

  it("enforces moderator access, NO_ACTION semantics, and stale resolution", async () => {
    const payout = toBN(toWei("10"));
    const jobId = await createDisputedJob(payout);

    await expectCustomError(
      manager.resolveDisputeWithCode.call(jobId, 0, "no-op", { from: outsider }),
      "NotModerator"
    );

    await manager.resolveDisputeWithCode(jobId, 0, "no-op", { from: moderator });
    let core = await manager.getJobCore(jobId);
    assert.equal(core.disputed, true, "NO_ACTION keeps dispute active");

    await time.increase(2);
    await manager.resolveStaleDispute(jobId, true, { from: owner });
    core = await manager.getJobCore(jobId);
    assert.equal(core.disputed, false, "stale dispute should be closable");
  });

  it("applies explicit employer/agent outcomes via resolveDisputeWithCode", async () => {
    const payout = toBN(toWei("12"));
    const agentWinJob = await createDisputedJob(payout);
    await manager.resolveDisputeWithCode(agentWinJob, 1, "agent wins", { from: moderator });
    let settled = await manager.getJobCore(agentWinJob);
    assert.equal(settled.completed, true);

    const employerWinJob = await createDisputedJob(payout);
    await manager.resolveDisputeWithCode(employerWinJob, 2, "employer wins", { from: moderator });
    settled = await manager.getJobCore(employerWinJob);
    assert.equal(settled.completed, true);
  });
});
