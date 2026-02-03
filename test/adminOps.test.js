const assert = require("assert");

const { expectRevert } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const FailingERC20 = artifacts.require("FailingERC20");
const MockERC721 = artifacts.require("MockERC721");

const { rootNode, setNameWrapperOwnership } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");

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

    await manager.lockConfiguration({ from: owner });

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
    await manager.lockConfiguration({ from: owner });
    assert.equal(await manager.configLocked(), true, "config should be locked");

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

    await expectCustomError(manager.lockConfiguration.call({ from: owner }), "ConfigLocked");
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

    await manager.lockConfiguration({ from: owner });
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

    await manager.lockConfiguration({ from: owner });
    await expectCustomError(
      manager.updateAGITokenAddress.call(newToken.address, { from: owner }),
      "ConfigLocked"
    );
  });
});
