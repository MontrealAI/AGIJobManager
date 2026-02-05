const assert = require("assert");

const { expectRevert, time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockERC721 = artifacts.require("MockERC721");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");
const { fundValidators, computeValidatorBond } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager escrow accounting", (accounts) => {
  const [owner, employer, agent, validator, moderator, validatorTwo] = accounts;
  let token;
  let ens;
  let nameWrapper;
  let manager;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

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

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 50, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.addAdditionalValidator(validatorTwo, { from: owner });
    await manager.addModerator(moderator, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });

    await fundValidators(token, manager, [validator, validatorTwo], owner);
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

  it("prevents withdrawing bonded validator funds before settlement", async () => {
    await manager.setRequiredValidatorApprovals(2, { from: owner });
    const payout = toBN(toWei("6"));
    const jobId = await createJob(payout);
    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.validateJob(jobId, "", EMPTY_PROOF, { from: validator });

    const bond = await computeValidatorBond(manager, payout);
    const lockedBonds = await manager.lockedValidatorBonds();
    assert.equal(lockedBonds.toString(), bond.toString(), "validator bond should be locked");

    const withdrawable = await manager.withdrawableAGI();
    assert.equal(withdrawable.toString(), "0", "withdrawable should exclude locked bonds");

    await manager.pause({ from: owner });
    await expectCustomError(
      manager.withdrawAGI.call(toBN(1), { from: owner }),
      "InsufficientWithdrawableBalance"
    );
  });

  it("requires validator bond allowance for votes", async () => {
    const payout = toBN(toWei("5"));
    const jobId = await createJob(payout);
    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await token.approve(manager.address, 0, { from: validatorTwo });
    await expectCustomError(
      manager.validateJob.call(jobId, "", EMPTY_PROOF, { from: validatorTwo }),
      "TransferFailed"
    );
    await expectCustomError(
      manager.disapproveJob.call(jobId, "", EMPTY_PROOF, { from: validatorTwo }),
      "TransferFailed"
    );
  });

  it("slashes incorrect validators and rewards correct validators", async () => {
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(2, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });

    const payout = toBN(toWei("100"));
    const jobId = await createJob(payout);
    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    const bond = await computeValidatorBond(manager, payout);
    const validatorBefore = await token.balanceOf(validator);
    const validatorTwoBefore = await token.balanceOf(validatorTwo);

    await manager.validateJob(jobId, "", EMPTY_PROOF, { from: validator });
    await manager.disapproveJob(jobId, "", EMPTY_PROOF, { from: validatorTwo });

    await time.increase(2);
    await manager.finalizeJob(jobId, { from: employer });

    const validatorAfter = await token.balanceOf(validator);
    const validatorTwoAfter = await token.balanceOf(validatorTwo);
    const rewardPool = payout.mul(await manager.validationRewardPercentage()).divn(100);
    const expectedValidatorGain = rewardPool.add(bond);
    assert.equal(
      validatorAfter.sub(validatorBefore).toString(),
      expectedValidatorGain.toString(),
      "correct validator should gain reward plus slashed bond"
    );
    assert.equal(
      validatorTwoBefore.sub(validatorTwoAfter).toString(),
      bond.toString(),
      "incorrect validator should lose bonded amount"
    );
  });

  it("refunds employer minus validator rewards when validators participate", async () => {
    await manager.setRequiredValidatorApprovals(2, { from: owner });
    await manager.setRequiredValidatorDisapprovals(2, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });

    const payout = toBN(toWei("12"));
    const jobId = await createJob(payout);
    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    const employerBefore = await token.balanceOf(employer);
    const validatorBefore = await token.balanceOf(validator);
    await manager.disapproveJob(jobId, "", EMPTY_PROOF, { from: validator });

    await time.increase(2);
    await manager.finalizeJob(jobId, { from: employer });

    const employerAfter = await token.balanceOf(employer);
    const validatorAfter = await token.balanceOf(validator);
    const rewardPool = payout.mul(await manager.validationRewardPercentage()).divn(100);
    assert.equal(
      employerAfter.sub(employerBefore).toString(),
      payout.sub(rewardPool).toString(),
      "employer refund should exclude validator rewards"
    );
    assert.equal(
      validatorAfter.sub(validatorBefore).toString(),
      rewardPool.toString(),
      "correct disapprover should earn reward pool"
    );
  });

  it("enforces the challenge window after validator approval", async () => {
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(100, { from: owner });

    const payout = toBN(toWei("8"));
    const jobId = await createJob(payout);
    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.validateJob(jobId, "", EMPTY_PROOF, { from: validator });
    await expectCustomError(
      manager.finalizeJob.call(jobId, { from: employer }),
      "InvalidState"
    );

    await manager.disapproveJob(jobId, "", EMPTY_PROOF, { from: validatorTwo });
    const job = await manager.getJobCore(jobId);
    assert.equal(job.disputed, true, "dispute should be allowed during the challenge window");
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
    await time.increase((await manager.challengePeriodAfterApproval()).addn(1));
    await manager.finalizeJob(completeJobId, { from: employer });
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

  it("treats completion remainder and reward pool contributions as treasury", async () => {
    const payout = toBN(toWei("10"));
    const jobId = await createJob(payout);
    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await manager.validateJob(jobId, "", EMPTY_PROOF, { from: validator });

    const agentPct = await manager.getHighestPayoutPercentage(agent);
    const validatorPct = await manager.validationRewardPercentage();
    const remainderPct = toBN("100").sub(agentPct).sub(validatorPct);
    const expectedRemainder = payout.mul(remainderPct).divn(100);

    const withdrawableAfterCompletion = await manager.withdrawableAGI();
    assert.equal(
      withdrawableAfterCompletion.toString(),
      expectedRemainder.toString(),
      "withdrawable should equal completion remainder"
    );

    const contribution = toBN(toWei("1"));
    await token.mint(owner, contribution, { from: owner });
    await token.approve(manager.address, contribution, { from: owner });
    await manager.contributeToRewardPool(contribution, { from: owner });

    const withdrawableAfterContribution = await manager.withdrawableAGI();
    assert.equal(
      withdrawableAfterContribution.toString(),
      expectedRemainder.add(contribution).toString(),
      "reward pool contributions should increase treasury"
    );

    await manager.pause({ from: owner });
    await manager.withdrawAGI(expectedRemainder.add(contribution), { from: owner });
    const remainingWithdrawable = await manager.withdrawableAGI();
    assert.equal(remainingWithdrawable.toString(), "0", "treasury should be withdrawable when paused");
  });
});
