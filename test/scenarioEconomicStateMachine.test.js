const assert = require("assert");
const { expectRevert, time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { rootNode } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");
const { fundValidators, fundAgents, computeValidatorBond, computeAgentBond } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager economic state-machine scenarios", (accounts) => {
  const [owner, employer, agent, validatorA, validatorB, moderator, other] = accounts;
  let token;
  let manager;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        rootNode("club-root"),
        rootNode("agent-root"),
        rootNode("club-root"),
        rootNode("agent-root"),
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 92, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validatorA, { from: owner });
    await manager.addAdditionalValidator(validatorB, { from: owner });
    await manager.addModerator(moderator, { from: owner });
    await manager.setRequiredValidatorApprovals(2, { from: owner });
    await manager.setRequiredValidatorDisapprovals(2, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });

    await fundValidators(token, manager, [validatorA, validatorB], owner);
    await fundAgents(token, manager, [agent], owner);
  });

  async function createJob(payout, ipfsHash = "ipfs-job") {
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob(ipfsHash, payout, 3600, "details", { from: employer });
    const jobId = tx.logs.find((log) => log.event === "JobCreated").args.jobId.toNumber();
    return jobId;
  }

  async function assignAndRequest(jobId, completionHash = "ipfs-complete") {
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, completionHash, { from: agent });
  }

  it("runs the full economic lifecycle through settlement and NFT issuance", async () => {
    const payout = toBN(toWei("100"));
    await token.mint(employer, payout, { from: owner });

    const balancesBefore = {
      employer: await token.balanceOf(employer),
      agent: await token.balanceOf(agent),
      validatorA: await token.balanceOf(validatorA),
      validatorB: await token.balanceOf(validatorB),
      contract: await token.balanceOf(manager.address),
    };

    const jobId = await createJob(payout);
    const createdJob = await manager.getJobCore(jobId);
    assert.equal(createdJob.employer, employer, "job should record employer");
    assert.equal(createdJob.payout.toString(), payout.toString(), "payout should be recorded");
    const createdJobUri = await manager.getJobSpecURI(jobId);
    assert.equal(createdJobUri, "ipfs-job", "job spec URI should be recorded");
    assert.equal((await token.balanceOf(manager.address)).toString(), payout.toString(), "escrow should hold payout");

    await assignAndRequest(jobId, "ipfs-complete");
    const agentBond = await computeAgentBond(manager, payout, toBN(3600));
    assert.equal(
      (await token.balanceOf(agent)).toString(),
      balancesBefore.agent.sub(agentBond).toString(),
      "agent should not be paid before completion"
    );

    await manager.validateJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    await manager.validateJob(jobId, "validator-b", EMPTY_PROOF, { from: validatorB });
    await time.increase(2);
    const finalTx = await manager.finalizeJob(jobId, { from: employer });

    const job = await manager.getJobCore(jobId);
    const jobValidation = await manager.getJobValidation(jobId);
    assert.strictEqual(job.completed, true, "job should be completed");
    assert.strictEqual(jobValidation.completionRequested, true, "completionRequested should be true");
    assert.strictEqual(job.disputed, false, "job should not be disputed");

    const nftEvent = finalTx.logs.find((log) => log.event === "NFTIssued");
    const tokenId = nftEvent.args.tokenId.toNumber();
    const tokenUri = await manager.tokenURI(tokenId);
    assert.equal(tokenUri, "ipfs://base/ipfs-complete", "tokenURI should match completion URI");
    assert.equal(await manager.ownerOf(tokenId), employer, "employer should receive job NFT");

    const agentExpected = payout.muln(92).divn(100);
    const validatorExpected = payout.muln(8).divn(100).divn(2);

    const balancesAfter = {
      employer: await token.balanceOf(employer),
      agent: await token.balanceOf(agent),
      validatorA: await token.balanceOf(validatorA),
      validatorB: await token.balanceOf(validatorB),
      contract: await token.balanceOf(manager.address),
    };

    assert.equal(
      balancesAfter.employer.toString(),
      balancesBefore.employer.sub(payout).toString(),
      "employer balance should drop by payout"
    );
    assert.equal(
      balancesAfter.agent.sub(balancesBefore.agent).toString(),
      agentExpected.toString(),
      "agent payout should match expected share"
    );
    assert.equal(
      balancesAfter.validatorA.toString(),
      balancesBefore.validatorA.add(validatorExpected).toString(),
      "validator A payout should match expected share"
    );
    assert.equal(
      balancesAfter.validatorB.toString(),
      balancesBefore.validatorB.add(validatorExpected).toString(),
      "validator B payout should match expected share"
    );
    assert.equal(balancesAfter.contract.toString(), "0", "escrow should clear after completion");

    await expectCustomError(
      manager.validateJob.call(jobId, "validator-a", EMPTY_PROOF, { from: validatorA }),
      "InvalidState"
    );

  });

  it("blocks actions while paused and enforces owner-only pause controls", async () => {
    await expectRevert.unspecified(manager.pause({ from: other }));

    await manager.pause({ from: owner });
    await expectRevert.unspecified(
      manager.createJob("ipfs-job", toBN(toWei("1")), 3600, "details", { from: employer }));

    await manager.unpause({ from: owner });
    await manager.pause({ from: owner });
    await expectRevert.unspecified(manager.applyForJob(0, "agent", EMPTY_PROOF, { from: agent }));
    await expectRevert.unspecified(manager.disputeJob(0, { from: employer }));
  });

  it("rejects role violations, blacklists, and invalid state transitions", async () => {
    const payout = toBN(toWei("12"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout);
    await expectCustomError(
      manager.validateJob.call(jobId, "validator-b", EMPTY_PROOF, { from: validatorB }),
      "InvalidState"
    );
    await expectCustomError(
      manager.applyForJob.call(jobId, "agent", EMPTY_PROOF, { from: other }),
      "NotAuthorized"
    );

    await manager.blacklistAgent(agent, true, { from: owner });
    await expectCustomError(
      manager.applyForJob.call(jobId, "agent", EMPTY_PROOF, { from: agent }),
      "Blacklisted"
    );
    await manager.blacklistAgent(agent, false, { from: owner });

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.blacklistValidator(validatorA, true, { from: owner });
    await expectCustomError(
      manager.validateJob.call(jobId, "validator-a", EMPTY_PROOF, { from: validatorA }),
      "Blacklisted"
    );

    await expectCustomError(manager.cancelJob.call(jobId, { from: employer }), "InvalidState");

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.validateJob(jobId, "validator-b", EMPTY_PROOF, { from: validatorB });
    await expectCustomError(
      manager.disapproveJob.call(jobId, "validator-b", EMPTY_PROOF, { from: validatorB }),
      "InvalidState"
    );

  });

  it("resolves disputes with correct economic outcomes", async () => {
    const payout = toBN(toWei("40"));
    await token.mint(employer, payout, { from: owner });

    const jobId = await createJob(payout, "ipfs-dispute");
    await assignAndRequest(jobId, "ipfs-dispute-complete");

    await manager.disapproveJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    await manager.disapproveJob(jobId, "validator-b", EMPTY_PROOF, { from: validatorB });

    const balancesBefore = {
      agent: await token.balanceOf(agent),
      validatorA: await token.balanceOf(validatorA),
      validatorB: await token.balanceOf(validatorB),
      contract: await token.balanceOf(manager.address),
    };

    await manager.resolveDispute(jobId, "agent win", { from: moderator });
    const jobAfterAgentWin = await manager.getJobCore(jobId);
    assert.strictEqual(jobAfterAgentWin.completed, true, "agent-win dispute should complete job");
    assert.strictEqual(jobAfterAgentWin.disputed, false, "dispute flag should clear after resolution");
    const agentPayoutPct = toBN(jobAfterAgentWin.agentPayoutPct);
    const expectedAgentPayout = payout.mul(agentPayoutPct).divn(100);
    const bond = await computeValidatorBond(manager, payout);
    const slashedPerIncorrect = bond.mul(await manager.validatorSlashBps()).divn(10000);
    const incorrectRefund = bond.sub(slashedPerIncorrect);
    await expectCustomError(manager.disputeJob.call(jobId, { from: employer }), "InvalidState");

    const balancesAfter = {
      agent: await token.balanceOf(agent),
      validatorA: await token.balanceOf(validatorA),
      validatorB: await token.balanceOf(validatorB),
    };

    assert.ok(balancesAfter.agent.gt(balancesBefore.agent), "agent should receive payout on agent win");
    assert.ok(
      balancesAfter.validatorA.sub(balancesBefore.validatorA).eq(incorrectRefund),
      "disapproving validators should only recover the unslashed bond on agent win"
    );
    assert.ok(
      balancesAfter.validatorB.sub(balancesBefore.validatorB).eq(incorrectRefund),
      "disapproving validators should only recover the unslashed bond on agent win"
    );

    const payoutTwo = toBN(toWei("22"));
    await token.mint(employer, payoutTwo, { from: owner });
    const jobIdTwo = await createJob(payoutTwo, "ipfs-employer-win");
    await manager.applyForJob(jobIdTwo, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobIdTwo, "ipfs-employer-win-complete", { from: agent });

    const validatorABefore = await token.balanceOf(validatorA);
    const validatorBBefore = await token.balanceOf(validatorB);
    await manager.disapproveJob(jobIdTwo, "validator-a", EMPTY_PROOF, { from: validatorA });
    await manager.disapproveJob(jobIdTwo, "validator-b", EMPTY_PROOF, { from: validatorB });
    const disputedJob = await manager.getJobCore(jobIdTwo);
    assert.strictEqual(disputedJob.disputed, true, "job should be disputed after disapprovals");
    await expectCustomError(manager.resolveDispute.call(jobIdTwo, "agent win", { from: other }), "NotModerator");

    const employerBefore = await token.balanceOf(employer);
    await manager.resolveDispute(jobIdTwo, "employer win", { from: moderator });
    const employerAfter = await token.balanceOf(employer);
    const validatorRewardTotal = payoutTwo.mul(await manager.validationRewardPercentage()).divn(100);
    const agentBondTwo = await computeAgentBond(manager, payoutTwo, toBN(3600));
    const validatorReward = validatorRewardTotal.add(agentBondTwo).divn(2);
    assert.equal(
      employerAfter.toString(),
      employerBefore.add(payoutTwo.sub(validatorRewardTotal)).toString(),
      "employer should be refunded minus validator rewards; agent bond routes to disapprovers"
    );
    const validatorAAfter = await token.balanceOf(validatorA);
    const validatorBAfter = await token.balanceOf(validatorB);
    assert.equal(
      validatorAAfter.sub(validatorABefore).toString(),
      validatorReward.toString(),
      "disapproving validator A should earn rewards on employer win"
    );
    assert.equal(
      validatorBAfter.sub(validatorBBefore).toString(),
      validatorReward.toString(),
      "disapproving validator B should earn rewards on employer win"
    );
    assert.equal((await manager.nextTokenId()).toNumber(), 1, "no NFT should mint on employer win");
    const jobAfterEmployerWin = await manager.getJobCore(jobIdTwo);
    assert.strictEqual(jobAfterEmployerWin.completed, true, "employer-win dispute should close job");
    assert.strictEqual(jobAfterEmployerWin.disputed, false, "dispute flag should clear on employer win");
  });
});
