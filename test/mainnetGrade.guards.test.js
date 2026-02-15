const { BN, time, expectRevert } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");
const MockENSJobPagesMalformed = artifacts.require("MockENSJobPagesMalformed");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

contract("mainnetGrade.guards", (accounts) => {
  const [owner, employer, agent, validator] = accounts;
  const ZERO32 = "0x" + "00".repeat(32);

  async function deployManager(token, ens, wrapper) {
    return AGIJobManager.new(
      ...buildInitConfig(token.address, "ipfs://base", ens.address, wrapper.address, ZERO32, ZERO32, ZERO32, ZERO32, ZERO32, ZERO32),
      { from: owner }
    );
  }

  async function enableSimpleSettlement(manager, token, nft) {
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });
    await manager.setVoteQuorum(1, { from: owner });

    await manager.setAgentBondParams(0, 0, 0, { from: owner });
    await manager.setValidatorBondParams(0, 0, 0, { from: owner });
    await token.mint(agent, web3.utils.toWei("100000000"), { from: owner });
    await token.mint(validator, web3.utils.toWei("100000000"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("100000000"), { from: agent });
    await token.approve(manager.address, web3.utils.toWei("100000000"), { from: validator });
  }

  async function runApprovedJob(manager, token, payoutWei, jobId) {
    await token.mint(employer, payoutWei, { from: owner });
    await token.approve(manager.address, payoutWei, { from: employer });
    await manager.createJob("ipfs://spec", payoutWei, 1000, "details", { from: employer });
    await manager.applyForJob(jobId, "agent", [], { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs://completion", { from: agent });
    await manager.validateJob(jobId, "validator", [], { from: validator });
    const challengePeriod = await manager.challengePeriodAfterApproval();
    await time.increase(challengePeriod.addn(1));
    await manager.finalizeJob(jobId, { from: employer });
  }

  it("keeps reputation monotone for positive points and caps at 88888", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const nft = await MockERC721.new({ from: owner });
    const manager = await deployManager(token, ens, wrapper);

    await enableSimpleSettlement(manager, token, nft);

    let previous = new BN(0);
    for (let i = 0; i < 60; i++) {
      await runApprovedJob(manager, token, web3.utils.toWei("1000000"), i);
      const current = new BN(await manager.reputation(agent));
      assert(current.gte(previous), "reputation decreased after positive settlement");
      previous = current;
    }

    assert(previous.lte(new BN("88888")), "reputation must stay capped");
  });

  it("locks merkle root updates while obligations are active", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const nft = await MockERC721.new({ from: owner });
    const manager = await deployManager(token, ens, wrapper);

    await enableSimpleSettlement(manager, token, nft);

    const payout = web3.utils.toWei("10");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs://spec", payout, 1000, "details", { from: employer });

    await expectCustomError(manager.updateMerkleRoots.call(ZERO32, ZERO32, { from: owner }), "InvalidState");
  });

  it("caps JobCreated details payload size", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens, wrapper);

    const payout = web3.utils.toWei("1");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob("ipfs://spec", payout, 100, "x".repeat(2048), { from: employer });
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await expectCustomError(manager.createJob.call("ipfs://spec-2", payout, 100, "x".repeat(2049), { from: employer }), "InvalidParameters");
  });

  it("separates intake pause from pauseAll semantics", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const nft = await MockERC721.new({ from: owner });
    const manager = await deployManager(token, ens, wrapper);

    await enableSimpleSettlement(manager, token, nft);
    const payout = web3.utils.toWei("5");

    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs://spec", payout, 1000, "details", { from: employer });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "ipfs://completion", { from: agent });

    await manager.pauseIntake({ from: owner });
    await expectRevert.unspecified(manager.createJob("ipfs://new", payout, 1000, "details", { from: employer }));
    await manager.validateJob(0, "validator", [], { from: validator });

    await manager.unpauseIntake({ from: owner });
    await manager.pauseAll({ from: owner });
    await expectCustomError(manager.finalizeJob.call(0, { from: employer }), "SettlementPaused");

    await manager.unpauseAll({ from: owner });
    const challengePeriod = await manager.challengePeriodAfterApproval();
    await time.increase(challengePeriod.addn(1));
    await manager.finalizeJob(0, { from: employer });
  });

  it("emits EnsHookAttempted and never bricks core flow when hook reverts", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const nft = await MockERC721.new({ from: owner });
    const hookTarget = await MockENSJobPagesMalformed.new({ from: owner });
    const manager = await deployManager(token, ens, wrapper);

    await enableSimpleSettlement(manager, token, nft);
    await manager.setEnsJobPages(hookTarget.address, { from: owner });

    const payout = web3.utils.toWei("2");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    let receipt = await manager.createJob("ipfs://spec", payout, 1000, "details", { from: employer });
    let hookEvt = receipt.logs.find((l) => l.event === "EnsHookAttempted");
    assert.equal(hookEvt.args.success, true, "expected successful hook event");

    await hookTarget.setRevertOnHook(true, { from: owner });
    receipt = await manager.applyForJob(0, "agent", [], { from: agent });
    hookEvt = receipt.logs.find((l) => l.event === "EnsHookAttempted");
    assert.equal(hookEvt.args.success, false, "expected failed hook event");

    await manager.requestJobCompletion(0, "ipfs://completion", { from: agent });
    await manager.validateJob(0, "validator", [], { from: validator });
    const challengePeriod = await manager.challengePeriodAfterApproval();
    await time.increase(challengePeriod.addn(1));
    await manager.finalizeJob(0, { from: employer });

    const core = await manager.getJobCore(0);
    assert.equal(core.completed, true, "hook failures must not brick settlement");
  });

  it("includes merkle roots in identity lock behavior", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await deployManager(token, ens, wrapper);

    await manager.lockIdentityConfiguration({ from: owner });
    await expectCustomError(manager.updateMerkleRoots.call("0x" + "11".repeat(32), "0x" + "22".repeat(32), { from: owner }), "ConfigLocked");
  });
});
