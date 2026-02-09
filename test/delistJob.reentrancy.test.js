const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const HookToken = artifacts.require("HookToken");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const ReenteringEmployer = artifacts.require("ReenteringEmployer");

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
    token = await HookToken.new({ from: owner });
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

    employer = await ReenteringEmployer.new(manager.address, token.address, { from: owner });
  });

  it("refunds once and blocks reentrancy during delistJob", async () => {
    const payout = toBN(toWei("10"));
    await token.mint(employer.address, payout, { from: owner });

    const jobId = await manager.nextJobId();
    await employer.setJobId(jobId, { from: owner });
    await employer.createJob("ipfs-spec", payout, 3600, "details", { from: owner });

    const balanceAfterCreate = await token.balanceOf(employer.address);
    assert.equal(balanceAfterCreate.toString(), "0", "employer should escrow payout");

    await manager.delistJob(jobId, { from: owner });

    const balanceAfterRefund = await token.balanceOf(employer.address);
    assert.equal(balanceAfterRefund.toString(), payout.toString(), "refund should occur once");

    assert.equal(await employer.attempted(), true, "employer should attempt reentrancy");
    assert.equal(await employer.reentered(), false, "reentrancy should be blocked");

    await expectCustomError(manager.getJobCore(jobId), "JobNotFound");
  });
});
