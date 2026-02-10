const assert = require("assert");

const { expectRevert, time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockENSJobPages = artifacts.require("MockENSJobPages");
const FailingERC20 = artifacts.require("FailingERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockERC165Only = artifacts.require("MockERC165Only");
const MockERC721Only = artifacts.require("MockERC721Only");
const MockNoSupportsInterface = artifacts.require("MockNoSupportsInterface");
const MockBrokenERC721 = artifacts.require("MockBrokenERC721");

const { rootNode, setNameWrapperOwnership } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");
const { fundValidators, fundAgents } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager admin ops", (accounts) => {
  const [owner, employer, agent, validator, other] = accounts;
  let token;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let clubRoot;
  let agentRoot;
  let agiTypeNft;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    clubRoot = rootNode("club-root");
    agentRoot = rootNode("agent-root");

    manager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        clubRoot,
        agentRoot,
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator", validator);
    agiTypeNft = await MockERC721.new({ from: owner });
    await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
    await agiTypeNft.mint(agent, { from: owner });

    await fundValidators(token, manager, [validator], owner);
    await fundAgents(token, manager, [agent, other], owner);
  });

  it("pauses and unpauses sensitive actions", async () => {
    const payout = toBN(toWei("5"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.pause({ from: owner });
    await expectRevert.unspecified(
      manager.createJob("ipfs", payout, 1000, "details", { from: employer }));
    await manager.unpause({ from: owner });

    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
  });

  it("blocks job workflow actions while paused", async () => {
    const payout = toBN(toWei("5"));
    const totalPayout = payout.muln(2);
    await token.mint(employer, totalPayout, { from: owner });
    await token.approve(manager.address, totalPayout, { from: employer });

    const jobReceipt = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = jobReceipt.logs[0].args.jobId.toNumber();
    const pendingReceipt = await manager.createJob("ipfs-2", payout, 1000, "details", { from: employer });
    const pendingJobId = pendingReceipt.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.pause({ from: owner });

    await expectRevert.unspecified(
      manager.applyForJob(pendingJobId, "agent", EMPTY_PROOF, { from: agent })
    );
    await expectRevert.unspecified(
      manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator })
    );
    await expectRevert.unspecified(
      manager.disapproveJob(jobId, "validator", EMPTY_PROOF, { from: validator })
    );
    await expectRevert.unspecified(
      manager.disputeJob(jobId, { from: employer })
    );
  });

  it("manages allowlists and blacklists", async () => {
    const payout = toBN(toWei("6"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.blacklistAgent(agent, true, { from: owner });
    await expectCustomError(
      manager.applyForJob.call(jobId, "agent", EMPTY_PROOF, { from: agent }),
      "Blacklisted"
    );
    await manager.blacklistAgent(agent, false, { from: owner });

    await manager.addAdditionalAgent(other, { from: owner });
    await agiTypeNft.mint(other, { from: owner });
    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: other });

    await manager.blacklistValidator(validator, true, { from: owner });
    await expectCustomError(
      manager.validateJob.call(jobId, "validator", EMPTY_PROOF, { from: validator }),
      "Blacklisted"
    );
  });

  it("updates parameters and withdraws funds", async () => {
    await expectCustomError(manager.setValidationRewardPercentage.call(0, { from: owner }), "InvalidParameters");
    await manager.setValidationRewardPercentage(8, { from: owner });
    await manager.setMaxJobPayout(toBN(toWei("5000")), { from: owner });

    const payout = toBN(toWei("8"));
    const surplus = toBN(toWei("3"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs", payout, 1000, "details", { from: employer });

    await token.mint(manager.address, surplus, { from: owner });

    await manager.lockIdentityConfiguration({ from: owner });

    const balanceBefore = await token.balanceOf(owner);
    await expectRevert.unspecified(manager.withdrawAGI(surplus, { from: owner }));
    await manager.pause({ from: owner });
    await expectCustomError(
      manager.withdrawAGI.call(payout, { from: owner }),
      "InsufficientWithdrawableBalance"
    );
    await manager.withdrawAGI(surplus, { from: owner });
    const balanceAfter = await token.balanceOf(owner);
    assert.equal(balanceAfter.sub(balanceBefore).toString(), surplus.toString(), "withdraw should move funds");
  });

  it("emits events for high-impact configuration updates", async () => {
    const newToken = await MockERC20.new({ from: owner });
    const oldTokenAddress = await manager.agiToken();
    const tokenTx = await manager.updateAGITokenAddress(newToken.address, { from: owner });
    const tokenEvent = tokenTx.logs.find((log) => log.event === "AGITokenAddressUpdated");
    assert.ok(tokenEvent, "AGITokenAddressUpdated should be emitted");
    assert.equal(tokenEvent.args.oldToken, oldTokenAddress);
    assert.equal(tokenEvent.args.newToken, newToken.address);

    const ensJobPages = await MockENSJobPages.new({ from: owner });
    const oldEnsJobPages = await manager.ensJobPages();
    const ensTx = await manager.setEnsJobPages(ensJobPages.address, { from: owner });
    const ensEvent = ensTx.logs.find((log) => log.event === "EnsJobPagesUpdated");
    assert.ok(ensEvent, "EnsJobPagesUpdated should be emitted");
    assert.equal(ensEvent.args.oldEnsJobPages, oldEnsJobPages);
    assert.equal(ensEvent.args.newEnsJobPages, ensJobPages.address);

    const useEnsTx = await manager.setUseEnsJobTokenURI(true, { from: owner });
    const useEnsEvent = useEnsTx.logs.find((log) => log.event === "UseEnsJobTokenURIUpdated");
    assert.ok(useEnsEvent, "UseEnsJobTokenURIUpdated should be emitted");
    assert.equal(useEnsEvent.args.oldValue, false);
    assert.equal(useEnsEvent.args.newValue, true);

    const oldQuorum = await manager.voteQuorum();
    const quorumTx = await manager.setVoteQuorum(oldQuorum.addn(1), { from: owner });
    const quorumEvent = quorumTx.logs.find((log) => log.event === "VoteQuorumUpdated");
    assert.ok(quorumEvent, "VoteQuorumUpdated should be emitted");
    assert.equal(quorumEvent.args.oldQuorum.toString(), oldQuorum.toString());
    assert.equal(quorumEvent.args.newQuorum.toString(), oldQuorum.addn(1).toString());

    const approvalsTx = await manager.setRequiredValidatorApprovals(4, { from: owner });
    const approvalsEvent = approvalsTx.logs.find((log) => log.event === "RequiredValidatorApprovalsUpdated");
    assert.ok(approvalsEvent, "RequiredValidatorApprovalsUpdated should be emitted");
    assert.equal(approvalsEvent.args.oldApprovals.toString(), "3");
    assert.equal(approvalsEvent.args.newApprovals.toString(), "4");

    const disapprovalsTx = await manager.setRequiredValidatorDisapprovals(4, { from: owner });
    const disapprovalsEvent = disapprovalsTx.logs.find((log) => log.event === "RequiredValidatorDisapprovalsUpdated");
    assert.ok(disapprovalsEvent, "RequiredValidatorDisapprovalsUpdated should be emitted");
    assert.equal(disapprovalsEvent.args.oldDisapprovals.toString(), "3");
    assert.equal(disapprovalsEvent.args.newDisapprovals.toString(), "4");

    const validationTx = await manager.setValidationRewardPercentage(7, { from: owner });
    const validationEvent = validationTx.logs.find((log) => log.event === "ValidationRewardPercentageUpdated");
    assert.ok(validationEvent, "ValidationRewardPercentageUpdated should be emitted");
    assert.equal(validationEvent.args.oldPercentage.toString(), "8");
    assert.equal(validationEvent.args.newPercentage.toString(), "7");

    const bondTx = await manager.setAgentBondParams(600, toBN(toWei("2")), toBN(toWei("20")), { from: owner });
    const bondEvent = bondTx.logs.find((log) => log.event === "AgentBondParamsUpdated");
    assert.ok(bondEvent, "AgentBondParamsUpdated should be emitted");
    assert.equal(bondEvent.args.oldBps.toString(), "500");
    assert.equal(bondEvent.args.newBps.toString(), "600");

    const bondZeroTx = await manager.setAgentBondParams(0, 0, 0, { from: owner });
    const bondZeroEvent = bondZeroTx.logs.find((log) => log.event === "AgentBondParamsUpdated");
    assert.ok(bondZeroEvent, "AgentBondParamsUpdated should be emitted on zeroing");
    assert.equal(bondZeroEvent.args.newBps.toString(), "0");

    const bondMinTx = await manager.setAgentBond(toBN(toWei("3")), { from: owner });
    const bondMinEvent = bondMinTx.logs.find((log) => log.event === "AgentBondMinUpdated");
    assert.ok(bondMinEvent, "AgentBondMinUpdated should be emitted");
    assert.equal(bondMinEvent.args.oldMin.toString(), "0");
    assert.equal(bondMinEvent.args.newMin.toString(), toWei("3"));

    const slashTx = await manager.setValidatorSlashBps(7000, { from: owner });
    const slashEvent = slashTx.logs.find((log) => log.event === "ValidatorSlashBpsUpdated");
    assert.ok(slashEvent, "ValidatorSlashBpsUpdated should be emitted");
    assert.equal(slashEvent.args.oldBps.toString(), "8000");
    assert.equal(slashEvent.args.newBps.toString(), "7000");
  });

  it("reverts withdrawals on failed transfers", async () => {
    const failing = await FailingERC20.new({ from: owner });
    await failing.mint(owner, toBN(toWei("2")), { from: owner });

    const managerFailing = await AGIJobManager.new(...buildInitConfig(
        failing.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        clubRoot,
        agentRoot,
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    await failing.transfer(managerFailing.address, toBN(toWei("2")), { from: owner });
    await failing.setFailTransfers(true, { from: owner });
    await managerFailing.pause({ from: owner });
    await expectCustomError(
      managerFailing.withdrawAGI.call(toBN(toWei("1")), { from: owner }),
      "TransferFailed"
    );
  });

  it("locks configuration changes while retaining break-glass controls", async () => {
    await manager.lockIdentityConfiguration({ from: owner });
    assert.equal(await manager.lockIdentityConfig(), true, "config should be locked");

    await manager.updateMerkleRoots(clubRoot, agentRoot, { from: owner });

    await manager.setMaxJobPayout(toBN(toWei("1")), { from: owner });
    await manager.addModerator(other, { from: owner });
    assert.equal(await manager.moderators(other), true, "moderator should be added after lock");
    await manager.removeModerator(other, { from: owner });
    assert.equal(await manager.moderators(other), false, "moderator should be removable after lock");
    await manager.addAdditionalAgent(other, { from: owner });
    await manager.updateContactEmail("ops@example.com", { from: owner });
    await manager.blacklistAgent(agent, true, { from: owner });

    await manager.pause({ from: owner });
    await manager.unpause({ from: owner });

    await expectCustomError(manager.lockIdentityConfiguration.call({ from: owner }), "ConfigLocked");
  });

  it("updates ENS wiring and root nodes before jobs, then locks them", async () => {
    const newEns = await MockENS.new({ from: owner });
    const newWrapper = await MockNameWrapper.new({ from: owner });
    const newClubRoot = rootNode("new-club-root");
    const newAgentRoot = rootNode("new-agent-root");

    await manager.updateEnsRegistry(newEns.address, { from: owner });
    await manager.updateNameWrapper(newWrapper.address, { from: owner });
    await manager.updateRootNodes(newClubRoot, newAgentRoot, newClubRoot, newAgentRoot, { from: owner });

    assert.equal(await manager.ens(), newEns.address, "ens registry should update");
    assert.equal(await manager.nameWrapper(), newWrapper.address, "name wrapper should update");
    assert.equal(await manager.clubRootNode(), newClubRoot, "club root should update");
    assert.equal(await manager.agentRootNode(), newAgentRoot, "agent root should update");

    const payout = toBN(toWei("2"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs", payout, 1000, "details", { from: employer });

    await expectCustomError(
      manager.updateRootNodes.call(clubRoot, agentRoot, clubRoot, agentRoot, { from: owner }),
      "InvalidState"
    );

    await manager.lockIdentityConfiguration({ from: owner });
    await expectCustomError(manager.updateEnsRegistry.call(ens.address, { from: owner }), "ConfigLocked");
    await expectCustomError(manager.updateNameWrapper.call(nameWrapper.address, { from: owner }), "ConfigLocked");
  });

  it("locks critical config and restricts token updates to pre-job setup", async () => {
    const newToken = await MockERC20.new({ from: owner });
    await manager.updateAGITokenAddress(newToken.address, { from: owner });
    assert.equal(await manager.agiToken(), newToken.address, "token should update before jobs");

    const payout = toBN(toWei("3"));
    await newToken.mint(employer, payout, { from: owner });
    await newToken.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs", payout, 1000, "details", { from: employer });

    const anotherToken = await MockERC20.new({ from: owner });
    await expectCustomError(
      manager.updateAGITokenAddress.call(anotherToken.address, { from: owner }),
      "InvalidState"
    );

    await manager.lockIdentityConfiguration({ from: owner });
    await expectCustomError(
      manager.updateAGITokenAddress.call(newToken.address, { from: owner }),
      "ConfigLocked"
    );
  });

  it("rejects non-ERC721 AGI type configurations", async () => {
    const noSupports = await MockNoSupportsInterface.new({ from: owner });
    const erc165Only = await MockERC165Only.new({ from: owner });
    const erc721Only = await MockERC721Only.new({ from: owner });

    await expectCustomError(
      manager.addAGIType.call(other, 10, { from: owner }),
      "InvalidParameters"
    );
    await expectCustomError(
      manager.addAGIType.call(noSupports.address, 10, { from: owner }),
      "InvalidParameters"
    );
    await expectCustomError(
      manager.addAGIType.call(erc165Only.address, 10, { from: owner }),
      "InvalidParameters"
    );
    await expectCustomError(
      manager.addAGIType.call(erc721Only.address, 10, { from: owner }),
      "InvalidParameters"
    );
  });

  it("skips broken AGI types when computing payout eligibility", async () => {
    const brokenType = await MockBrokenERC721.new({ from: owner });
    await manager.addAGIType(brokenType.address, 80, { from: owner });
    await manager.addAdditionalAgent(other, { from: owner });
    await agiTypeNft.mint(other, { from: owner });

    const payout = toBN(toWei("4"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: other });

    const jobCore = await manager.getJobCore(jobId);
    assert.equal(jobCore.agentPayoutPct.toString(), "92", "valid AGI type should still be selected");
  });

  it("can disable and later re-enable an AGI type", async () => {
    const freshType = await MockERC721.new({ from: owner });
    await manager.addAGIType(freshType.address, 15, { from: owner });

    await manager.disableAGIType(freshType.address, { from: owner });
    assert.equal((await manager.getHighestPayoutPercentage(agent)).toString(), "92", "disabled type ignored");

    await manager.addAGIType(freshType.address, 25, { from: owner });
    await freshType.mint(agent, { from: owner });
    assert.equal((await manager.getHighestPayoutPercentage(agent)).toString(), "92", "existing higher type still wins");

    await expectCustomError(
      manager.disableAGIType.call(validator, { from: owner }),
      "InvalidParameters"
    );
  });

  it("allows identity config updates after all obligations settle", async () => {
    const payout = toBN(toWei("3"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    const newToken = await MockERC20.new({ from: owner });
    await expectCustomError(
      manager.updateAGITokenAddress.call(newToken.address, { from: owner }),
      "InvalidState"
    );

    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
    await manager.finalizeJob(jobId, { from: employer });

    await manager.updateAGITokenAddress(newToken.address, { from: owner });
    assert.equal(await manager.agiToken(), newToken.address, "token should update after settlement");
  });
});
