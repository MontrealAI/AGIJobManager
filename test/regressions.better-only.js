const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const AGIJobManagerOriginal = artifacts.require("AGIJobManagerOriginal");
const MockERC20 = artifacts.require("MockERC20");
const FailTransferToken = artifacts.require("FailTransferToken");
const MockERC721 = artifacts.require("MockERC721");
const {
  setupAgiToken,
  AGI_TOKEN_ADDRESS,
  CLUB_ROOT_NODE,
  AGENT_ROOT_NODE,
} = require("./helpers/agiToken");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EMPTY_PROOF = [];

const { toBN, toWei, soliditySha3 } = web3.utils;

function leaf(address) {
  return soliditySha3({ type: "address", value: address });
}

async function expectRevert(promise) {
  try {
    await promise;
  } catch (error) {
    const message = error.message || "";
    assert(
      message.includes("revert") || message.includes("invalid opcode") || message.includes("VM Exception"),
      `Expected revert, got: ${message}`
    );
    return;
  }
  assert.fail("Expected revert not received.");
}

async function deployManager(Contract, tokenAddress, agent, validator, owner) {
  return Contract.new(
    tokenAddress,
    "ipfs://base",
    ZERO_ADDRESS,
    ZERO_ADDRESS,
    CLUB_ROOT_NODE,
    AGENT_ROOT_NODE,
    leaf(validator),
    leaf(agent),
    { from: owner }
  );
}

async function createJob(manager, token, employer, payout) {
  const jobId = (await manager.nextJobId()).toNumber();
  await token.approve(manager.address, payout, { from: employer });
  await manager.createJob("ipfs1", payout, 1000, "details", { from: employer });
  return jobId;
}

async function createAssignedJob(manager, token, employer, agent, payout) {
  const jobId = await createJob(manager, token, employer, payout);
  await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
  return jobId;
}

