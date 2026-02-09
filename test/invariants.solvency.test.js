const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { computeAgentBond, computeValidatorBond, fundDisputeBond } = require("./helpers/bonds");

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
  const [lockedEscrow, lockedAgentBonds, lockedValidatorBonds, lockedDisputeBonds] = await Promise.all([
    manager.lockedEscrow(),
    manager.lockedAgentBonds(),
    manager.lockedValidatorBonds(),
    manager.lockedDisputeBonds(),
  ]);
  const lockedTotal = toBN(lockedEscrow)
    .add(toBN(lockedAgentBonds))
    .add(toBN(lockedValidatorBonds))
    .add(toBN(lockedDisputeBonds));
  const balance = toBN(await token.balanceOf(manager.address));
  assert.ok(balance.gte(lockedTotal), "escrow is insolvent");
  await manager.withdrawableAGI();
}

async function mintAndApprove(token, owner, account, spender, amount) {
  await token.mint(account, amount, { from: owner });
  await token.approve(spender, amount, { from: account });
}

contract("AGIJobManager solvency invariants", (accounts) => {
  const [owner, employer, agent, validator, moderator] = accounts;
  let token;
  let manager;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(
      ...buildInitConfig(
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
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });
    await manager.setVoteQuorum(1, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });
    await manager.setDisputeReviewPeriod(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });
  });

  it("maintains solvency across the happy path settlement", async () => {
    const payout = toBN(toWei("100"));
    const duration = toBN("1000");
    const agentBond = await computeAgentBond(manager, payout, duration);
    const validatorBond = await computeValidatorBond(manager, payout);

    await mintAndApprove(token, owner, employer, manager.address, payout);
    await mintAndApprove(token, owner, agent, manager.address, agentBond);
    await mintAndApprove(token, owner, validator, manager.address, validatorBond);

    await manager.createJob("ipfs://spec", payout, duration, "details", { from: employer });
    await assertSolvent(manager, token);

    await manager.applyForJob(0, "", EMPTY_PROOF, { from: agent });
    await assertSolvent(manager, token);

    await manager.requestJobCompletion(0, "ipfs://done", { from: agent });
    await assertSolvent(manager, token);

    await manager.validateJob(0, "", EMPTY_PROOF, { from: validator });
    await assertSolvent(manager, token);

    await advanceTime(2);
    await manager.finalizeJob(0, { from: employer });
    await assertSolvent(manager, token);
  });

  it("maintains solvency when disapprovals trigger employer refund", async () => {
    const payout = toBN(toWei("50"));
    const duration = toBN("800");
    const agentBond = await computeAgentBond(manager, payout, duration);
    const validatorBond = await computeValidatorBond(manager, payout);

    await mintAndApprove(token, owner, employer, manager.address, payout);
    await mintAndApprove(token, owner, agent, manager.address, agentBond);
    await mintAndApprove(token, owner, validator, manager.address, validatorBond);

    await manager.createJob("ipfs://spec", payout, duration, "details", { from: employer });
    await assertSolvent(manager, token);

    await manager.applyForJob(0, "", EMPTY_PROOF, { from: agent });
    await assertSolvent(manager, token);

    await manager.requestJobCompletion(0, "ipfs://done", { from: agent });
    await assertSolvent(manager, token);

    await manager.disapproveJob(0, "", EMPTY_PROOF, { from: validator });
    await assertSolvent(manager, token);

    await manager.resolveDisputeWithCode(0, 2, "employer win", { from: moderator });
    await assertSolvent(manager, token);
  });

  it("maintains solvency across job expiration", async () => {
    const payout = toBN(toWei("25"));
    const duration = toBN("50");
    const agentBond = await computeAgentBond(manager, payout, duration);

    await mintAndApprove(token, owner, employer, manager.address, payout);
    await mintAndApprove(token, owner, agent, manager.address, agentBond);

    await manager.createJob("ipfs://spec", payout, duration, "details", { from: employer });
    await assertSolvent(manager, token);

    await manager.applyForJob(0, "", EMPTY_PROOF, { from: agent });
    await assertSolvent(manager, token);

    await advanceTime(60);
    await manager.expireJob(0, { from: employer });
    await assertSolvent(manager, token);
  });

  it("maintains solvency across dispute bond flows", async () => {
    const payout = toBN(toWei("75"));
    const duration = toBN("900");
    const agentBond = await computeAgentBond(manager, payout, duration);

    await mintAndApprove(token, owner, employer, manager.address, payout);
    await mintAndApprove(token, owner, agent, manager.address, agentBond);
    await fundDisputeBond(token, manager, employer, payout, owner);

    await manager.createJob("ipfs://spec", payout, duration, "details", { from: employer });
    await assertSolvent(manager, token);

    await manager.applyForJob(0, "", EMPTY_PROOF, { from: agent });
    await assertSolvent(manager, token);

    await manager.requestJobCompletion(0, "ipfs://done", { from: agent });
    await assertSolvent(manager, token);

    await manager.disputeJob(0, { from: employer });
    await assertSolvent(manager, token);

    await manager.resolveDisputeWithCode(0, 1, "agent win", { from: moderator });
    await assertSolvent(manager, token);
  });
});
