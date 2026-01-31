const AGIJobManager = artifacts.require("AGIJobManager");
const ERC20NoReturn = artifacts.require("ERC20NoReturn");
const FailingERC20 = artifacts.require("FailingERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const { toBN, toWei } = web3.utils;

contract("AGIJobManager ERC20 compatibility", (accounts) => {
  const [owner, employer] = accounts;
  let ens;
  let nameWrapper;

  beforeEach(async () => {
    ens = await MockENS.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });
  });

  async function deployManager(tokenAddress) {
    return AGIJobManager.new(
      tokenAddress,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      ZERO_ROOT,
      ZERO_ROOT,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );
  }

  it("accepts tokens that return no data for transfer/transferFrom", async () => {
    const token = await ERC20NoReturn.new({ from: owner });
    const manager = await deployManager(token.address);
    const payout = toBN(toWei("10"));

    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.cancelJob(jobId, { from: employer });

    const employerBalance = await token.balanceOf(employer);
    const contractBalance = await token.balanceOf(manager.address);
    assert.equal(employerBalance.toString(), payout.toString(), "employer should be refunded");
    assert.equal(contractBalance.toString(), "0", "contract balance should be cleared");
  });

  it("reverts when ERC20 transferFrom returns false", async () => {
    const token = await FailingERC20.new({ from: owner });
    const manager = await deployManager(token.address);
    const payout = toBN(toWei("5"));

    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await token.setFailTransferFroms(true, { from: owner });

    await expectCustomError(
      manager.createJob.call("ipfs-job", payout, 3600, "details", { from: employer }),
      "TransferFailed"
    );
  });
});
