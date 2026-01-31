const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const ERC20NoReturn = artifacts.require("ERC20NoReturn");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { rootNode } = require("./helpers/ens");
const { expectRevert } = require("@openzeppelin/test-helpers");

const ZERO_ROOT = "0x" + "00".repeat(32);

contract("AGIJobManager ERC20 compatibility", (accounts) => {
  const [owner, employer] = accounts;
  let token;
  let manager;

  beforeEach(async () => {
    token = await ERC20NoReturn.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      rootNode("club-root"),
      rootNode("agent-root"),
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );
  });

  it("accepts ERC20 tokens that return no data on transfer/transferFrom", async () => {
    const payout = web3.utils.toWei("25");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.cancelJob(jobId, { from: employer });

    const employerBalance = await token.balanceOf(employer);
    assert.equal(employerBalance.toString(), payout.toString(), "employer should be refunded");
  });

  it("reverts with TransferFailed when transferFrom cannot be completed", async () => {
    const payout = web3.utils.toWei("10");
    await token.mint(employer, payout, { from: owner });

    await expectRevert.unspecified(
      manager.createJob("ipfs-job", payout, 3600, "details", { from: employer })
    );
  });
});
