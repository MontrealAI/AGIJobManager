const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const HookERC20 = artifacts.require("HookERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const ReenteringEmployer = artifacts.require("ReenteringEmployer");

const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");

const ZERO_ROOT = "0x" + "00".repeat(32);

contract("AGIJobManager delistJob reentrancy regression", (accounts) => {
  const [owner, sponsor] = accounts;
  let token;
  let manager;
  let employer;

  beforeEach(async () => {
    token = await HookERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

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
        ZERO_ROOT,
      ),
      { from: owner }
    );

    employer = await ReenteringEmployer.new(manager.address, { from: owner });

    const payout = web3.utils.toBN(web3.utils.toWei("10"));
    await token.mint(employer.address, payout, { from: owner });
    await employer.approveToken(token.address, manager.address, payout, { from: sponsor });
    await employer.createJob("ipfs://spec", payout, 1000, "details", { from: sponsor });
  });

  it("prevents double refunds when token hooks attempt reentrancy", async () => {
    const payout = web3.utils.toBN(web3.utils.toWei("10"));
    const before = await token.balanceOf(employer.address);

    await manager.delistJob(0, { from: owner });

    const after = await token.balanceOf(employer.address);
    assert.strictEqual(after.sub(before).toString(), payout.toString());

    const attempted = await employer.attempted();
    const reentered = await employer.reentered();
    assert.strictEqual(attempted, true);
    assert.strictEqual(reentered, false);

    await expectCustomError(manager.getJobCore(0), "JobNotFound");
  });
});
