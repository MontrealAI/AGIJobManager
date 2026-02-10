const assert = require("assert");
const { time } = require("@openzeppelin/test-helpers");

const { deployFixture } = require("./helpers/fixture");
const { expectCustomError } = require("./helpers/errors");
const { fundAgents, fundValidators, fundDisputeBond, computeDisputeBond } = require("./helpers/bonds");

contract("disputes.moderator", (accounts) => {
  let ctx;
  const payout = web3.utils.toBN(web3.utils.toWei("20"));

  beforeEach(async () => {
    ctx = await deployFixture(accounts);
    await ctx.manager.addModerator(ctx.validator3, { from: ctx.owner });
    await fundAgents(ctx.token, ctx.manager, [ctx.agent], ctx.owner, 3);
    await fundValidators(ctx.token, ctx.manager, [ctx.validator1], ctx.owner, 3);
    await ctx.token.mint(ctx.employer, payout.muln(2), { from: ctx.owner });
    await ctx.token.approve(ctx.manager.address, payout.muln(2), { from: ctx.employer });
  });

  it("handles dispute resolution codes, stale resolution, and access control", async () => {
    await ctx.manager.createJob("ipfs://a", payout, 1000, "a", { from: ctx.employer });
    await ctx.manager.applyForJob(0, "agent", [], { from: ctx.agent });
    await ctx.manager.requestJobCompletion(0, "ipfs://completion", { from: ctx.agent });

    const expectedBond = await computeDisputeBond(ctx.manager, payout);
    const fundedBond = await fundDisputeBond(ctx.token, ctx.manager, ctx.employer, payout, ctx.owner);
    assert.equal(expectedBond.toString(), fundedBond.toString());

    await ctx.manager.disputeJob(0, { from: ctx.employer });
    await expectCustomError(ctx.manager.resolveDisputeWithCode.call(0, 1, "x", { from: ctx.employer }), "NotModerator");

    // NO_ACTION leaves dispute active
    await ctx.manager.resolveDisputeWithCode(0, 0, "monitor", { from: ctx.validator3 });
    let core = await ctx.manager.getJobCore(0);
    assert.equal(core.disputed, true);

    await ctx.manager.resolveDisputeWithCode(0, 1, "agent wins", { from: ctx.validator3 });
    core = await ctx.manager.getJobCore(0);
    assert.equal(core.completed, true);

    // stale dispute path (owner)
    await ctx.token.approve(ctx.manager.address, payout, { from: ctx.employer });
    await ctx.manager.createJob("ipfs://b", payout, 1000, "b", { from: ctx.employer });
    await ctx.manager.applyForJob(1, "agent", [], { from: ctx.agent });
    await ctx.manager.requestJobCompletion(1, "ipfs://completion2", { from: ctx.agent });
    await fundDisputeBond(ctx.token, ctx.manager, ctx.agent, payout, ctx.owner);
    await ctx.manager.disputeJob(1, { from: ctx.agent });
    await expectCustomError(ctx.manager.resolveStaleDispute.call(1, true, { from: ctx.owner }), "InvalidState");
    const drp = await ctx.manager.disputeReviewPeriod();
    await time.increase(drp.addn(1));
    await ctx.manager.resolveStaleDispute(1, true, { from: ctx.owner });
    const settled = await ctx.manager.getJobCore(1);
    assert.equal(settled.completed, true);
  });
});
