const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { fundAgents, fundValidators, computeAgentBond, computeValidatorBond } = require("./helpers/bonds");
const { expectCustomError } = require("./helpers/errors");
const { time } = require("@openzeppelin/test-helpers");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager incentive hardening", (accounts) => {
  const [owner, employer, agentFast, agentSlow, validator] = accounts;
  let token;
  let ens;
  let nameWrapper;
  let manager;
  let agiType;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(
      ...buildInitConfig(
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
      ),
      { from: owner }
    );

    agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agentFast, { from: owner });
    await agiType.mint(agentSlow, { from: owner });
    await manager.addAGIType(agiType.address, 90, { from: owner });

    await manager.addAdditionalAgent(agentFast, { from: owner });
    await manager.addAdditionalAgent(agentSlow, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });

    await manager.setCompletionReviewPeriod(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(100, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });

    await fundAgents(token, manager, [agentFast, agentSlow], owner);
    await fundValidators(token, manager, [validator], owner);
  });

  it("does not reward delaying completion requests in reputation", async () => {
    const payout = toBN(toWei("100"));
    const duration = 200000;
    await token.mint(employer, payout.muln(2), { from: owner });

    await token.approve(manager.address, payout.muln(2), { from: employer });
    const jobFast = (await manager.createJob("ipfs-fast", payout, duration, "details", { from: employer })).logs[0].args.jobId.toNumber();
    const jobSlow = (await manager.createJob("ipfs-slow", payout, duration, "details", { from: employer })).logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobFast, "agent-fast", EMPTY_PROOF, { from: agentFast });
    await manager.applyForJob(jobSlow, "agent-slow", EMPTY_PROOF, { from: agentSlow });

    await manager.requestJobCompletion(jobFast, "ipfs-fast-complete", { from: agentFast });
    await time.increase(20000);
    await manager.requestJobCompletion(jobSlow, "ipfs-slow-complete", { from: agentSlow });

    await time.increase(2);
    await manager.finalizeJob(jobFast, { from: employer });
    await manager.finalizeJob(jobSlow, { from: employer });

    const repFast = await manager.reputation(agentFast);
    const repSlow = await manager.reputation(agentSlow);
    assert(repFast.gte(repSlow), "delayed completion should not increase reputation");
  });

  it("scales agent bonds with payout and snapshots per job", async () => {
    const payoutSmall = toBN(toWei("10"));
    const payoutLarge = toBN(toWei("100"));
    const duration = toBN(1000);
    await token.mint(employer, payoutSmall.add(payoutLarge), { from: owner });

    await token.approve(manager.address, payoutSmall.add(payoutLarge), { from: employer });
    const jobSmall = (await manager.createJob("ipfs-bond-small", payoutSmall, duration, "details", { from: employer }))
      .logs[0].args.jobId.toNumber();
    const jobLarge = (await manager.createJob("ipfs-bond-large", payoutLarge, duration, "details", { from: employer }))
      .logs[0].args.jobId.toNumber();

    const bondSmall = await computeAgentBond(manager, payoutSmall, duration);
    const bondLarge = await computeAgentBond(manager, payoutLarge, duration);
    assert(bondLarge.gt(bondSmall), "bond should scale with payout");

    const smallBefore = await token.balanceOf(agentFast);
    await manager.applyForJob(jobSmall, "agent-fast", EMPTY_PROOF, { from: agentFast });
    const smallAfter = await token.balanceOf(agentFast);
    assert.strictEqual(smallBefore.sub(smallAfter).toString(), bondSmall.toString(), "small bond should be collected");

    const largeBefore = await token.balanceOf(agentSlow);
    await manager.applyForJob(jobLarge, "agent-slow", EMPTY_PROOF, { from: agentSlow });
    const largeAfter = await token.balanceOf(agentSlow);
    assert.strictEqual(largeBefore.sub(largeAfter).toString(), bondLarge.toString(), "large bond should be collected");

    await manager.setAgentBond(toBN(toWei("50")), { from: owner });

    await manager.requestJobCompletion(jobSmall, "ipfs-bond-small-complete", { from: agentFast });
    await time.increase(2);
    const beforeFinalize = await token.balanceOf(agentFast);
    await manager.finalizeJob(jobSmall, { from: employer });
    const afterFinalize = await token.balanceOf(agentFast);
    assert(
      afterFinalize.sub(beforeFinalize).eq(payoutSmall.muln(90).divn(100).add(bondSmall)),
      "agent should be paid using snapshotted bond"
    );
  });

  it("increases reputation with higher payout even at the same duration", async () => {
    const payoutSmall = toBN(toWei("5"));
    const payoutLarge = toBN(toWei("50"));
    const duration = 1000;
    await token.mint(employer, payoutSmall.add(payoutLarge), { from: owner });
    await token.approve(manager.address, payoutSmall.add(payoutLarge), { from: employer });

    const smallJob = (await manager.createJob("ipfs-rep-small", payoutSmall, duration, "details", { from: employer }))
      .logs[0].args.jobId.toNumber();
    const largeJob = (await manager.createJob("ipfs-rep-large", payoutLarge, duration, "details", { from: employer }))
      .logs[0].args.jobId.toNumber();

    await manager.applyForJob(smallJob, "agent-fast", EMPTY_PROOF, { from: agentFast });
    await manager.applyForJob(largeJob, "agent-slow", EMPTY_PROOF, { from: agentSlow });

    await manager.requestJobCompletion(smallJob, "ipfs-rep-small-complete", { from: agentFast });
    await manager.requestJobCompletion(largeJob, "ipfs-rep-large-complete", { from: agentSlow });
    await time.increase(2);
    await manager.finalizeJob(smallJob, { from: employer });
    await manager.finalizeJob(largeJob, { from: employer });

    const repSmall = await manager.reputation(agentFast);
    const repLarge = await manager.reputation(agentSlow);
    assert(repLarge.gt(repSmall), "higher payout should yield higher reputation");
  });

  it("caps time bonus so very long durations stop increasing reputation", async () => {
    const payout = toBN(toWei("1"));
    const durationLong = toBN(1000000);
    const durationLonger = await manager.jobDurationLimit();
    await token.mint(employer, payout.muln(2), { from: owner });
    await token.approve(manager.address, payout.muln(2), { from: employer });

    const jobLong = (await manager.createJob("ipfs-time-long", payout, durationLong, "details", { from: employer }))
      .logs[0].args.jobId.toNumber();
    const jobLonger = (await manager.createJob("ipfs-time-longer", payout, durationLonger, "details", { from: employer }))
      .logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobLong, "agent-fast", EMPTY_PROOF, { from: agentFast });
    await manager.applyForJob(jobLonger, "agent-slow", EMPTY_PROOF, { from: agentSlow });

    await manager.requestJobCompletion(jobLong, "ipfs-time-long-complete", { from: agentFast });
    await manager.requestJobCompletion(jobLonger, "ipfs-time-longer-complete", { from: agentSlow });
    await time.increase(2);
    await manager.finalizeJob(jobLong, { from: employer });
    await manager.finalizeJob(jobLonger, { from: employer });

    const repLong = await manager.reputation(agentFast);
    const repLonger = await manager.reputation(agentSlow);
    assert(repLonger.eq(repLong), "time bonus should be capped at the base payout signal");
  });

  it("uses payout-scaled validator bonds for large payouts", async () => {
    const payout = await manager.maxJobPayout();
    const bond = await computeValidatorBond(manager, payout);
    const bps = await manager.validatorBondBps();
    const expected = payout.mul(bps).divn(10000);
    assert(bond.eq(expected), "validator bond should scale with payout");
    assert(bond.gt(toBN(toWei("200"))), "validator bond should not be capped at legacy defaults");
  });

  it("snapshots and returns or slashes agent bonds, and excludes them from withdrawable AGI", async () => {
    const payout = toBN(toWei("20"));
    await token.mint(employer, payout, { from: owner });

    await token.approve(manager.address, payout, { from: employer });
    const jobId = (await manager.createJob("ipfs-bond", payout, 100, "details", { from: employer })).logs[0].args.jobId.toNumber();

    const agentBond = await computeAgentBond(manager, payout, toBN(100));
    const agentBefore = await token.balanceOf(agentFast);
    await manager.applyForJob(jobId, "agent-fast", EMPTY_PROOF, { from: agentFast });
    const agentAfterApply = await token.balanceOf(agentFast);
    assert.strictEqual(agentBefore.sub(agentAfterApply).toString(), agentBond.toString(), "bond should be collected");

    const withdrawable = await manager.withdrawableAGI();
    assert.strictEqual(withdrawable.toString(), "0", "withdrawable AGI should exclude locked agent bond");

    await manager.requestJobCompletion(jobId, "ipfs-bond-complete", { from: agentFast });
    await time.increase(2);
    const agentBeforeFinalize = await token.balanceOf(agentFast);
    await manager.finalizeJob(jobId, { from: employer });
    const agentAfterFinalize = await token.balanceOf(agentFast);
    assert(
      agentAfterFinalize.sub(agentBeforeFinalize).eq(payout.muln(90).divn(100).add(agentBond)),
      "agent should receive payout plus bond refund on win"
    );

    const payoutTwo = toBN(toWei("5"));
    await token.mint(employer, payoutTwo, { from: owner });
    await token.approve(manager.address, payoutTwo, { from: employer });
    const jobExpire = (await manager.createJob("ipfs-expire", payoutTwo, 1, "details", { from: employer })).logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobExpire, "agent-fast", EMPTY_PROOF, { from: agentFast });
    const agentBondExpire = await computeAgentBond(manager, payoutTwo, toBN(1));
    await time.increase(2);
    const employerBeforeExpire = await token.balanceOf(employer);
    await manager.expireJob(jobExpire, { from: employer });
    const employerAfterExpire = await token.balanceOf(employer);
    assert(
      employerAfterExpire.sub(employerBeforeExpire).eq(payoutTwo.add(agentBondExpire)),
      "employer should receive payout plus slashed bond on expiry"
    );
  });

  it("requires the employer to finalize when there are no validator votes", async () => {
    const payout = toBN(toWei("10"));
    await token.mint(employer, payout, { from: owner });

    await token.approve(manager.address, payout, { from: employer });
    const jobId = (await manager.createJob("ipfs-novotes", payout, 100, "details", { from: employer })).logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent-fast", EMPTY_PROOF, { from: agentFast });
    await manager.requestJobCompletion(jobId, "ipfs-novotes-complete", { from: agentFast });
    await time.increase(2);

    await expectCustomError(manager.finalizeJob.call(jobId, { from: agentFast }), "InvalidState");
    await expectCustomError(manager.finalizeJob.call(jobId, { from: validator }), "InvalidState");
    await manager.finalizeJob(jobId, { from: employer });
  });

  it("caps validator bonds at payout and prevents rush-to-approve settlement", async () => {
    const payout = toBN(toWei("0.5"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const jobId = (await manager.createJob("ipfs-validate", payout, 100, "details", { from: employer })).logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent-fast", EMPTY_PROOF, { from: agentFast });
    await manager.requestJobCompletion(jobId, "ipfs-validate-complete", { from: agentFast });

    const validatorBond = await computeValidatorBond(manager, payout);
    const validatorBefore = await token.balanceOf(validator);
    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    const validatorAfter = await token.balanceOf(validator);
    assert.strictEqual(
      validatorBefore.sub(validatorAfter).toString(),
      validatorBond.toString(),
      "validator bond should not exceed payout"
    );

    await expectCustomError(manager.finalizeJob.call(jobId, { from: employer }), "InvalidState");
    await time.increase(101);
    await manager.finalizeJob(jobId, { from: employer });
  });
});
