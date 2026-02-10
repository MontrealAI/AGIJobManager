const assert = require("assert");
const { time } = require("@openzeppelin/test-helpers");

const { deployFixture } = require("./helpers/fixture");
const { fundAgents, fundValidators } = require("./helpers/bonds");

contract("escrowAccounting.invariants", (accounts) => {
  let ctx;
  beforeEach(async () => {
    ctx = await deployFixture(accounts);
    await ctx.manager.setVoteQuorum(2, { from: ctx.owner });
    await ctx.manager.setRequiredValidatorApprovals(2, { from: ctx.owner });
    await fundAgents(ctx.token, ctx.manager, [ctx.agent], ctx.owner, 8);
    await fundValidators(ctx.token, ctx.manager, [ctx.validator1, ctx.validator2], ctx.owner, 8);
    await ctx.token.mint(ctx.employer, web3.utils.toBN(web3.utils.toWei("200")), { from: ctx.owner });
    await ctx.token.approve(ctx.manager.address, web3.utils.toBN(web3.utils.toWei("200")), { from: ctx.employer });
  });

  async function assertSolvent() {
    const bal = await ctx.token.balanceOf(ctx.manager.address);
    const lockedEscrow = await ctx.manager.lockedEscrow();
    const lockedAgentBonds = await ctx.manager.lockedAgentBonds();
    const lockedValidatorBonds = await ctx.manager.lockedValidatorBonds();
    const lockedDisputeBonds = await ctx.manager.lockedDisputeBonds();
    const totalLocked = lockedEscrow.add(lockedAgentBonds).add(lockedValidatorBonds).add(lockedDisputeBonds);
    assert(bal.gte(totalLocked), "contract balance must stay >= locked totals");
    const withdrawable = await ctx.manager.withdrawableAGI();
    assert.equal(withdrawable.toString(), bal.sub(totalLocked).toString());
  }

  it("checks locked-accounting invariants over bounded mixed scenarios", async () => {
    const payouts = ["5", "7", "11", "13", "17", "19", "23", "29"];
    for (let i = 0; i < payouts.length; i++) {
      const payout = web3.utils.toBN(web3.utils.toWei(payouts[i]));
      await ctx.manager.createJob(`ipfs://mix-${i}`, payout, 1000, "mix", { from: ctx.employer });
      await ctx.manager.applyForJob(i, "agent", [], { from: ctx.agent });

      if (i % 3 === 0) {
        await ctx.manager.requestJobCompletion(i, `ipfs://done-${i}`, { from: ctx.agent });
        await ctx.manager.validateJob(i, "validator1", [], { from: ctx.validator1 });
        await ctx.manager.validateJob(i, "validator2", [], { from: ctx.validator2 });
        const cp = await ctx.manager.challengePeriodAfterApproval();
        await time.increase(cp.addn(1));
        await ctx.manager.finalizeJob(i, { from: ctx.employer });
      } else if (i % 3 === 1) {
        await time.increase(1001);
        await ctx.manager.expireJob(i, { from: ctx.employer });
      } else {
        await ctx.manager.requestJobCompletion(i, `ipfs://done-${i}`, { from: ctx.agent });
        await ctx.manager.disapproveJob(i, "validator1", [], { from: ctx.validator1 });
        await ctx.manager.disapproveJob(i, "validator2", [], { from: ctx.validator2 });
        const rp = await ctx.manager.completionReviewPeriod();
        await time.increase(rp.addn(1));
        await ctx.manager.finalizeJob(i, { from: ctx.employer });
      }
      await assertSolvent();
    }
  });
});
