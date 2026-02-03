const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");
const FailingERC20 = artifacts.require("FailingERC20");

const { rootNode, setNameWrapperOwnership } = require("./helpers/ens");
const { readJob } = require("./helpers/job");
const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");
const { time } = require("@openzeppelin/test-helpers");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager security regressions", (accounts) => {
  const [owner, employer, agent, validator, other, moderator] = accounts;
  let token;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let clubRoot;
  let agentRoot;
  let agiTypeNft;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    clubRoot = rootNode("club-root");
    agentRoot = rootNode("agent-root");

    manager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        clubRoot,
        agentRoot,
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator", validator);
    await manager.addModerator(moderator, { from: owner });
    agiTypeNft = await MockERC721.new({ from: owner });
    await manager.addAGIType(agiTypeNft.address, 1, { from: owner });
    await agiTypeNft.mint(agent, { from: owner });
  });

  it("reverts on missing jobs for role actions", async () => {
    await expectCustomError(manager.applyForJob.call(999, "agent", EMPTY_PROOF, { from: agent }), "JobNotFound");
    await expectCustomError(
      manager.requestJobCompletion.call(999, "ipfs", { from: agent }),
      "JobNotFound"
    );
    await expectCustomError(
      manager.validateJob.call(999, "validator", EMPTY_PROOF, { from: validator }),
      "JobNotFound"
    );
    await expectCustomError(
      manager.disapproveJob.call(999, "validator", EMPTY_PROOF, { from: validator }),
      "JobNotFound"
    );
    await expectCustomError(manager.disputeJob.call(999, { from: employer }), "JobNotFound");
    await expectCustomError(manager.resolveDispute.call(999, "agent win", { from: moderator }), "JobNotFound");
  });

  it("blocks double completion and employer-win follow-up", async () => {
    const payout = toBN(toWei("10"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-done", { from: agent });

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await expectCustomError(
      manager.validateJob.call(jobId, "validator", EMPTY_PROOF, { from: validator }),
      "InvalidState"
    );

    const payoutTwo = toBN(toWei("15"));
    await token.mint(employer, payoutTwo, { from: owner });
    await token.approve(manager.address, payoutTwo, { from: employer });
    const createTxTwo = await manager.createJob("ipfs", payoutTwo, 1000, "details", { from: employer });
    const jobIdTwo = createTxTwo.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobIdTwo, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobIdTwo, "ipfs-done-two", { from: agent });
    await manager.disputeJob(jobIdTwo, { from: employer });
    await manager.resolveDispute(jobIdTwo, "employer win", { from: moderator });
    await expectCustomError(
      manager.validateJob.call(jobIdTwo, "validator", EMPTY_PROOF, { from: validator }),
      "InvalidState"
    );
  });

  it("avoids div-by-zero when completing with zero validators", async () => {
    const payout = toBN(toWei("20"));
    await token.mint(employer, payout, { from: owner });

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 92, { from: owner });

    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.disputeJob(jobId, { from: employer });
    await manager.resolveDispute(jobId, "agent win", { from: moderator });

    const agentBalance = await token.balanceOf(agent);
    const expectedPayout = payout.muln(92).divn(100);
    assert.equal(agentBalance.toString(), expectedPayout.toString(), "agent payout should succeed without validators");
  });

  it("rejects validator approvals before completion is requested", async () => {
    const payout = toBN(toWei("12"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    await expectCustomError(
      manager.validateJob.call(jobId, "validator", EMPTY_PROOF, { from: validator }),
      "InvalidState"
    );
  });

  it("rejects validator disapprovals before completion is requested", async () => {
    const payout = toBN(toWei("12"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    await expectCustomError(
      manager.disapproveJob.call(jobId, "validator", EMPTY_PROOF, { from: validator }),
      "InvalidState"
    );
  });

  it("settles agent-win disputes after completion is requested", async () => {
    const payout = toBN(toWei("18"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-disputed-complete", { from: agent });
    await manager.disputeJob(jobId, { from: employer });

    await manager.resolveDispute(jobId, "agent win", { from: moderator });

    const job = await readJob(manager, jobId);
    assert.strictEqual(job.completed, true, "agent-win dispute should complete after completion request");
    assert.strictEqual(job.completionRequested, true, "completion request should be recorded");
  });

  it("allows disputes after duration expiry when completion was requested", async () => {
    const payout = toBN(toWei("19"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-disputed-late", { from: agent });

    await time.increase(2);
    await manager.disputeJob(jobId, { from: employer });
    await manager.resolveDispute(jobId, "agent win", { from: moderator });

    const job = await readJob(manager, jobId);
    assert.strictEqual(job.completed, true, "agent-win should settle after late completion request");
    assert.strictEqual(job.completionRequested, true, "late completion request should be recorded");
  });

  it("allows agent-win dispute resolution while paused after completion request", async () => {
    const payout = toBN(toWei("21"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-paused-dispute", { from: agent });
    await manager.disputeJob(jobId, { from: employer });

    await manager.pause({ from: owner });
    await manager.resolveDispute(jobId, "agent win", { from: moderator });

    const job = await readJob(manager, jobId);
    assert.strictEqual(job.completed, true, "agent-win should settle after paused completion request");
    assert.strictEqual(job.completionRequested, true, "paused completion request should be recorded");
  });

  it("enforces vote rules and dispute thresholds", async () => {
    const payout = toBN(toWei("30"));
    await token.mint(employer, payout.muln(2), { from: owner });

    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await expectCustomError(
      manager.validateJob.call(jobId, "validator", EMPTY_PROOF, { from: validator }),
      "InvalidState"
    );
    await expectCustomError(
      manager.disapproveJob.call(jobId, "validator", EMPTY_PROOF, { from: validator }),
      "InvalidState"
    );

    await token.approve(manager.address, payout, { from: employer });
    const createTxTwo = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobIdTwo = createTxTwo.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobIdTwo, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobIdTwo, "ipfs-dispute", { from: agent });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });
    await manager.disapproveJob(jobIdTwo, "validator", EMPTY_PROOF, { from: validator });

    const job = await readJob(manager, jobIdTwo);
    assert.strictEqual(job.disputed, true, "job should be disputed after threshold");
  });

  it("guards dispute actions by role and moderator", async () => {
    const payout = toBN(toWei("12"));
    await token.mint(employer, payout, { from: owner });

    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await expectCustomError(manager.disputeJob.call(jobId, { from: other }), "NotAuthorized");
    await manager.disputeJob(jobId, { from: employer });
    await expectCustomError(manager.disputeJob.call(jobId, { from: employer }), "InvalidState");
    await expectCustomError(
      manager.resolveDispute.call(jobId, "agent win", { from: other }),
      "NotModerator"
    );
  });

  it("reverts on ERC20 transfer failures", async () => {
    const failing = await FailingERC20.new({ from: owner });
    await failing.mint(employer, toBN(toWei("10")), { from: owner });

    const managerFailing = await AGIJobManager.new(...buildInitConfig(
        failing.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        clubRoot,
        agentRoot,
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator", validator);

    await failing.setFailTransferFroms(true, { from: owner });
    await failing.approve(managerFailing.address, toBN(toWei("10")), { from: employer });
    await expectCustomError(
      managerFailing.createJob.call("ipfs", toBN(toWei("10")), 1000, "details", { from: employer }),
      "TransferFailed"
    );
  });

  it("reverts on payout transfer failures", async () => {
    const failing = await FailingERC20.new({ from: owner });
    await failing.mint(employer, toBN(toWei("10")), { from: owner });

    const managerFailing = await AGIJobManager.new(...buildInitConfig(
        failing.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        clubRoot,
        agentRoot,
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator", validator);
    await managerFailing.setRequiredValidatorApprovals(1, { from: owner });
    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await managerFailing.addAGIType(agiType.address, 1, { from: owner });

    await failing.approve(managerFailing.address, toBN(toWei("10")), { from: employer });
    const createTx = await managerFailing.createJob("ipfs", toBN(toWei("10")), 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await managerFailing.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await managerFailing.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await failing.setFailTransfers(true, { from: owner });
    await expectCustomError(
      managerFailing.validateJob.call(jobId, "validator", EMPTY_PROOF, { from: validator }),
      "TransferFailed"
    );
  });
});
