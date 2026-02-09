const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { fundAgents, fundValidators, fundDisputeBond } = require("./helpers/bonds");

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

async function assertSolvent(manager, token) {
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
  assert.ok(balance.gte(lockedTotal), "escrow solvency invariant failed");

  const withdrawable = await manager.withdrawableAGI();
  assert.ok(withdrawable.gte(toBN(0)), "withdrawableAGI should not revert");
}

contract("AGIJobManager solvency invariants", (accounts) => {
  const [owner, employer, agent, validatorA, validatorB, moderator] = accounts;
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
    await manager.addAdditionalValidator(validatorA, { from: owner });
    await manager.addAdditionalValidator(validatorB, { from: owner });
    await manager.addModerator(moderator, { from: owner });

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(2, { from: owner });
    await manager.setVoteQuorum(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });

    await fundValidators(token, manager, [validatorA, validatorB], owner);
    await fundAgents(token, manager, [agent], owner);
  });

  async function createJob(payout, duration = 3600) {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs-spec", payout, duration, "details", { from: employer });
    return tx.logs.find((log) => log.event === "JobCreated").args.jobId.toNumber();
  }

  it("maintains solvency through the happy path", async () => {
    const payout = toBN(toWei("12"));
    const jobId = await createJob(payout);
    await assertSolvent(manager, token);

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await assertSolvent(manager, token);

    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await assertSolvent(manager, token);

    await manager.validateJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    await assertSolvent(manager, token);

    await advanceTime(2);
    await manager.finalizeJob(jobId, { from: employer });
    await assertSolvent(manager, token);
  });

  it("maintains solvency when validator disapprovals trigger employer refunds", async () => {
    const payout = toBN(toWei("8"));
    const jobId = await createJob(payout);
    await assertSolvent(manager, token);

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await assertSolvent(manager, token);

    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await assertSolvent(manager, token);

    await manager.disapproveJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    await assertSolvent(manager, token);

    await advanceTime(2);
    await manager.finalizeJob(jobId, { from: employer });
    await assertSolvent(manager, token);
  });

  it("maintains solvency when jobs expire", async () => {
    const payout = toBN(toWei("6"));
    const jobId = await createJob(payout, 10);
    await assertSolvent(manager, token);

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await assertSolvent(manager, token);

    await advanceTime(20);
    await manager.expireJob(jobId, { from: employer });
    await assertSolvent(manager, token);
  });

  it("maintains solvency through disputes and moderator resolution", async () => {
    const payout = toBN(toWei("9"));
    const jobId = await createJob(payout);
    await assertSolvent(manager, token);

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await assertSolvent(manager, token);

    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await assertSolvent(manager, token);

    await fundDisputeBond(token, manager, employer, payout, owner);
    await manager.disputeJob(jobId, { from: employer });
    await assertSolvent(manager, token);

    await manager.resolveDisputeWithCode(jobId, 2, "employer win", { from: moderator });
    await assertSolvent(manager, token);
  });
});
