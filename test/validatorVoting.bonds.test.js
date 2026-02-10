const assert = require("assert");
const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");
const { fundAgents, fundValidators, computeValidatorBond } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager validator voting and bonds", (accounts) => {
  const [owner, employer, agent, validatorA, validatorB, validatorC] = accounts;
  let token;
  let manager;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    manager = await AGIJobManager.new(...buildInitConfig(token.address, "ipfs://base", ens.address, nameWrapper.address, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT), { from: owner });

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 85, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validatorA, { from: owner });
    await manager.addAdditionalValidator(validatorB, { from: owner });
    await manager.addAdditionalValidator(validatorC, { from: owner });
    await manager.setRequiredValidatorApprovals(2, { from: owner });
    await manager.setRequiredValidatorDisapprovals(2, { from: owner });
    await manager.setVoteQuorum(2, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });

    await fundAgents(token, manager, [agent], owner);
    await fundValidators(token, manager, [validatorA, validatorB, validatorC], owner);
  });

  async function createReadyJob(payout) {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs://job", payout, 1000, "details", { from: employer });
    const jobId = tx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs://done", { from: agent });
    return jobId;
  }

  it("prevents double-voting and keeps validator bond sizing consistent", async () => {
    const payout = toBN(toWei("20"));
    const jobId = await createReadyJob(payout);
    const expectedBond = await computeValidatorBond(manager, payout);

    await manager.validateJob(jobId, "", EMPTY_PROOF, { from: validatorA });
    assert.equal((await manager.lockedValidatorBonds()).toString(), expectedBond.toString());

    await expectCustomError(manager.validateJob.call(jobId, "", EMPTY_PROOF, { from: validatorA }), "InvalidState");

    await manager.disapproveJob(jobId, "", EMPTY_PROOF, { from: validatorB });
    assert.equal((await manager.lockedValidatorBonds()).toString(), expectedBond.muln(2).toString());
  });

  it("rewards a correct validator on finalize once quorum is met", async () => {
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setVoteQuorum(1, { from: owner });
    const payout = toBN(toWei("30"));
    const jobId = await createReadyJob(payout);

    const balA0 = await token.balanceOf(validatorA);
    const balB0 = await token.balanceOf(validatorB);
    await manager.validateJob(jobId, "", EMPTY_PROOF, { from: validatorA });

    await time.increase(2);
    await manager.finalizeJob(jobId, { from: employer });

    const balA1 = await token.balanceOf(validatorA);
    const balB1 = await token.balanceOf(validatorB);
    assert(balA1.gt(balA0), "correct validator should be rewarded");
    assert.equal(balB1.toString(), balB0.toString(), "non-participating validator should be unchanged");
  });
});
