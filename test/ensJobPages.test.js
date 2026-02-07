const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockENSJobPages = artifacts.require("MockENSJobPages");

const { buildInitConfig } = require("./helpers/deploy");
const { namehash } = require("./helpers/ens");
const { time } = require("@openzeppelin/test-helpers");

const ZERO_ROOT = "0x" + "00".repeat(32);

contract("ENS job page hooks", (accounts) => {
  const [owner, employer, agent, moderator] = accounts;
  let token;
  let manager;
  let ensJobPages;
  let agiTypeNft;

  const payout = web3.utils.toWei("10");

  async function createJob() {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs://spec", payout, 3600, "details", { from: employer });
    return { jobId: tx.logs[0].args.jobId.toNumber(), tx };
  }

  async function applyForJob(jobId) {
    await token.mint(agent, web3.utils.toWei("5"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("5"), { from: agent });
    return manager.applyForJob(jobId, "helper", [], { from: agent });
  }

  async function requestCompletion(jobId) {
    return manager.requestJobCompletion(jobId, "ipfs://completion", { from: agent });
  }

  async function finalize(jobId) {
    await time.increase(2);
    return manager.finalizeJob(jobId, { from: employer });
  }

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    ensJobPages = await MockENSJobPages.new({ from: owner });
    agiTypeNft = await MockERC721.new({ from: owner });

    manager = await AGIJobManager.new(...buildInitConfig(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      namehash("club.agi.eth"),
      namehash("agent.agi.eth"),
      namehash("alpha.club.agi.eth"),
      namehash("alpha.agent.agi.eth"),
      ZERO_ROOT,
      ZERO_ROOT
    ), { from: owner });

    await manager.addAGIType(agiTypeNft.address, 50, { from: owner });
    await agiTypeNft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.setEnsJobPages(ensJobPages.address, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });
  });

  it("calls ENS job page hooks on create/apply/completion request", async () => {
    const { jobId } = await createJob();
    const lastJobId = (await ensJobPages.lastJobId()).toNumber();
    const lastHook = (await ensJobPages.lastHook()).toNumber();
    const lastEmployer = await ensJobPages.lastEmployer();
    assert.equal(lastJobId, jobId, "create hook should record jobId");
    assert.equal(lastHook, 1, "create hook should be recorded");
    assert.equal(lastEmployer, employer, "create hook should record employer");

    await applyForJob(jobId);
    const assignHook = (await ensJobPages.lastHook()).toNumber();
    const assignAgent = await ensJobPages.lastAgent();
    assert.equal(assignHook, 2, "assign hook should be recorded");
    assert.equal(assignAgent, agent, "assign hook should record agent");

    await requestCompletion(jobId);
  });

  it("does not block lifecycle when ENS job page hook reverts", async () => {
    await ensJobPages.setShouldRevert(true, { from: owner });
    const { jobId } = await createJob();
    const lastHook = (await ensJobPages.lastHook()).toNumber();
    assert.equal(lastHook, 0, "create hook should not update state on failure");

    await applyForJob(jobId);
    await requestCompletion(jobId);
    await finalize(jobId);
    const job = await manager.getJobCore(jobId);
    assert.equal(job.completed, true, "job should complete even if hooks fail");
  });

  it("attempts revokePermissions on completion and employer-win dispute", async () => {
    const { jobId } = await createJob();
    await applyForJob(jobId);
    await requestCompletion(jobId);
    await finalize(jobId);
    const revokeHook = (await ensJobPages.lastHook()).toNumber();
    assert.equal(revokeHook, 3, "revoke hook should be recorded on completion");

    const { jobId: disputeJobId } = await createJob();
    await applyForJob(disputeJobId);
    await requestCompletion(disputeJobId);
    await token.mint(employer, web3.utils.toWei("5"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("5"), { from: employer });
    await manager.disputeJob(disputeJobId, { from: employer });
    await manager.addModerator(moderator, { from: owner });
    await manager.resolveDisputeWithCode(disputeJobId, 2, "employer win", { from: moderator });
    const disputeHook = (await ensJobPages.lastHook()).toNumber();
    assert.equal(disputeHook, 3, "revoke hook should be recorded on employer win");
  });

});
