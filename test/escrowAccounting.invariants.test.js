const assert = require("assert");
const { expectRevert, time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { fundAgents, fundValidators } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager escrow invariants", (accounts) => {
  const [owner, employer, agent, v1, v2, v3] = accounts;
  let manager;
  let token;

  async function assertSolventInvariant() {
    const [bal, lockedEscrow, lockedAgentBonds, lockedValidatorBonds, lockedDisputeBonds, withdrawable] = await Promise.all([
      token.balanceOf(manager.address),
      manager.lockedEscrow(),
      manager.lockedAgentBonds(),
      manager.lockedValidatorBonds(),
      manager.lockedDisputeBonds(),
      manager.withdrawableAGI(),
    ]);
    const totalLocked = lockedEscrow.add(lockedAgentBonds).add(lockedValidatorBonds).add(lockedDisputeBonds);
    assert(bal.gte(totalLocked), "contract must stay solvent against locked totals");
    assert.equal(withdrawable.toString(), bal.sub(totalLocked).toString(), "withdrawable = balance - locked totals");
  }

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    manager = await AGIJobManager.new(...buildInitConfig(token.address, "ipfs://base", ens.address, nameWrapper.address, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT, ZERO_ROOT), { from: owner });

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 90, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(v1, { from: owner });
    await manager.addAdditionalValidator(v2, { from: owner });
    await manager.addAdditionalValidator(v3, { from: owner });
    await manager.setRequiredValidatorApprovals(2, { from: owner });
    await manager.setVoteQuorum(2, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });

    await fundAgents(token, manager, [agent], owner);
    await fundValidators(token, manager, [v1, v2, v3], owner);
  });

  async function createJob(payout) {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs://job", payout, 1000, "details", { from: employer });
    return tx.logs[0].args.jobId.toNumber();
  }

  it("holds accounting invariants across deterministic mixed-outcome loop", async () => {
    const pattern = ["approve", "disapprove", "expire", "approve", "disapprove"];
    for (let i = 0; i < pattern.length; i += 1) {
      const payout = toBN(toWei((5 + i).toString()));
      const jobId = await createJob(payout);
      await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });

      if (pattern[i] === "expire") {
        await time.increase(1001);
        await manager.expireJob(jobId, { from: employer });
      } else {
        await manager.requestJobCompletion(jobId, `ipfs://done/${i}`, { from: agent });
        await manager.validateJob(jobId, "", EMPTY_PROOF, { from: v1 });
        if (pattern[i] === "approve") {
          await manager.validateJob(jobId, "", EMPTY_PROOF, { from: v2 });
        } else {
          await manager.disapproveJob(jobId, "", EMPTY_PROOF, { from: v2 });
          await manager.disapproveJob(jobId, "", EMPTY_PROOF, { from: v3 });
        }
        await time.increase(2);
        await manager.finalizeJob(jobId, { from: employer });
      }
      await assertSolventInvariant();
    }
  });

  it("reverts withdraw when requested amount exceeds computed withdrawable", async () => {
    const payout = toBN(toWei("9"));
    await createJob(payout);
    await manager.pause({ from: owner });
    await manager.setSettlementPaused(false, { from: owner });
    await expectRevert.unspecified(manager.withdrawAGI(toBN(1), { from: owner }));
  });
});
