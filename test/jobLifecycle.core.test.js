const assert = require("assert");
const { time } = require("@openzeppelin/test-helpers");

const { expectCustomError } = require("./helpers/errors");
const { deployFixture } = require("./helpers/fixture");
const { fundValidators, fundAgents } = require("./helpers/bonds");

contract("jobLifecycle.core", (accounts) => {
  let ctx;
  const payout = web3.utils.toBN(web3.utils.toWei("10"));

  beforeEach(async () => {
    ctx = await deployFixture(accounts);
    await fundAgents(ctx.token, ctx.manager, [ctx.agent], ctx.owner, 4);
    await fundValidators(ctx.token, ctx.manager, [ctx.validator1, ctx.validator2, ctx.validator3], ctx.owner, 4);
    await ctx.token.mint(ctx.employer, payout.muln(8), { from: ctx.owner });
    await ctx.token.approve(ctx.manager.address, payout.muln(8), { from: ctx.employer });
    await ctx.manager.setRequiredValidatorDisapprovals(4, { from: ctx.owner });
  });

  it("covers finalize branches and escrow transitions deterministically", async () => {
    const d = 1000;
    for (const tag of ["approve", "novote", "tie", "disapprove"]) {
      await ctx.manager.createJob(`ipfs://${tag}`, payout, d, tag, { from: ctx.employer });
    }

    await ctx.manager.applyForJob(0, "agent", [], { from: ctx.agent });
    await ctx.manager.requestJobCompletion(0, "ipfs://completion-0", { from: ctx.agent });

    // approvals + challenge window
    await ctx.manager.validateJob(0, "validator1", [], { from: ctx.validator1 });
    await ctx.manager.validateJob(0, "validator2", [], { from: ctx.validator2 });
    await ctx.manager.validateJob(0, "validator3", [], { from: ctx.validator3 });
    await expectCustomError(ctx.manager.finalizeJob.call(0), "InvalidState");
    const cp = await ctx.manager.challengePeriodAfterApproval();
    await time.increase(cp.addn(1));
    await ctx.manager.finalizeJob(0, { from: ctx.employer });

    // no-vote liveness
    await ctx.manager.applyForJob(1, "agent", [], { from: ctx.agent });
    await ctx.manager.requestJobCompletion(1, "ipfs://completion-1", { from: ctx.agent });
    const review = await ctx.manager.completionReviewPeriod();
    await time.increase(review.addn(1));
    await ctx.manager.finalizeJob(1, { from: ctx.employer });

    // tie => dispute forced
    await ctx.manager.applyForJob(2, "agent", [], { from: ctx.agent });
    await ctx.manager.requestJobCompletion(2, "ipfs://completion-2", { from: ctx.agent });
    await ctx.manager.validateJob(2, "validator1", [], { from: ctx.validator1 });
    await ctx.manager.disapproveJob(2, "validator2", [], { from: ctx.validator2 });
    await time.increase(review.addn(1));
    await ctx.manager.finalizeJob(2, { from: ctx.employer });
    const core = await ctx.manager.getJobCore(2);
    assert.equal(core.disputed, true, "tie should force dispute");

    // disapprovals win => employer refund
    await ctx.manager.applyForJob(3, "agent", [], { from: ctx.agent });
    await ctx.manager.requestJobCompletion(3, "ipfs://completion-3", { from: ctx.agent });
    await ctx.manager.disapproveJob(3, "validator1", [], { from: ctx.validator1 });
    await ctx.manager.disapproveJob(3, "validator2", [], { from: ctx.validator2 });
    await ctx.manager.disapproveJob(3, "validator3", [], { from: ctx.validator3 });
    await time.increase(review.addn(1));
    const employerBefore = await ctx.token.balanceOf(ctx.employer);
    await ctx.manager.finalizeJob(3, { from: ctx.employer });
    const employerAfter = await ctx.token.balanceOf(ctx.employer);
    assert(employerAfter.gt(employerBefore), "employer must receive refund on disapproval majority");

    assert((await ctx.manager.lockedEscrow()).lt(payout.muln(2)), "escrow should decrease after settlements");
  });

  it("validates create/apply/completion/expire constraints", async () => {
    await expectCustomError(ctx.manager.createJob.call("", payout, 1000, "x", { from: ctx.employer }), "InvalidParameters");
    await ctx.manager.createJob("ipfs://job", payout, 1, "x", { from: ctx.employer });
    const lockedAfterCreate = await ctx.manager.lockedEscrow();
    assert.equal(lockedAfterCreate.toString(), payout.toString());

    await ctx.manager.applyForJob(0, "agent", [], { from: ctx.agent });
    await expectCustomError(ctx.manager.applyForJob.call(0, "agent", [], { from: ctx.agent }), "InvalidState");

    await expectCustomError(ctx.manager.requestJobCompletion.call(0, "", { from: ctx.agent }), "InvalidParameters");
    await time.increase(2);
    await ctx.manager.expireJob(0, { from: ctx.employer });
    const expired = await ctx.manager.getJobCore(0);
    assert.equal(expired.expired, true);
  });
});
