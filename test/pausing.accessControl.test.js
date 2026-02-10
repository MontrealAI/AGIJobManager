const { expectRevert } = require("@openzeppelin/test-helpers");
const { deployFixture } = require("./helpers/fixture");
const { fundAgents } = require("./helpers/bonds");

contract("pausing.accessControl", (accounts) => {
  let ctx;
  const payout = web3.utils.toBN(web3.utils.toWei("6"));

  beforeEach(async () => {
    ctx = await deployFixture(accounts);
    await fundAgents(ctx.token, ctx.manager, [ctx.agent], ctx.owner, 3);
    await ctx.token.mint(ctx.employer, payout.muln(2), { from: ctx.owner });
    await ctx.token.approve(ctx.manager.address, payout.muln(2), { from: ctx.employer });
    await ctx.manager.createJob("ipfs://pause", payout, 1000, "pause", { from: ctx.employer });
  });

  it("gates workflow by pause and settlementPause controls", async () => {
    await ctx.token.mint(ctx.manager.address, 2, { from: ctx.owner });
    await ctx.manager.pause({ from: ctx.owner });
    await expectRevert.unspecified(ctx.manager.applyForJob(0, "agent", [], { from: ctx.agent }));
    await ctx.manager.unpause({ from: ctx.owner });

    await ctx.manager.applyForJob(0, "agent", [], { from: ctx.agent });
    await ctx.manager.requestJobCompletion(0, "ipfs://c", { from: ctx.agent });

    await ctx.manager.setSettlementPaused(true, { from: ctx.owner });
    await expectRevert.unspecified(ctx.manager.finalizeJob(0, { from: ctx.employer }));

    await ctx.manager.pause({ from: ctx.owner });
    await expectRevert.unspecified(ctx.manager.withdrawAGI(1, { from: ctx.owner }));
    await ctx.manager.setSettlementPaused(false, { from: ctx.owner });
    await ctx.manager.withdrawAGI(1, { from: ctx.owner });
  });
});
