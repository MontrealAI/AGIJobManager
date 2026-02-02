const assert = require("assert");

const { expectRevert, time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockERC721 = artifacts.require("MockERC721");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager escrow accounting", (accounts) => {
  const [owner, employer, agent, validator, moderator] = accounts;
  let token;
  let ens;
  let nameWrapper;
  let manager;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      ZERO_ROOT,
      ZERO_ROOT,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 50, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.addModerator(moderator, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
  });

  const createJob = async (payout, duration = 1000) => {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const receipt = await manager.createJob("ipfs", payout, duration, "details", { from: employer });
    return receipt.logs[0].args.jobId.toNumber();
  };

  it("prevents withdrawing escrowed funds", async () => {
    const payout = toBN(toWei("5"));
    await createJob(payout);

    const lockedEscrow = await manager.lockedEscrow();
    assert.equal(lockedEscrow.toString(), payout.toString(), "locked escrow should track job payout");

    const withdrawable = await manager.withdrawableAGI();
    assert.equal(withdrawable.toString(), "0", "withdrawable should exclude escrow");

    await manager.pause({ from: owner });
    await expectCustomError(
      manager.withdrawAGI.call(toBN(1), { from: owner }),
      "InsufficientWithdrawableBalance"
    );
  });

  it("allows withdrawing surplus only", async () => {
    const payout = toBN(toWei("4"));
    const surplus = toBN(toWei("2"));
    await createJob(payout);
    await token.mint(manager.address, surplus, { from: owner });

    const withdrawable = await manager.withdrawableAGI();
    assert.equal(withdrawable.toString(), surplus.toString(), "withdrawable should be surplus only");

    await expectRevert.unspecified(manager.withdrawAGI(surplus, { from: owner }));
    await manager.pause({ from: owner });
    await manager.withdrawAGI(surplus, { from: owner });

    const remainingWithdrawable = await manager.withdrawableAGI();
    assert.equal(remainingWithdrawable.toString(), "0", "surplus should be fully withdrawn");
    const lockedEscrow = await manager.lockedEscrow();
    assert.equal(lockedEscrow.toString(), payout.toString(), "escrow remains locked");
  });

  it("releases escrow on terminal transitions", async () => {
    const payout = toBN(toWei("3"));

    const delistJobId = await createJob(payout);
    assert.equal((await manager.lockedEscrow()).toString(), payout.toString());
    await manager.delistJob(delistJobId, { from: owner });
    assert.equal((await manager.lockedEscrow()).toString(), "0");

    const cancelJobId = await createJob(payout);
    assert.equal((await manager.lockedEscrow()).toString(), payout.toString());
    await manager.cancelJob(cancelJobId, { from: employer });
    assert.equal((await manager.lockedEscrow()).toString(), "0");

    const completeJobId = await createJob(payout);
    await manager.applyForJob(completeJobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(completeJobId, "ipfs-complete", { from: agent });
    await manager.validateJob(completeJobId, "", EMPTY_PROOF, { from: validator });
    assert.equal((await manager.lockedEscrow()).toString(), "0");

    const disputeJobId = await createJob(payout);
    await manager.applyForJob(disputeJobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(disputeJobId, "ipfs-dispute", { from: agent });
    await manager.disputeJob(disputeJobId, { from: employer });
    await manager.resolveDispute(disputeJobId, "employer win", { from: moderator });
    assert.equal((await manager.lockedEscrow()).toString(), "0");

    const expireJobId = await createJob(payout, 1);
    await manager.applyForJob(expireJobId, "", EMPTY_PROOF, { from: agent });
    await time.increase(2);
    await manager.expireJob(expireJobId, { from: employer });
    assert.equal((await manager.lockedEscrow()).toString(), "0");
  });
});