contract("AGIJobManager better-only regressions", (accounts) => {
  const [owner, employer, agent, validator, attacker, moderator] = accounts;

  it("blocks pre-apply takeover in current (original allows it)", async () => {
    const payout = toBN(toWei("10"));
    const token = await setupAgiToken(MockERC20, accounts);
    await token.mint(employer, payout.muln(3), { from: owner });

    const original = await deployManager(AGIJobManagerOriginal, AGI_TOKEN_ADDRESS, attacker, validator, owner);
    const current = await deployManager(AGIJobManager, AGI_TOKEN_ADDRESS, attacker, validator, owner);

    await original.applyForJob(0, "attacker", EMPTY_PROOF, { from: attacker });
    await token.approve(original.address, payout, { from: employer });
    await original.createJob("ipfs", payout, 1000, "details", { from: employer });
    await original.requestJobCompletion(0, "ipfs2", { from: attacker });
    const originalStatus = await original.getJobStatus(0);
    assert.equal(originalStatus[1], true, "original takeover should mark completion requested");

    await expectRevert(current.applyForJob(0, "attacker", EMPTY_PROOF, { from: attacker }));
    await token.approve(current.address, payout, { from: employer });
    await current.createJob("ipfs", payout, 1000, "details", { from: employer });
    await expectRevert(current.requestJobCompletion(0, "ipfs2", { from: attacker }));
  });

  it("prevents disputed double-complete in current (original completes twice)", async () => {
    const payout = toBN(toWei("100"));
    const token = await setupAgiToken(MockERC20, accounts);
    await token.mint(employer, payout.muln(3), { from: owner });

    const nft = await MockERC721.new({ from: owner });
    await nft.mint(agent, { from: owner });

    const original = await deployManager(AGIJobManagerOriginal, AGI_TOKEN_ADDRESS, agent, validator, owner);
    await original.addAGIType(nft.address, 92, { from: owner });
    const originalJobId = await createAssignedJob(original, token, employer, agent, payout);
    await original.requestJobCompletion(originalJobId, "ipfs-complete", { from: agent });
    await original.disputeJob(originalJobId, { from: employer });
    await original.addModerator(moderator, { from: owner });
    await original.setRequiredValidatorApprovals(1, { from: owner });
    await token.mint(original.address, payout, { from: owner });
    await original.validateJob(originalJobId, "validator", EMPTY_PROOF, { from: validator });
    assert.equal((await original.nextTokenId()).toNumber(), 1, "original should mint once after validation");
    await original.resolveDispute(originalJobId, "agent win", { from: moderator });
    assert.equal((await original.nextTokenId()).toNumber(), 2, "original should mint twice after dispute resolution");

    const current = await deployManager(AGIJobManager, AGI_TOKEN_ADDRESS, agent, validator, owner);
    await current.addAGIType(nft.address, 92, { from: owner });
    const currentJobId = await createAssignedJob(current, token, employer, agent, payout);
    await current.requestJobCompletion(currentJobId, "ipfs-complete", { from: agent });
    await current.disputeJob(currentJobId, { from: employer });
    await current.addModerator(moderator, { from: owner });
    await current.setRequiredValidatorApprovals(1, { from: owner });
    await token.mint(current.address, payout, { from: owner });
    await expectRevert(current.validateJob(currentJobId, "validator", EMPTY_PROOF, { from: validator }));
    assert.equal((await current.nextTokenId()).toNumber(), 0, "current should not mint while disputed");
    await current.resolveDispute(currentJobId, "agent win", { from: moderator });
    assert.equal((await current.nextTokenId()).toNumber(), 1, "current should mint once via dispute resolution");
  });

  it("avoids div-by-zero on agent-win disputes in current", async () => {
    const payout = toBN(toWei("50"));
    const token = await setupAgiToken(MockERC20, accounts);
    await token.mint(employer, payout.muln(2), { from: owner });

    const nft = await MockERC721.new({ from: owner });
    await nft.mint(agent, { from: owner });

    const original = await deployManager(AGIJobManagerOriginal, AGI_TOKEN_ADDRESS, agent, validator, owner);
    await original.addAGIType(nft.address, 92, { from: owner });
    const originalJobId = await createAssignedJob(original, token, employer, agent, payout);
    await original.requestJobCompletion(originalJobId, "ipfs-complete", { from: agent });
    await original.disputeJob(originalJobId, { from: employer });
    await original.addModerator(moderator, { from: owner });
    await expectRevert(original.resolveDispute(originalJobId, "agent win", { from: moderator }));
    assert.equal((await original.nextTokenId()).toNumber(), 0, "original should not mint on div-by-zero");

    const current = await deployManager(AGIJobManager, AGI_TOKEN_ADDRESS, agent, validator, owner);
    await current.addAGIType(nft.address, 92, { from: owner });
    const currentJobId = await createAssignedJob(current, token, employer, agent, payout);
    await current.requestJobCompletion(currentJobId, "ipfs-complete", { from: agent });
    await current.disputeJob(currentJobId, { from: employer });
    await current.addModerator(moderator, { from: owner });
    await current.resolveDispute(currentJobId, "agent win", { from: moderator });
    assert.equal((await current.nextTokenId()).toNumber(), 1, "current should mint despite zero validators");
  });

  it("blocks validator double-votes in current (original allows it)", async () => {
    const payout = toBN(toWei("20"));
    const token = await setupAgiToken(MockERC20, accounts);
    await token.mint(employer, payout.muln(4), { from: owner });

    const original = await deployManager(AGIJobManagerOriginal, AGI_TOKEN_ADDRESS, agent, validator, owner);
    const approveThenDisapproveId = await createAssignedJob(original, token, employer, agent, payout);
    await original.validateJob(approveThenDisapproveId, "validator", EMPTY_PROOF, { from: validator });
    await original.disapproveJob(approveThenDisapproveId, "validator", EMPTY_PROOF, { from: validator });
    const approveThenDisapproveJob = await original.jobs(approveThenDisapproveId);
    assert.equal(approveThenDisapproveJob.validatorApprovals.toNumber(), 1, "original should track approvals");
    assert.equal(approveThenDisapproveJob.validatorDisapprovals.toNumber(), 1, "original should allow disapproval after approval");

    const disapproveThenApproveId = await createAssignedJob(original, token, employer, agent, payout);
    await original.disapproveJob(disapproveThenApproveId, "validator", EMPTY_PROOF, { from: validator });
    await original.validateJob(disapproveThenApproveId, "validator", EMPTY_PROOF, { from: validator });
    const disapproveThenApproveJob = await original.jobs(disapproveThenApproveId);
    assert.equal(disapproveThenApproveJob.validatorApprovals.toNumber(), 1, "original should allow approval after disapproval");
    assert.equal(disapproveThenApproveJob.validatorDisapprovals.toNumber(), 1, "original should track disapprovals");

    const current = await deployManager(AGIJobManager, AGI_TOKEN_ADDRESS, agent, validator, owner);
    const nft = await MockERC721.new({ from: owner });
    await nft.mint(agent, { from: owner });
    await current.addAGIType(nft.address, 92, { from: owner });
    const currentApproveThenDisapproveId = await createAssignedJob(current, token, employer, agent, payout);
    await current.requestJobCompletion(currentApproveThenDisapproveId, "ipfs-complete", { from: agent });
    await current.validateJob(currentApproveThenDisapproveId, "validator", EMPTY_PROOF, { from: validator });
    await expectRevert(
      current.disapproveJob(currentApproveThenDisapproveId, "validator", EMPTY_PROOF, { from: validator })
    );

    const currentDisapproveThenApproveId = await createAssignedJob(current, token, employer, agent, payout);
    await current.requestJobCompletion(currentDisapproveThenApproveId, "ipfs-complete", { from: agent });
    await current.disapproveJob(currentDisapproveThenApproveId, "validator", EMPTY_PROOF, { from: validator });
    await expectRevert(
      current.validateJob(currentDisapproveThenApproveId, "validator", EMPTY_PROOF, { from: validator })
    );
  });

  it("closes employer-win disputes in current (original allows later completion)", async () => {
    const payout = toBN(toWei("75"));
    const token = await setupAgiToken(MockERC20, accounts);
    await token.mint(employer, payout.muln(3), { from: owner });

    const nft = await MockERC721.new({ from: owner });
    await nft.mint(agent, { from: owner });

    const original = await deployManager(AGIJobManagerOriginal, AGI_TOKEN_ADDRESS, agent, validator, owner);
    await original.addAGIType(nft.address, 92, { from: owner });
    const originalJobId = await createAssignedJob(original, token, employer, agent, payout);
    await original.requestJobCompletion(originalJobId, "ipfs-complete", { from: agent });
    await original.disputeJob(originalJobId, { from: employer });
    await original.addModerator(moderator, { from: owner });
    await original.setRequiredValidatorApprovals(1, { from: owner });
    await token.mint(original.address, payout, { from: owner });
    await original.resolveDispute(originalJobId, "employer win", { from: moderator });
    await original.validateJob(originalJobId, "validator", EMPTY_PROOF, { from: validator });
    assert.equal((await original.nextTokenId()).toNumber(), 1, "original should still complete after employer win");

    const current = await deployManager(AGIJobManager, AGI_TOKEN_ADDRESS, agent, validator, owner);
    await current.addAGIType(nft.address, 92, { from: owner });
    const currentJobId = await createAssignedJob(current, token, employer, agent, payout);
    await current.requestJobCompletion(currentJobId, "ipfs-complete", { from: agent });
    await current.disputeJob(currentJobId, { from: employer });
    await current.addModerator(moderator, { from: owner });
    await current.setRequiredValidatorApprovals(1, { from: owner });
    await token.mint(current.address, payout, { from: owner });
    await current.resolveDispute(currentJobId, "employer win", { from: moderator });
    await expectRevert(current.validateJob(currentJobId, "validator", EMPTY_PROOF, { from: validator }));
  });

  it("reverts on failed refunds in current (original silently deletes job)", async () => {
    const payout = toBN(toWei("30"));
    const token = await setupAgiToken(FailTransferToken, accounts);
    await token.mint(employer, payout.muln(2), { from: owner });

    const original = await deployManager(AGIJobManagerOriginal, AGI_TOKEN_ADDRESS, agent, validator, owner);
    const originalJobId = await createJob(original, token, employer, payout);
    const originalBalanceBeforeCancel = await token.balanceOf(employer);
    await original.cancelJob(originalJobId, { from: employer });
    const originalBalanceAfterCancel = await token.balanceOf(employer);
    assert(
      originalBalanceAfterCancel.eq(originalBalanceBeforeCancel),
      "original should not refund when transfer returns false"
    );
    const originalJob = await original.jobs(originalJobId);
    assert.equal(originalJob.employer, ZERO_ADDRESS, "original should delete job even if refund fails");

    const current = await deployManager(AGIJobManager, AGI_TOKEN_ADDRESS, agent, validator, owner);
    const currentJobId = await createJob(current, token, employer, payout);
    const currentBalanceBeforeCancel = await token.balanceOf(employer);
    await expectRevert(current.cancelJob(currentJobId, { from: employer }));
    const currentBalanceAfterCancel = await token.balanceOf(employer);
    assert(
      currentBalanceAfterCancel.eq(currentBalanceBeforeCancel),
      "current should keep escrowed funds after revert"
    );
    const currentJob = await current.jobs(currentJobId);
    assert.equal(currentJob.employer, employer, "current should keep job after failed refund");
  });
});
