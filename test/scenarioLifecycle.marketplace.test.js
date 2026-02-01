const assert = require("assert");
const { expectRevert } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { rootNode } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager scenario coverage", (accounts) => {
  const [owner, employer, agent, validatorA, validatorB, moderator, buyer, other] = accounts;
  let token;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let agiType;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

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

    agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 92, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validatorA, { from: owner });
    await manager.addAdditionalValidator(validatorB, { from: owner });
    await manager.addModerator(moderator, { from: owner });
    await manager.setRequiredValidatorApprovals(2, { from: owner });
    await manager.setRequiredValidatorDisapprovals(2, { from: owner });
  });

  async function createJobWithApproval(payout, ipfsHash = "ipfs-job") {
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob(ipfsHash, payout, 3600, "details", { from: employer });
    const jobId = createTx.logs.find((log) => log.event === "JobCreated").args.jobId.toNumber();
    return { jobId, createTx };
  }

  async function assignAndRequest(jobId, completionHash) {
    const applyTx = await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    const requestTx = await manager.requestJobCompletion(jobId, completionHash, { from: agent });
    return { applyTx, requestTx };
  }

  it("completes the happy path with payouts, state updates, and NFT issuance", async () => {
    const payout = toBN(toWei("100"));
    await token.mint(employer, payout, { from: owner });
    const balancesBefore = {
      employer: await token.balanceOf(employer),
      agent: await token.balanceOf(agent),
      validatorA: await token.balanceOf(validatorA),
      validatorB: await token.balanceOf(validatorB),
      contract: await token.balanceOf(manager.address),
    };

    const { jobId, createTx } = await createJobWithApproval(payout);
    const { applyTx } = await assignAndRequest(jobId, "ipfs-complete");

    const createdEvent = createTx.logs.find((log) => log.event === "JobCreated");
    assert.ok(createdEvent, "JobCreated event should be emitted");
    assert.equal(createdEvent.args.payout.toString(), payout.toString(), "JobCreated payout mismatch");
    assert.equal(createdEvent.args.jobSpecURI, "ipfs-job", "JobCreated job spec URI mismatch");

    const appliedEvent = applyTx.logs.find((log) => log.event === "JobApplied");
    assert.ok(appliedEvent, "JobApplied event should be emitted");
    assert.equal(appliedEvent.args.agent, agent, "JobApplied agent mismatch");

    const applyJob = await manager.jobs(jobId);
    assert.equal(applyJob.assignedAgent, agent, "assigned agent should be set");
    assert.ok(toBN(applyJob.assignedAt).gt(toBN(0)), "assignedAt should be recorded");

    await manager.validateJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    const finalTx = await manager.validateJob(jobId, "validator-b", EMPTY_PROOF, { from: validatorB });

    const finalJob = await manager.jobs(jobId);
    assert.strictEqual(finalJob.completed, true, "job should be completed");
    assert.strictEqual(finalJob.completionRequested, true, "completionRequested should be true");
    assert.strictEqual(finalJob.disputed, false, "disputed should remain false in happy path");

    const jobCompleted = finalTx.logs.find((log) => log.event === "JobCompleted");
    const nftIssued = finalTx.logs.find((log) => log.event === "NFTIssued");
    assert.ok(jobCompleted, "JobCompleted event should be emitted");
    assert.ok(nftIssued, "NFTIssued event should be emitted");

    const tokenId = nftIssued.args.tokenId.toNumber();
    const tokenUri = await manager.tokenURI(tokenId);
    assert.equal(tokenUri, "ipfs://base/ipfs-complete", "token URI should match base + completion URI");

    const nftOwner = await manager.ownerOf(tokenId);
    assert.equal(nftOwner, employer, "employer should own the job NFT");

    const agentExpected = payout.muln(92).divn(100);
    const validatorExpected = payout.muln(8).divn(100).divn(2);
    const agentBalance = await token.balanceOf(agent);
    const validatorABalance = await token.balanceOf(validatorA);
    const validatorBBalance = await token.balanceOf(validatorB);
    assert.equal(agentBalance.toString(), agentExpected.toString(), "agent payout should match AGI type share");
    assert.equal(validatorABalance.toString(), validatorExpected.toString(), "validator A reward mismatch");
    assert.equal(validatorBBalance.toString(), validatorExpected.toString(), "validator B reward mismatch");

    const balancesAfter = {
      employer: await token.balanceOf(employer),
      agent: await token.balanceOf(agent),
      validatorA: await token.balanceOf(validatorA),
      validatorB: await token.balanceOf(validatorB),
      contract: await token.balanceOf(manager.address),
    };

    const employerDelta = balancesAfter.employer.sub(balancesBefore.employer);
    const agentDelta = balancesAfter.agent.sub(balancesBefore.agent);
    const validatorADelta = balancesAfter.validatorA.sub(balancesBefore.validatorA);
    const validatorBDelta = balancesAfter.validatorB.sub(balancesBefore.validatorB);
    const contractDelta = balancesAfter.contract.sub(balancesBefore.contract);

    const totalDelta = employerDelta.add(agentDelta).add(validatorADelta).add(validatorBDelta).add(contractDelta);
    assert.equal(totalDelta.toString(), "0", "token deltas should conserve payout accounting");
    assert.equal(balancesAfter.contract.toString(), "0", "contract should not retain escrow after completion");

    const agentReputation = await manager.reputation(agent);
    const validatorReputation = await manager.reputation(validatorA);
    assert.ok(agentReputation.gt(toBN(0)), "agent reputation should increase");
    assert.ok(validatorReputation.gt(toBN(0)), "validator reputation should increase");

    await expectCustomError(
      manager.validateJob.call(jobId, "validator-a", EMPTY_PROOF, { from: validatorA }),
      "InvalidState"
    );
  });

  it("allows employer to cancel before assignment and refunds escrow", async () => {
    const payout = toBN(toWei("12"));
    await token.mint(employer, payout, { from: owner });
    const { jobId } = await createJobWithApproval(payout);
    const escrowBalance = await token.balanceOf(manager.address);
    assert.equal(escrowBalance.toString(), payout.toString(), "escrow should hold payout before cancellation");

    const cancelTx = await manager.cancelJob(jobId, { from: employer });
    assert.ok(cancelTx.logs.find((log) => log.event === "JobCancelled"), "JobCancelled event should emit");

    const job = await manager.jobs(jobId);
    assert.equal(job.employer, "0x0000000000000000000000000000000000000000", "job should be deleted");

    const employerBalance = await token.balanceOf(employer);
    assert.equal(employerBalance.toString(), payout.toString(), "employer should be refunded escrow");
    assert.equal((await token.balanceOf(manager.address)).toString(), "0", "escrow should be cleared");
  });

  it("completes without an explicit completion request when validators approve", async () => {
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    const payout = toBN(toWei("18"));
    await token.mint(employer, payout, { from: owner });

    const { jobId } = await createJobWithApproval(payout, "ipfs-no-request");
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    const completionTx = await manager.validateJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    assert.ok(completionTx.logs.find((log) => log.event === "JobCompleted"), "JobCompleted should emit");

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.completed, true, "job should complete with validator approvals");
    assert.strictEqual(job.completionRequested, false, "completionRequested should remain false without request");

    const tokenId = completionTx.logs.find((log) => log.event === "NFTIssued").args.tokenId.toNumber();
    const tokenUri = await manager.tokenURI(tokenId);
    assert.equal(tokenUri, "ipfs://base/ipfs-no-request", "token URI should use the job spec URI fallback");
    assert.equal(await manager.ownerOf(tokenId), employer, "employer should receive the NFT");
    assert.equal((await token.balanceOf(manager.address)).toString(), "0", "escrow should clear after completion");
  });

  it("prevents cancellation after assignment or completion", async () => {
    const payout = toBN(toWei("10"));
    await token.mint(employer, payout, { from: owner });
    const { jobId } = await createJobWithApproval(payout);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    await expectCustomError(manager.cancelJob.call(jobId, { from: employer }), "InvalidState");

    await manager.requestJobCompletion(jobId, "ipfs", { from: agent });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.validateJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });

    await expectCustomError(manager.cancelJob.call(jobId, { from: employer }), "InvalidState");
  });

  it("disputes via disapprovals and resolves agent win with payouts", async () => {
    const payout = toBN(toWei("50"));
    await token.mint(employer, payout, { from: owner });
    const { jobId } = await createJobWithApproval(payout);
    await assignAndRequest(jobId, "ipfs-disputed");

    const balancesBefore = {
      agent: await token.balanceOf(agent),
      validatorA: await token.balanceOf(validatorA),
      validatorB: await token.balanceOf(validatorB),
      contract: await token.balanceOf(manager.address),
    };

    await manager.disapproveJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    const disputeTx = await manager.disapproveJob(jobId, "validator-b", EMPTY_PROOF, { from: validatorB });
    assert.ok(disputeTx.logs.find((log) => log.event === "JobDisputed"), "JobDisputed should emit");

    await manager.resolveDispute(jobId, "agent win", { from: moderator });

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.completed, true, "job should complete after agent win");
    assert.strictEqual(job.disputed, false, "disputed flag should clear");

    const tokenId = (await manager.nextTokenId()).toNumber() - 1;
    const ownerOfToken = await manager.ownerOf(tokenId);
    assert.equal(ownerOfToken, employer, "employer should receive the NFT on agent win");

    const balancesAfter = {
      agent: await token.balanceOf(agent),
      validatorA: await token.balanceOf(validatorA),
      validatorB: await token.balanceOf(validatorB),
      contract: await token.balanceOf(manager.address),
    };
    assert.ok(balancesAfter.agent.gt(balancesBefore.agent), "agent should be paid on agent-win dispute");
    assert.ok(balancesAfter.validatorA.gt(balancesBefore.validatorA), "validator A should be rewarded");
    assert.ok(balancesAfter.validatorB.gt(balancesBefore.validatorB), "validator B should be rewarded");
    assert.equal(balancesAfter.contract.toString(), "0", "escrow should clear after dispute resolution");
  });

  it("resolves employer-win disputes with refund and no NFT issuance", async () => {
    const payout = toBN(toWei("30"));
    await token.mint(employer, payout, { from: owner });
    const { jobId } = await createJobWithApproval(payout);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    const disputeTx = await manager.disputeJob(jobId, { from: employer });
    assert.ok(disputeTx.logs.find((log) => log.event === "JobDisputed"), "JobDisputed should emit");
    const disputedJob = await manager.jobs(jobId);
    assert.strictEqual(disputedJob.disputed, true, "job should be flagged as disputed");
    await manager.resolveDispute(jobId, "employer win", { from: moderator });

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.completed, true, "job should be closed after employer win");
    assert.strictEqual(job.disputed, false, "disputed flag should clear");

    const employerBalance = await token.balanceOf(employer);
    assert.equal(employerBalance.toString(), payout.toString(), "employer should be refunded");
    assert.equal((await token.balanceOf(manager.address)).toString(), "0", "escrow should clear on employer win");

    assert.equal((await manager.nextTokenId()).toNumber(), 0, "no NFT should be minted");
    await expectRevert(manager.ownerOf(0), "ERC721: invalid token ID");
    await expectCustomError(
      manager.validateJob.call(jobId, "validator-a", EMPTY_PROOF, { from: validatorA }),
      "InvalidState"
    );
  });

  it("keeps disputes active on NO_ACTION and allows later completion", async () => {
    const payout = toBN(toWei("20"));
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });

    await token.mint(employer, payout, { from: owner });
    const { jobId } = await createJobWithApproval(payout);
    await assignAndRequest(jobId, "ipfs-neutral");

    await manager.disapproveJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    await manager.resolveDisputeWithCode(jobId, 0, "needs more work", { from: moderator });

    const midJob = await manager.jobs(jobId);
    assert.strictEqual(midJob.disputed, true, "disputed flag should remain set");
    assert.strictEqual(midJob.completed, false, "job should remain in progress");
    assert.strictEqual(midJob.completionRequested, true, "completion request should be preserved");

    await manager.validateJob(jobId, "validator-b", EMPTY_PROOF, { from: validatorB });
    const finalJob = await manager.jobs(jobId);
    assert.strictEqual(finalJob.completed, true, "job should complete after follow-up validation");
  });

  it("preserves escrow on NO_ACTION dispute resolution until later completion", async () => {
    const payout = toBN(toWei("25"));
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });

    await token.mint(employer, payout, { from: owner });
    const { jobId } = await createJobWithApproval(payout);
    await assignAndRequest(jobId, "ipfs-neutral-escrow");

    await manager.disapproveJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });

    const balancesBefore = {
      employer: await token.balanceOf(employer),
      agent: await token.balanceOf(agent),
      validatorA: await token.balanceOf(validatorA),
      validatorB: await token.balanceOf(validatorB),
      contract: await token.balanceOf(manager.address),
    };

    await manager.resolveDisputeWithCode(jobId, 0, "needs revisions", { from: moderator });
    const midJob = await manager.jobs(jobId);
    assert.strictEqual(midJob.disputed, true, "disputed flag should remain set");
    assert.strictEqual(midJob.completed, false, "job should remain open after neutral resolution");

    const balancesAfter = {
      employer: await token.balanceOf(employer),
      agent: await token.balanceOf(agent),
      validatorA: await token.balanceOf(validatorA),
      validatorB: await token.balanceOf(validatorB),
      contract: await token.balanceOf(manager.address),
    };

    assert.equal(balancesAfter.employer.toString(), balancesBefore.employer.toString(), "employer balance unchanged");
    assert.equal(balancesAfter.agent.toString(), balancesBefore.agent.toString(), "agent should not be paid yet");
    assert.equal(balancesAfter.validatorA.toString(), balancesBefore.validatorA.toString(), "validator A should not be paid yet");
    assert.equal(balancesAfter.validatorB.toString(), balancesBefore.validatorB.toString(), "validator B should not be paid yet");
    assert.equal(balancesAfter.contract.toString(), payout.toString(), "escrow should remain locked");

    await manager.validateJob(jobId, "validator-b", EMPTY_PROOF, { from: validatorB });
    const balancesFinal = {
      agent: await token.balanceOf(agent),
      contract: await token.balanceOf(manager.address),
    };
    assert.ok(balancesFinal.agent.gt(balancesAfter.agent), "agent should be paid on final completion");
    assert.equal(balancesFinal.contract.toString(), "0", "escrow should clear after completion");
  });

  it("pauses state-changing actions and resumes after unpause", async () => {
    const payout = toBN(toWei("8"));
    await token.mint(employer, payout, { from: owner });

    await manager.pause({ from: owner });

    await expectRevert(
      manager.createJob("ipfs-job", payout, 3600, "details", { from: employer }),
      "Pausable: paused"
    );

    await manager.unpause({ from: owner });
    const { jobId } = await createJobWithApproval(payout, "ipfs-job");
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    await manager.pause({ from: owner });
    await expectRevert(
      manager.requestJobCompletion(jobId, "ipfs-paused", { from: agent }),
      "Pausable: paused"
    );
    await expectRevert(
      manager.validateJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA }),
      "Pausable: paused"
    );
    await expectRevert(
      manager.disapproveJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA }),
      "Pausable: paused"
    );
    await expectRevert(manager.disputeJob(jobId, { from: employer }), "Pausable: paused");
    await expectRevert(manager.contributeToRewardPool(payout, { from: employer }), "Pausable: paused");

    await manager.unpause({ from: owner });
    await manager.requestJobCompletion(jobId, "ipfs-resumed", { from: agent });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.validateJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });

    const job = await manager.jobs(jobId);
    assert.strictEqual(job.completed, true, "job should complete after unpause");
  });

  it("lists and purchases NFTs with marketplace invariants", async () => {
    const payout = toBN(toWei("40"));
    await manager.setRequiredValidatorApprovals(1, { from: owner });

    await token.mint(employer, payout, { from: owner });
    const { jobId } = await createJobWithApproval(payout);
    await assignAndRequest(jobId, "ipfs-market");
    const mintTx = await manager.validateJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    const tokenId = mintTx.logs.find((log) => log.event === "NFTIssued").args.tokenId.toNumber();

    const price = toBN(toWei("5"));
    await manager.listNFT(tokenId, price, { from: employer });
    const listing = await manager.listings(tokenId);
    assert.strictEqual(listing.isActive, true, "listing should be active");
    assert.equal(listing.seller, employer, "seller should be employer");
    assert.equal(listing.price.toString(), price.toString(), "listing price should match");

    await token.mint(buyer, price, { from: owner });
    await token.approve(manager.address, price, { from: buyer });
    const balancesBefore = {
      buyer: await token.balanceOf(buyer),
      seller: await token.balanceOf(employer),
      contract: await token.balanceOf(manager.address),
    };
    const purchaseTx = await manager.purchaseNFT(tokenId, { from: buyer });
    assert.ok(purchaseTx.logs.find((log) => log.event === "NFTPurchased"), "NFTPurchased should emit");

    const newOwner = await manager.ownerOf(tokenId);
    assert.equal(newOwner, buyer, "buyer should own NFT after purchase");

    const postListing = await manager.listings(tokenId);
    assert.strictEqual(postListing.isActive, false, "listing should be inactive after purchase");

    await expectCustomError(manager.purchaseNFT.call(tokenId, { from: buyer }), "InvalidState");

    const balancesAfter = {
      buyer: await token.balanceOf(buyer),
      seller: await token.balanceOf(employer),
      contract: await token.balanceOf(manager.address),
    };
    assert.equal(balancesAfter.buyer.toString(), balancesBefore.buyer.sub(price).toString(), "buyer balance should decrease by price");
    assert.equal(balancesAfter.seller.toString(), balancesBefore.seller.add(price).toString(), "seller should receive price");
    assert.equal(balancesAfter.contract.toString(), balancesBefore.contract.toString(), "contract should not retain marketplace funds");
  });

  it("blocks invalid marketplace actions and documents self-purchase behavior", async () => {
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    const payout = toBN(toWei("20"));

    await token.mint(employer, payout, { from: owner });
    const { jobId } = await createJobWithApproval(payout);
    await assignAndRequest(jobId, "ipfs-market-2");
    await manager.validateJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });

    const tokenId = (await manager.nextTokenId()).toNumber() - 1;
    await expectCustomError(manager.listNFT.call(tokenId, toBN(toWei("4")), { from: other }), "NotAuthorized");

    const price = toBN(toWei("4"));
    await manager.listNFT(tokenId, price, { from: employer });

    await expectCustomError(manager.purchaseNFT.call(tokenId + 1, { from: buyer }), "InvalidState");

    await token.mint(buyer, price, { from: owner });
    await expectCustomError(manager.purchaseNFT.call(tokenId, { from: buyer }), "TransferFailed");

    await token.mint(employer, price, { from: owner });
    await token.approve(manager.address, price, { from: employer });
    await expectCustomError(manager.purchaseNFT.call(tokenId, { from: employer }), "NotAuthorized");

    const listing = await manager.listings(tokenId);
    assert.strictEqual(listing.isActive, true, "listing should remain active after self-purchase attempt");
    const ownerOfToken = await manager.ownerOf(tokenId);
    assert.equal(ownerOfToken, employer, "self-purchase attempt keeps NFT ownership unchanged");
  });

  it("prevents validators from approving and disapproving the same job", async () => {
    const payout = toBN(toWei("15"));
    await token.mint(employer, payout, { from: owner });
    const { jobId } = await createJobWithApproval(payout);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    await manager.validateJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    await expectCustomError(
      manager.disapproveJob.call(jobId, "validator-a", EMPTY_PROOF, { from: validatorA }),
      "InvalidState"
    );
  });

  it("prevents validators from approving after disapproving", async () => {
    const payout = toBN(toWei("14"));
    await token.mint(employer, payout, { from: owner });
    const { jobId } = await createJobWithApproval(payout);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    await manager.disapproveJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    await expectCustomError(
      manager.validateJob.call(jobId, "validator-a", EMPTY_PROOF, { from: validatorA }),
      "InvalidState"
    );
  });
});
