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
const AGENT_SLASH_BPS = toBN(10000);

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

    await manager.validateJob(jobFast, "validator", EMPTY_PROOF, { from: validator });
    await manager.validateJob(jobSlow, "validator", EMPTY_PROOF, { from: validator });
    await time.increase(101);
    await manager.finalizeJob(jobFast, { from: employer });
    await manager.finalizeJob(jobSlow, { from: employer });

    const repFast = await manager.reputation(agentFast);
    const repSlow = await manager.reputation(agentSlow);
    assert(repFast.gte(repSlow), "delayed completion should not increase reputation");
  });

  it("caps time bonus so larger payouts dominate reputation", async () => {
    const payoutSmall = toBN(toWei("0.1"));
    const payoutLarge = toBN(toWei("10"));
    const duration = 1000000;
    await token.mint(employer, payoutSmall.add(payoutLarge), { from: owner });

    await token.approve(manager.address, payoutSmall.add(payoutLarge), { from: employer });
    const jobSmall = (await manager.createJob("ipfs-small", payoutSmall, duration, "details", { from: employer })).logs[0].args.jobId.toNumber();
    const jobLarge = (await manager.createJob("ipfs-large", payoutLarge, duration, "details", { from: employer })).logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobSmall, "agent-fast", EMPTY_PROOF, { from: agentFast });
    await manager.applyForJob(jobLarge, "agent-slow", EMPTY_PROOF, { from: agentSlow });

    await manager.requestJobCompletion(jobSmall, "ipfs-small-complete", { from: agentFast });
    await manager.requestJobCompletion(jobLarge, "ipfs-large-complete", { from: agentSlow });

    await manager.validateJob(jobSmall, "validator", EMPTY_PROOF, { from: validator });
    await manager.validateJob(jobLarge, "validator", EMPTY_PROOF, { from: validator });
    await time.increase(101);
    await manager.finalizeJob(jobSmall, { from: employer });
    await manager.finalizeJob(jobLarge, { from: employer });

    const repSmall = await manager.reputation(agentFast);
    const repLarge = await manager.reputation(agentSlow);
    assert(repLarge.gt(repSmall), "higher payouts should dominate time bonus in reputation");
  });

  it("scales agent bonds with payout and snapshots at assignment", async () => {
    const payoutSmall = toBN(toWei("10"));
    const payoutLarge = toBN(toWei("1000"));
    await token.mint(employer, payoutSmall.add(payoutLarge), { from: owner });

    await token.approve(manager.address, payoutSmall.add(payoutLarge), { from: employer });
    const jobSmall = (await manager.createJob("ipfs-small-bond", payoutSmall, 100, "details", { from: employer })).logs[0].args.jobId.toNumber();
    const jobLarge = (await manager.createJob("ipfs-large-bond", payoutLarge, 100, "details", { from: employer })).logs[0].args.jobId.toNumber();

    const bondSmall = await computeAgentBond(manager, payoutSmall, toBN(100));
    const bondLarge = await computeAgentBond(manager, payoutLarge, toBN(100));
    assert(bondLarge.gt(bondSmall), "agent bond should scale with payout");

    const agentFastBefore = await token.balanceOf(agentFast);
    await manager.applyForJob(jobSmall, "agent-fast", EMPTY_PROOF, { from: agentFast });
    const agentFastAfter = await token.balanceOf(agentFast);
    assert.strictEqual(agentFastBefore.sub(agentFastAfter).toString(), bondSmall.toString(), "bond should be collected");

    await manager.applyForJob(jobLarge, "agent-slow", EMPTY_PROOF, { from: agentSlow });

    await manager.setAgentBond(bondSmall.add(toBN(toWei("50"))), { from: owner });
    await manager.requestJobCompletion(jobSmall, "ipfs-small-complete", { from: agentFast });
    await time.increase(2);
    const beforeFinalize = await token.balanceOf(agentFast);
    await manager.finalizeJob(jobSmall, { from: employer });
    const afterFinalize = await token.balanceOf(agentFast);
    assert(
      afterFinalize.sub(beforeFinalize).eq(payoutSmall.muln(90).divn(100).add(bondSmall)),
      "bond should be snapshotted at assignment"
    );
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
    const slashedBond = agentBondExpire.mul(AGENT_SLASH_BPS).divn(10000);
    assert(
      employerAfterExpire.sub(employerBeforeExpire).eq(payoutTwo.add(slashedBond)),
      "employer should receive payout plus slashed bond on expiry"
    );
  });

  it("requires the employer to finalize when there are no validator votes", async () => {
    const payout = toBN(toWei("1000"));
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

  it("yields zero reputation without validators or dispute wins", async () => {
    const payout = toBN(toWei("10"));
    const duration = 100;
    await token.mint(employer, payout, { from: owner });

    await token.approve(manager.address, payout, { from: employer });
    const jobId = (await manager.createJob("ipfs-norep", payout, duration, "details", { from: employer })).logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent-fast", EMPTY_PROOF, { from: agentFast });
    await manager.requestJobCompletion(jobId, "ipfs-norep-complete", { from: agentFast });
    await time.increase(2);
    await manager.finalizeJob(jobId, { from: employer });

    const rep = await manager.reputation(agentFast);
    assert(rep.isZero(), "reputation should be zero without validators");
  });

  it("scales agent bonds with duration", async () => {
    const payout = toBN(toWei("10"));
    const shortDuration = toBN(100);
    const longDuration = toBN(100000);
    const bondShort = await computeAgentBond(manager, payout, shortDuration);
    const bondLong = await computeAgentBond(manager, payout, longDuration);
    assert(bondLong.gt(bondShort), "longer durations should require larger bonds");
  });

  it("allows disabling validator bonds when all params are zero", async () => {
    await manager.setValidatorBondParams(0, 0, 0, { from: owner });
    const payout = toBN(toWei("1"));
    const duration = 100;
    await token.mint(employer, payout, { from: owner });

    await token.approve(manager.address, payout, { from: employer });
    const jobId = (await manager.createJob("ipfs-zero-bond", payout, duration, "details", { from: employer })).logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent-fast", EMPTY_PROOF, { from: agentFast });
    await manager.requestJobCompletion(jobId, "ipfs-zero-bond-complete", { from: agentFast });

    const validatorBefore = await token.balanceOf(validator);
    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    const validatorAfter = await token.balanceOf(validator);
    assert.strictEqual(
      validatorBefore.sub(validatorAfter).toString(),
      "0",
      "validator bond should be zero when params disabled"
    );
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

  it("scales validator bonds with payout under the default max", async () => {
    const payoutSmall = toBN(toWei("5"));
    const payoutLarge = toBN(toWei("500"));
    const bondSmall = await computeValidatorBond(manager, payoutSmall);
    const bondLarge = await computeValidatorBond(manager, payoutLarge);
    assert(bondLarge.gt(bondSmall), "validator bond should scale with payout");
    assert(bondLarge.lte(payoutLarge), "validator bond should never exceed payout");
  });
});
