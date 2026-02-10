const assert = require("assert");
const MockERC165Only = artifacts.require("MockERC165Only");
const MockNoSupportsInterface = artifacts.require("MockNoSupportsInterface");
const MockBrokenERC721 = artifacts.require("MockBrokenERC721");

const { deployFixture } = require("./helpers/fixture");
const { expectCustomError } = require("./helpers/errors");

contract("agiTypes.safety", (accounts) => {
  let ctx;

  beforeEach(async () => {
    ctx = await deployFixture(accounts);
  });

  it("rejects zero/EOA/non-ERC721 AGI types and supports disable", async () => {
    await expectCustomError(ctx.manager.addAGIType.call("0x0000000000000000000000000000000000000000", 10, { from: ctx.owner }), "InvalidParameters");
    await expectCustomError(ctx.manager.addAGIType.call(accounts[8], 10, { from: ctx.owner }), "InvalidParameters");

    const erc165Only = await MockERC165Only.new({ from: ctx.owner });
    await expectCustomError(ctx.manager.addAGIType.call(erc165Only.address, 10, { from: ctx.owner }), "InvalidParameters");

    const nonErc721 = await MockNoSupportsInterface.new({ from: ctx.owner });
    await expectCustomError(ctx.manager.addAGIType.call(nonErc721.address, 10, { from: ctx.owner }), "InvalidParameters");

    const tx = await ctx.manager.disableAGIType(ctx.agiTypeNft.address, { from: ctx.owner });
    const evt = tx.logs.find((l) => l.event === "AGITypeUpdated");
    assert.equal(evt.args.payoutPercentage.toString(), "0");
  });

  it("ignores disabled/misbehaving AGI types without bricking applyForJob", async () => {
    const broken = await MockBrokenERC721.new({ from: ctx.owner });
    await ctx.manager.addAGIType(broken.address, 50, { from: ctx.owner });
    await ctx.manager.disableAGIType(broken.address, { from: ctx.owner });

    const payoutPct = await ctx.manager.getHighestPayoutPercentage(ctx.agent);
    assert.equal(payoutPct.toString(), "92");

    const payout = web3.utils.toBN(web3.utils.toWei("4"));
    await ctx.token.mint(ctx.employer, payout, { from: ctx.owner });
    await ctx.token.approve(ctx.manager.address, payout, { from: ctx.employer });
    await ctx.manager.createJob("ipfs://safe", payout, 1000, "safe", { from: ctx.employer });
    await ctx.token.mint(ctx.agent, web3.utils.toBN(web3.utils.toWei("10")), { from: ctx.owner });
    await ctx.token.approve(ctx.manager.address, web3.utils.toBN(web3.utils.toWei("10")), { from: ctx.agent });
    await ctx.manager.applyForJob(0, "agent", [], { from: ctx.agent });
  });
});
