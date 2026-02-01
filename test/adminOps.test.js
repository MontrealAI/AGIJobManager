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

    manager = await AGIJobManager.new(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      clubRoot,
      agentRoot,
      ZERO_ROOT,
      ZERO_ROOT,
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
    await expectRevert(
      manager.createJob("ipfs", payout, 1000, "details", { from: employer }),
      "Pausable: paused"
    );
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

    const balanceBefore = await token.balanceOf(owner);
    await expectRevert(manager.withdrawAGI(surplus, { from: owner }), "Pausable: not paused");
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

    const managerFailing = await AGIJobManager.new(
      failing.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      clubRoot,
      agentRoot,
      ZERO_ROOT,
      ZERO_ROOT,
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
});
