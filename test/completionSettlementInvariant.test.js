const assert = require("assert");

const TestableAGIJobManager = artifacts.require("TestableAGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { expectCustomError } = require("./helpers/errors");
const { AGENT_ROOT_NODE, CLUB_ROOT_NODE } = require("./helpers/constants");
const { AGI_TOKEN_ADDRESS, createFixedTokenManager } = require("./helpers/fixedToken");

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

contract("AGIJobManager completion settlement invariants", (accounts) => {
  const [owner, employer, agent, validator, moderator] = accounts;
  let token;
  let manager;
  let fixedToken;

  before(async () => {
    fixedToken = await createFixedTokenManager(MockERC20);
  });

  beforeEach(async () => {
    token = await fixedToken.reset();
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await TestableAGIJobManager.new(
      AGI_TOKEN_ADDRESS,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      CLUB_ROOT_NODE,
      AGENT_ROOT_NODE,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 90, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.addModerator(moderator, { from: owner });

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setDisputeReviewPeriod(100, { from: owner });
  });

  async function createJob(payout) {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs-spec", payout, 1000, "details", { from: employer });
    return tx.logs.find((log) => log.event === "JobCreated").args.jobId.toNumber();
  }

  async function setupDisputedJob(payout) {
    const jobId = await createJob(payout);
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await manager.disputeJob(jobId, { from: employer });
    return jobId;
  }

  it("reverts agent-win dispute resolution without a completion request", async () => {
    const jobId = await setupDisputedJob(toBN(toWei("5")));

    await manager.setJobMetadata(jobId, "ipfs-complete", "ipfs-spec", false, false, { from: owner });

    await expectCustomError(
      manager.resolveDisputeWithCode.call(jobId, 1, "agent win", { from: moderator }),
      "InvalidState"
    );
  });

  it("reverts agent-win dispute resolution when completion metadata is empty", async () => {
    const jobId = await setupDisputedJob(toBN(toWei("6")));

    await manager.setJobMetadata(jobId, "", "ipfs-spec", true, false, { from: owner });

    await expectCustomError(
      manager.resolveDisputeWithCode.call(jobId, 1, "agent win", { from: moderator }),
      "InvalidParameters"
    );
  });

  it("reverts stale dispute resolution without a completion request", async () => {
    const jobId = await setupDisputedJob(toBN(toWei("7")));

    await manager.setJobMetadata(jobId, "ipfs-complete", "ipfs-spec", false, false, { from: owner });

    await advanceTime(120);
    await manager.pause({ from: owner });

    await expectCustomError(manager.resolveStaleDispute.call(jobId, false, { from: owner }), "InvalidState");
  });

  it("mints completion NFTs using the completion metadata URI", async () => {
    const jobId = await createJob(toBN(toWei("9")));

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    const tx = await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });

    const issued = tx.logs.find((log) => log.event === "NFTIssued");
    assert.ok(issued, "NFTIssued event should be emitted");

    const tokenId = issued.args.tokenId.toNumber();
    const tokenUri = await manager.tokenURI(tokenId);
    assert.equal(tokenUri, "ipfs://base/ipfs-complete");
  });
});
