const assert = require("assert");
const { deployFixture } = require("./helpers/fixture");
const { expectCustomError } = require("./helpers/errors");
const { computeValidatorBond, fundAgents, fundValidators } = require("./helpers/bonds");

contract("validatorVoting.bonds", (accounts) => {
  let ctx;
  const payout = web3.utils.toBN(web3.utils.toWei("12"));

  beforeEach(async () => {
    ctx = await deployFixture(accounts);
    await fundAgents(ctx.token, ctx.manager, [ctx.agent], ctx.owner, 3);
    await fundValidators(ctx.token, ctx.manager, [ctx.validator1, ctx.validator2, ctx.validator3], ctx.owner, 3);
    await ctx.token.mint(ctx.employer, payout, { from: ctx.owner });
    await ctx.token.approve(ctx.manager.address, payout, { from: ctx.employer });
    await ctx.manager.createJob("ipfs://vote", payout, 1000, "vote", { from: ctx.employer });
    await ctx.manager.applyForJob(0, "agent", [], { from: ctx.agent });
    await ctx.manager.requestJobCompletion(0, "ipfs://done", { from: ctx.agent });
  });

  it("enforces single vote and deterministic bond sizing", async () => {
    const bondExpected = await computeValidatorBond(ctx.manager, payout);
    const before = await ctx.manager.lockedValidatorBonds();
    await ctx.manager.validateJob(0, "validator1", [], { from: ctx.validator1 });
    const after = await ctx.manager.lockedValidatorBonds();
    assert.equal(after.sub(before).toString(), bondExpected.toString());

    await expectCustomError(ctx.manager.disapproveJob.call(0, "validator1", [], { from: ctx.validator1 }), "InvalidState");
    await ctx.manager.disapproveJob(0, "validator2", [], { from: ctx.validator2 });
    await ctx.manager.validateJob(0, "validator3", [], { from: ctx.validator3 });
    const validation = await ctx.manager.getJobValidation(0);
    assert.equal(validation.validatorApprovals.toString(), "2");
    assert.equal(validation.validatorDisapprovals.toString(), "1");
  });
});
