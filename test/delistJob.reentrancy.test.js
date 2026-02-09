const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const HookERC20 = artifacts.require("HookERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const ReentrantEmployer = artifacts.require("ReentrantEmployer");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const { toBN, toWei } = web3.utils;

contract("AGIJobManager delistJob reentrancy regression", (accounts) => {
  const [owner] = accounts;
  let token;
  let manager;
  let employer;

  beforeEach(async () => {
    token = await HookERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(...buildInitConfig(
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

    employer = await ReentrantEmployer.new(manager.address, { from: owner });
  });

  it("blocks double refunds when token hook reenters cancelJob", async () => {
    const payout = toBN(toWei("100"));
    const duration = toBN("3600");

    await token.mint(employer.address, payout, { from: owner });
    await employer.approveToken(token.address, manager.address, payout, { from: owner });

    await employer.createJob("ipfs://job", payout, duration, "details", { from: owner });
    const jobId = await employer.jobId();

    const balanceBefore = await token.balanceOf(employer.address);
    await manager.delistJob(jobId, { from: owner });
    const balanceAfter = await token.balanceOf(employer.address);

    assert.strictEqual(balanceAfter.sub(balanceBefore).toString(), payout.toString());
    assert.strictEqual(await employer.attempted(), true);
    assert.strictEqual(await employer.reentered(), false);

    await expectCustomError(manager.getJobCore(jobId), "JobNotFound");
  });
});
