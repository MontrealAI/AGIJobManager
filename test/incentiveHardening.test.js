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

  it("scales and snapshots agent bonds by payout and duration", async () => {
    const payoutSmall = toBN(toWei("2"));
    const payoutLarge = toBN(toWei("50"));
    const durationLimit = (await manager.jobDurationLimit()).toNumber();
    const durationShort = 10;
    const durationMax = durationLimit;

    await token.mint(employer, payoutSmall.add(payoutLarge), { from: owner });
    await token.approve(manager.address, payoutSmall.add(payoutLarge), { from: employer });

    const jobSmall = (await manager.createJob("ipfs-small", payoutSmall, durationShort, "details", { from: employer })).logs[0].args.jobId.toNumber();
    const jobLarge = (await manager.createJob("ipfs-large", payoutLarge, durationMax, "details", { from: employer })).logs[0].args.jobId.toNumber();

    const bondSmall = await computeAgentBond(manager, payoutSmall, durationShort);
    const bondLarge = await computeAgentBond(manager, payoutLarge, durationMax);
    assert(bondLarge.gt(bondSmall), "bond should grow with payout and duration");

    const agentBefore = await token.balanceOf(agentFast);
    await manager.applyForJob(jobSmall, "agent-fast", EMPTY_PROOF, { from: agentFast });
    const agentAfterApply = await token.balanceOf(agentFast);
    assert.strictEqual(agentBefore.sub(agentAfterApply).toString(), bondSmall.toString(), "bond should be collected");

    await manager.setAgentBondBps(0, { from: owner });
    await manager.setAgentBond(0, { from: owner });
    await manager.setAgentBondMax(0, { from: owner });

    await manager.requestJobCompletion(jobSmall, "ipfs-small-complete", { from: agentFast });
    await time.increase(2);
    const agentBeforeFinalize = await token.balanceOf(agentFast);
    await manager.finalizeJob(jobSmall, { from: employer });
    const agentAfterFinalize = await token.balanceOf(agentFast);
    assert(
      agentAfterFinalize.sub(agentBeforeFinalize).eq(payoutSmall.muln(90).divn(100).add(bondSmall)),
      "bond refund should use the snapshotted amount"
    );

    await manager.applyForJob(jobLarge, "agent-fast", EMPTY_PROOF, { from: agentFast });
    const bondLargeApplied = await computeAgentBond(manager, payoutLarge, durationMax);
    assert(bondLargeApplied.isZero(), "bond can be disabled for new jobs after config change");
  });

  it("snapshots and returns or slashes agent bonds, and excludes them from withdrawable AGI", async () => {
    const payout = toBN(toWei("20"));
    await token.mint(employer, payout, { from: owner });

    await token.approve(manager.address, payout, { from: employer });
    const jobId = (await manager.createJob("ipfs-bond", payout, 100, "details", { from: employer })).logs[0].args.jobId.toNumber();

    const agentBond = await computeAgentBond(manager, payout, 100);
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
    const agentBondExpire = await computeAgentBond(manager, payoutTwo, 1);
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

  it("keeps validator bond defaults aligned to large payouts", async () => {
    const maxPayout = await manager.maxJobPayout();
    const maxBond = await manager.validatorBondMax();
    assert(maxBond.eq(maxPayout), "validator bond max should default to the job payout cap");

    const bond = await computeValidatorBond(manager, maxPayout);
    assert(bond.gt(toBN(0)), "validator bond should be nonzero for large payouts");
    assert(bond.lte(maxPayout), "validator bond should never exceed payout");
  });
});
