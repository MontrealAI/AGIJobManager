const { BN, expectEvent } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const AGIJobManagerHarness = artifacts.require("AGIJobManagerHarness");
const BondMath = artifacts.require("BondMath");
const ENSOwnership = artifacts.require("ENSOwnership");
const ReputationMath = artifacts.require("ReputationMath");
const TransferUtils = artifacts.require("TransferUtils");
const UriUtils = artifacts.require("UriUtils");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockENSJobPages = artifacts.require("MockENSJobPages");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

contract("AGIJobManager deployment blockers", (accounts) => {
  const [owner, employer, agent, validator, other] = accounts;
  const ZERO32 = "0x" + "00".repeat(32);

  async function deployManager(ContractType = AGIJobManager) {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    if (ContractType === AGIJobManagerHarness) {
      const bondMath = await BondMath.new({ from: owner });
      const ensOwnership = await ENSOwnership.new({ from: owner });
      const reputationMath = await ReputationMath.new({ from: owner });
      const transferUtils = await TransferUtils.new({ from: owner });
      const uriUtils = await UriUtils.new({ from: owner });
      await AGIJobManagerHarness.link("BondMath", bondMath.address);
      await AGIJobManagerHarness.link("ENSOwnership", ensOwnership.address);
      await AGIJobManagerHarness.link("ReputationMath", reputationMath.address);
      await AGIJobManagerHarness.link("TransferUtils", transferUtils.address);
      await AGIJobManagerHarness.link("UriUtils", uriUtils.address);
    }
    const manager = await ContractType.new(
      ...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        wrapper.address,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32
      ),
      { from: owner }
    );
    return { manager, token };
  }

  async function createJobWithEscrow(manager, token, details = "details") {
    const payout = web3.utils.toWei("2");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs://spec", payout, 1000, details, { from: employer });
    return payout;
  }

  it("keeps reputation monotone and capped at 88888", async () => {
    const { manager } = await deployManager(AGIJobManagerHarness);

    await manager.exposeEnforceReputationGrowth(agent, 100, { from: owner });
    const first = await manager.reputation(agent);

    await manager.exposeEnforceReputationGrowth(agent, 1, { from: owner });
    const second = await manager.reputation(agent);
    assert(second.gte(first), "reputation must not decrease");

    await manager.setReputationForTest(agent, 88880, { from: owner });
    await manager.exposeEnforceReputationGrowth(agent, 1000, { from: owner });
    assert.equal((await manager.reputation(agent)).toString(), "88888");

    await manager.exposeEnforceReputationGrowth(agent, 1, { from: owner });
    assert.equal((await manager.reputation(agent)).toString(), "88888");
  });

  it("caps JobCreated details payload", async () => {
    const { manager, token } = await deployManager();

    await createJobWithEscrow(manager, token, "a".repeat(1024));

    const payout = web3.utils.toWei("2");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await expectCustomError(
      manager.createJob.call("ipfs://spec", payout, 1000, "a".repeat(1025), { from: employer }),
      "InvalidParameters"
    );
  });

  it("blocks protected policy setters while escrow or bonds are nonzero", async () => {
    const { manager, token } = await deployManager();
    const payout = await createJobWithEscrow(manager, token);

    await expectCustomError(manager.updateMerkleRoots.call(ZERO32, ZERO32, { from: owner }), "InvalidState");
    await expectCustomError(manager.setRequiredValidatorApprovals.call(2, { from: owner }), "InvalidState");
    await expectCustomError(manager.setRequiredValidatorDisapprovals.call(2, { from: owner }), "InvalidState");
    await expectCustomError(manager.setVoteQuorum.call(2, { from: owner }), "InvalidState");
    await expectCustomError(manager.setCompletionReviewPeriod.call(1, { from: owner }), "InvalidState");
    await expectCustomError(manager.setDisputeReviewPeriod.call(1, { from: owner }), "InvalidState");
    await expectCustomError(manager.setChallengePeriodAfterApproval.call(1, { from: owner }), "InvalidState");
    await expectCustomError(manager.setValidatorSlashBps.call(100, { from: owner }), "InvalidState");

    await manager.cancelJob(0, { from: employer });
    assert.equal((await manager.lockedEscrow()).toString(), "0");

    await manager.updateMerkleRoots(ZERO32, ZERO32, { from: owner });
    await manager.setRequiredValidatorApprovals(2, { from: owner });
    await manager.setRequiredValidatorDisapprovals(2, { from: owner });
    await manager.setVoteQuorum(2, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });
    await manager.setDisputeReviewPeriod(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });
    await manager.setValidatorSlashBps(100, { from: owner });

    assert.equal((await token.balanceOf(employer)).toString(), payout);
  });

  it("emits ENS hook telemetry and preserves liveness when hooks revert", async () => {
    const { manager, token } = await deployManager();
    const pages = await MockENSJobPages.new({ from: owner });
    await manager.setEnsJobPages(pages.address, { from: owner });

    await pages.setRevertHook(1, true, { from: owner });
    await pages.setRevertHook(2, true, { from: owner });
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });

    const payout = web3.utils.toWei("2");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs://spec", payout, 1000, "details", { from: employer });
    await expectEvent(createTx, "EnsHookAttempted", {
      hook: new BN(1),
      jobId: new BN(0),
      target: pages.address,
      success: false,
    });

    await manager.addAdditionalAgent(agent, { from: owner });
    await token.mint(agent, payout, { from: owner });
    await token.approve(manager.address, payout, { from: agent });
    const applyTx = await manager.applyForJob(0, "agent", [], { from: agent });
    await expectEvent(applyTx, "EnsHookAttempted", {
      hook: new BN(2),
      jobId: new BN(0),
      target: pages.address,
      success: false,
    });

    await pages.setRevertHook(3, false, { from: owner });
    const completionTx = await manager.requestJobCompletion(0, "ipfs://completion", { from: agent });
    await expectEvent(completionTx, "EnsHookAttempted", {
      hook: new BN(3),
      jobId: new BN(0),
      target: pages.address,
      success: true,
    });
  });

  it("keeps ENS selectors and fixed calldata lengths compatible", async () => {
    const { manager } = await deployManager();
    const pages = await MockENSJobPages.new({ from: owner });

    assert.equal(web3.utils.keccak256("handleHook(uint8,uint256)").slice(0, 10), "0x1f76f7a2");
    assert.equal(web3.utils.keccak256("jobEnsURI(uint256)").slice(0, 10), "0x751809b4");

    const hookCalldata = web3.eth.abi.encodeFunctionCall(
      {
        name: "handleHook",
        type: "function",
        inputs: [
          { type: "uint8", name: "hook" },
          { type: "uint256", name: "jobId" },
        ],
      },
      ["1", "7"]
    );
    assert.equal((hookCalldata.length - 2) / 2, 0x44);
    await web3.eth.sendTransaction({ to: pages.address, data: hookCalldata, from: owner, gas: 300000 });
    assert.equal((await pages.lastHandleHookCalldataLength()).toString(), "68");

    const uriCalldata = web3.eth.abi.encodeFunctionCall(
      {
        name: "jobEnsURI",
        type: "function",
        inputs: [{ type: "uint256", name: "jobId" }],
      },
      ["9"]
    );
    assert.equal((uriCalldata.length - 2) / 2, 0x24);
    const uriRaw = await web3.eth.call({ to: pages.address, data: uriCalldata, from: other });
    const decoded = web3.eth.abi.decodeParameter("string", uriRaw);
    assert(decoded.length > 0 && decoded.length <= 1024, "decoded URI must be bounded");

    await manager.setEnsJobPages(pages.address, { from: owner });
    await manager.setUseEnsJobTokenURI(true, { from: owner });
  });
});
