const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { fundValidators, fundAgents, fundDisputeBond } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

async function advanceTime(seconds) {
  await new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [seconds],
        id: Date.now(),
      },
      (error) => {
        if (error) return reject(error);
        resolve();
      }
    );
  });

  await new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        params: [],
        id: Date.now() + 1,
      },
      (error) => {
        if (error) return reject(error);
        resolve();
      }
    );
  });
}

async function assertSolvent(token, manager) {
  const [
    balance,
    lockedEscrow,
    lockedAgentBonds,
    lockedValidatorBonds,
    lockedDisputeBonds,
  ] = await Promise.all([
    token.balanceOf(manager.address),
    manager.lockedEscrow(),
    manager.lockedAgentBonds(),
    manager.lockedValidatorBonds(),
    manager.lockedDisputeBonds(),
  ]);
  const lockedTotal = lockedEscrow
    .add(lockedAgentBonds)
    .add(lockedValidatorBonds)
    .add(lockedDisputeBonds);
  assert(
    balance.gte(lockedTotal),
    `insolvent: balance ${balance.toString()} < locked ${lockedTotal.toString()}`
  );
  await manager.withdrawableAGI();
}

async function createJob(manager, token, employer, payout, duration, owner) {
  await token.mint(employer, payout, { from: owner });
  await token.approve(manager.address, payout, { from: employer });
  const jobId = await manager.nextJobId();
  await manager.createJob("ipfs://job", payout, duration, "details", { from: employer });
  return jobId;
}

contract("AGIJobManager solvency invariants", (accounts) => {
  const [owner, employer, agent, validator, moderator] = accounts;
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
    await manager.addAGIType(agiType.address, 90, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.addModerator(moderator, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setVoteQuorum(1, { from: owner });

    await fundAgents(token, manager, [agent], owner);
    await fundValidators(token, manager, [validator], owner);
  });

  it("maintains solvency during happy-path settlement", async () => {
    const payout = toBN(toWei("100"));
    const duration = toBN("3600");

    const jobId = await createJob(manager, token, employer, payout, duration, owner);
    await assertSolvent(token, manager);

    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await assertSolvent(token, manager);

    await manager.requestJobCompletion(jobId, "ipfs://completion", { from: agent });
    await assertSolvent(token, manager);

    await manager.validateJob(jobId, "", EMPTY_PROOF, { from: validator });
    await assertSolvent(token, manager);

    const challengePeriod = await manager.challengePeriodAfterApproval();
    await advanceTime(challengePeriod.toNumber() + 1);
    await manager.finalizeJob(jobId, { from: owner });
    await assertSolvent(token, manager);
  });

  it("maintains solvency when employer is refunded after disapproval", async () => {
    const payout = toBN(toWei("50"));
    const duration = toBN("1800");

    const jobId = await createJob(manager, token, employer, payout, duration, owner);
    await assertSolvent(token, manager);

    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await assertSolvent(token, manager);

    await manager.requestJobCompletion(jobId, "ipfs://completion", { from: agent });
    await assertSolvent(token, manager);

    await manager.setRequiredValidatorDisapprovals(2, { from: owner });
    await manager.disapproveJob(jobId, "", EMPTY_PROOF, { from: validator });
    await assertSolvent(token, manager);

    const reviewPeriod = await manager.completionReviewPeriod();
    await advanceTime(reviewPeriod.toNumber() + 1);
    await manager.finalizeJob(jobId, { from: owner });
    await assertSolvent(token, manager);
  });

  it("maintains solvency through expiration", async () => {
    const payout = toBN(toWei("25"));
    const duration = toBN("1000");

    const jobId = await createJob(manager, token, employer, payout, duration, owner);
    await assertSolvent(token, manager);

    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await assertSolvent(token, manager);

    await advanceTime(duration.toNumber() + 1);
    await manager.expireJob(jobId, { from: owner });
    await assertSolvent(token, manager);
  });

  it("maintains solvency through disputes and resolution", async () => {
    const payout = toBN(toWei("75"));
    const duration = toBN("2400");

    const jobId = await createJob(manager, token, employer, payout, duration, owner);
    await assertSolvent(token, manager);

    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    await assertSolvent(token, manager);

    await manager.requestJobCompletion(jobId, "ipfs://completion", { from: agent });
    await assertSolvent(token, manager);

    await fundDisputeBond(token, manager, employer, payout, owner);
    await manager.disputeJob(jobId, { from: employer });
    await assertSolvent(token, manager);

    await manager.resolveDisputeWithCode(jobId, 1, "agent win", { from: moderator });
    await assertSolvent(token, manager);
  });
});
