const { deployFixture } = require("./helpers/fixture");
const { fundAgents } = require("./helpers/bonds");
const { expectCustomError } = require("./helpers/errors");

const MockERC20 = artifacts.require("MockERC20");

contract("identityConfig.locking", (accounts) => {
  let ctx;

  beforeEach(async () => {
    ctx = await deployFixture(accounts);
  });

  it("blocks identity config updates while locked totals exist then allows after settlement", async () => {
    const payout = web3.utils.toBN(web3.utils.toWei("5"));
    await fundAgents(ctx.token, ctx.manager, [ctx.agent], ctx.owner, 3);
    await ctx.token.mint(ctx.employer, payout, { from: ctx.owner });
    await ctx.token.approve(ctx.manager.address, payout, { from: ctx.employer });
    await ctx.manager.createJob("ipfs://spec", payout, 1000, "d", { from: ctx.employer });
    await expectCustomError(ctx.manager.updateAGITokenAddress.call((await MockERC20.new({ from: ctx.owner })).address, { from: ctx.owner }), "InvalidState");

    await ctx.manager.applyForJob(0, "agent", [], { from: ctx.agent });
    await ctx.manager.requestJobCompletion(0, "ipfs://done", { from: ctx.agent });
    await ctx.manager.setVoteQuorum(1, { from: ctx.owner });
    await ctx.manager.setRequiredValidatorApprovals(1, { from: ctx.owner });
    await ctx.manager.addAdditionalValidator(accounts[8], { from: ctx.owner });
    await ctx.token.mint(accounts[8], web3.utils.toBN(web3.utils.toWei("10")), { from: ctx.owner });
    await ctx.token.approve(ctx.manager.address, web3.utils.toBN(web3.utils.toWei("10")), { from: accounts[8] });
    await ctx.manager.validateJob(0, "", [], { from: accounts[8] });
    const cp = await ctx.manager.challengePeriodAfterApproval();
    await require("@openzeppelin/test-helpers").time.increase(cp.addn(1));
    await ctx.manager.finalizeJob(0, { from: ctx.employer });

    const replacement = await MockERC20.new({ from: ctx.owner });
    await ctx.manager.updateAGITokenAddress(replacement.address, { from: ctx.owner });
    await ctx.manager.lockIdentityConfiguration({ from: ctx.owner });
    await expectCustomError(ctx.manager.updateAGITokenAddress.call(ctx.token.address, { from: ctx.owner }), "ConfigLocked");
  });
});
