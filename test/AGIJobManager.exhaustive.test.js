const { expectRevert, time } = require("@openzeppelin/test-helpers");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const FailingERC20 = artifacts.require("FailingERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { rootNode, setNameWrapperOwnership, setResolverOwnership } = require("./helpers/ens");

const EMPTY_PROOF = [];

function leafFor(address) {
  return web3.utils.soliditySha3({ type: "address", value: address });
}

function buildMerkle(addresses) {
  const leaves = addresses.map((addr) => Buffer.from(leafFor(addr).slice(2), "hex"));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return {
    root: tree.getHexRoot(),
    proofFor: (addr) => tree.getHexProof(Buffer.from(leafFor(addr).slice(2), "hex")),
  };
}

async function deployManager({
  token,
  ens,
  nameWrapper,
  validatorRootNode,
  agentRootNode,
  validatorMerkleRoot,
  agentMerkleRoot,
  owner,
}) {
  return AGIJobManager.new(
    token.address,
    "ipfs://base",
    ens.address,
    nameWrapper.address,
    validatorRootNode,
    agentRootNode,
    validatorMerkleRoot,
    agentMerkleRoot,
    { from: owner }
  );
}

async function createJob({ manager, token, employer, payout, duration = 1000, ipfsHash = "job1" }) {
  const jobId = (await manager.nextJobId()).toNumber();
  await token.approve(manager.address, payout, { from: employer });
  await manager.createJob(ipfsHash, payout, duration, "details", { from: employer });
  return jobId;
}

contract("AGIJobManager exhaustive suite", (accounts) => {
  const [owner, employer, agent, validator, validatorTwo, buyer, moderator, other] = accounts;

  let token;
  let ens;
  let resolver;
  let nameWrapper;
  let agentMerkle;
  let validatorMerkle;
  let manager;
  let defaultAgiType;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    agentMerkle = buildMerkle([agent]);
    validatorMerkle = buildMerkle([validator, validatorTwo]);

    manager = await deployManager({
      token,
      ens,
      nameWrapper,
      validatorRootNode: rootNode("club-root"),
      agentRootNode: rootNode("agent-root"),
      validatorMerkleRoot: validatorMerkle.root,
      agentMerkleRoot: agentMerkle.root,
      owner,
    });

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });

    await token.mint(employer, web3.utils.toWei("1000"), { from: owner });
    await token.mint(buyer, web3.utils.toWei("1000"), { from: owner });
    defaultAgiType = await MockERC721.new({ from: owner });
    await manager.addAGIType(defaultAgiType.address, 1, { from: owner });
    await defaultAgiType.mint(agent, { from: owner });
  });

  describe("Deployment & initialization", () => {
    it("deploys with constructor args and defaults", async () => {
      const defaultsManager = await deployManager({
        token,
        ens,
        nameWrapper,
        validatorRootNode: rootNode("club-root"),
        agentRootNode: rootNode("agent-root"),
        validatorMerkleRoot: validatorMerkle.root,
        agentMerkleRoot: agentMerkle.root,
        owner,
      });
      const tokenAddress = await defaultsManager.agiToken();
      assert.equal(tokenAddress, token.address);
      assert.equal(await defaultsManager.name(), "AGIJobs");
      assert.equal(await defaultsManager.symbol(), "Job");
      assert.equal(await defaultsManager.requiredValidatorApprovals(), "3");
      assert.equal(await defaultsManager.requiredValidatorDisapprovals(), "3");
      assert.equal(await defaultsManager.maxJobPayout(), web3.utils.toWei("4888"));
      assert.equal(await defaultsManager.jobDurationLimit(), "10000000");
      assert.equal(await defaultsManager.owner(), owner);
    });

    it("allows owner to pause/unpause and blocks when paused", async () => {
      const jobId = await createJob({
        manager,
        token,
        employer,
        payout: web3.utils.toWei("1"),
        ipfsHash: "paused-job",
      });
      await manager.pause({ from: owner });
      await expectRevert.unspecified(
        manager.createJob("ipfs", web3.utils.toWei("1"), 1000, "details", { from: employer })
      );
      const status = await manager.getJobStatus(jobId);
      assert.equal(status[2], "paused-job");
      await manager.unpause({ from: owner });
    });
  });

  describe("Job lifecycle happy path", () => {
    it("creates, assigns, completes, pays out, and mints NFT", async () => {
      const payout = web3.utils.toWei("100");
      const jobId = await createJob({ manager, token, employer, payout });
      const contractBalance = await token.balanceOf(manager.address);
      assert.equal(contractBalance.toString(), payout.toString());

      const agiType = await MockERC721.new({ from: owner });
      await agiType.mint(agent, { from: owner });
      await manager.addAGIType(agiType.address, 92, { from: owner });

      await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      const jobInfo = await manager.jobs(jobId);
      assert.equal(jobInfo.assignedAgent, agent);
      assert.notEqual(jobInfo.assignedAt.toString(), "0");

      await manager.requestJobCompletion(jobId, "ipfs2", { from: agent });
      const status = await manager.getJobStatus(jobId);
      assert.equal(status[1], true);
      assert.equal(status[2], "ipfs2");
      const completionJob = await manager.jobs(jobId);
      assert.equal(completionJob.jobCompletionURI, "ipfs2");

      const employerBalanceBefore = await token.balanceOf(employer);
      const agentBalanceBefore = await token.balanceOf(agent);
      const validatorBalanceBefore = await token.balanceOf(validator);

      await manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator });

      const agentBalanceAfter = await token.balanceOf(agent);
      const validatorBalanceAfter = await token.balanceOf(validator);
      const employerBalanceAfter = await token.balanceOf(employer);

      assert.equal(employerBalanceAfter.toString(), employerBalanceBefore.toString());
      assert.equal(agentBalanceAfter.sub(agentBalanceBefore).toString(), web3.utils.toWei("92"));
      assert.equal(validatorBalanceAfter.sub(validatorBalanceBefore).toString(), web3.utils.toWei("8"));

      const tokenId = (await manager.nextTokenId()).toNumber() - 1;
      const tokenURI = await manager.tokenURI(tokenId);
      assert.equal(tokenURI, "ipfs://base/ipfs2");
      assert.equal(await manager.ownerOf(tokenId), employer);

      const agentReputation = await manager.reputation(agent);
      const validatorReputation = await manager.reputation(validator);
      assert(agentReputation.gt(web3.utils.toBN(0)));
      assert(validatorReputation.gt(web3.utils.toBN(0)));
    });
  });

  describe("Better-only hardening fixes", () => {
    it("reverts on non-existent job ids", async () => {
      await expectRevert.unspecified(manager.applyForJob(99, "agent", EMPTY_PROOF, { from: agent }));
      await expectRevert.unspecified(manager.validateJob(99, "validator", EMPTY_PROOF, { from: validator }));
      await expectRevert.unspecified(manager.disapproveJob(99, "validator", EMPTY_PROOF, { from: validator }));
      await expectRevert.unspecified(manager.disputeJob(99, { from: employer }));
      await expectRevert.unspecified(manager.cancelJob(99, { from: employer }));
      await expectRevert.unspecified(manager.delistJob(99, { from: owner }));
    });

    it("prevents double completion and follow-on payouts", async () => {
      const payout = web3.utils.toWei("50");
      const jobId = await createJob({ manager, token, employer, payout });
      const agiType = await MockERC721.new({ from: owner });
      await agiType.mint(agent, { from: owner });
      await manager.addAGIType(agiType.address, 92, { from: owner });

      await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator });

      await expectRevert.unspecified(
        manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validatorTwo), { from: validatorTwo })
      );
      await expectRevert.unspecified(manager.disapproveJob(jobId, "validator", EMPTY_PROOF, { from: validatorTwo }));
    });

    it("avoids div-by-zero on agent-win dispute with no validators", async () => {
      const payout = web3.utils.toWei("10");
      const jobId = await createJob({ manager, token, employer, payout });
      const agiType = await MockERC721.new({ from: owner });
      await agiType.mint(agent, { from: owner });
      await manager.addAGIType(agiType.address, 92, { from: owner });

      await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await manager.disputeJob(jobId, { from: employer });
      await manager.addModerator(moderator, { from: owner });

      await manager.resolveDispute(jobId, "agent win", { from: moderator });
      const tokenId = (await manager.nextTokenId()).toNumber() - 1;
      assert.equal(await manager.ownerOf(tokenId), employer);
    });

    it("enforces vote rules and blacklist gating", async () => {
      const payout = web3.utils.toWei("25");
      const jobId = await createJob({ manager, token, employer, payout });
      await manager.blacklistAgent(agent, true, { from: owner });
      await expectRevert.unspecified(manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent }));
      await manager.blacklistAgent(agent, false, { from: owner });
      await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

      await manager.blacklistValidator(validator, true, { from: owner });
      await expectRevert.unspecified(
        manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator })
      );
      await manager.blacklistValidator(validator, false, { from: owner });

      await manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator });
      await expectRevert.unspecified(
        manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator })
      );
      await expectRevert.unspecified(
        manager.disapproveJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator })
      );
    });

    it("requires assignment before validator votes", async () => {
      const payout = web3.utils.toWei("15");
      const jobId = await createJob({ manager, token, employer, payout });
      await expectRevert.unspecified(
        manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator })
      );
    });

    it("marks job disputed when disapproval threshold reached", async () => {
      const payout = web3.utils.toWei("18");
      const jobId = await createJob({ manager, token, employer, payout });
      await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await manager.disapproveJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator });
      const job = await manager.jobs(jobId);
      assert.equal(job.disputed, true);
    });

    it("dispute resolution respects typed outcomes and keeps NO_ACTION disputed", async () => {
      const payout = web3.utils.toWei("30");
      const jobId = await createJob({ manager, token, employer, payout });
      const agiType = await MockERC721.new({ from: owner });
      await agiType.mint(agent, { from: owner });
      await manager.addAGIType(agiType.address, 92, { from: owner });

      await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      await manager.addModerator(moderator, { from: owner });

      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await manager.disputeJob(jobId, { from: employer });
      await manager.resolveDisputeWithCode(jobId, 0, "needs more info", { from: moderator });
      const job = await manager.jobs(jobId);
      assert.equal(job.disputed, true);
      assert.equal(job.completed, false);

      await manager.resolveDisputeWithCode(jobId, 2, "employer win", { from: moderator });
      const jobAfter = await manager.jobs(jobId);
      assert.equal(jobAfter.completed, true);
      await expectRevert.unspecified(
        manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator })
      );
    });

    it("settles agent win via resolveDisputeWithCode", async () => {
      const payout = web3.utils.toWei("22");
      const jobId = await createJob({ manager, token, employer, payout });

      await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      await manager.addModerator(moderator, { from: owner });
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await manager.disputeJob(jobId, { from: employer });

      const agentBalanceBefore = web3.utils.toBN(await token.balanceOf(agent));
      await manager.resolveDisputeWithCode(jobId, 1, "agent win", { from: moderator });
      const agentBalanceAfter = web3.utils.toBN(await token.balanceOf(agent));

      const expectedPayout = web3.utils.toBN(payout).div(web3.utils.toBN(100));
      assert(agentBalanceAfter.sub(agentBalanceBefore).eq(expectedPayout));

      const jobAfter = await manager.jobs(jobId);
      assert.equal(jobAfter.completed, true);
    });
  });

  describe("Checked ERC20 transfers", () => {
    it("reverts createJob if transferFrom fails", async () => {
      const failingToken = await FailingERC20.new({ from: owner });
      await failingToken.mint(employer, web3.utils.toWei("10"), { from: owner });
      const failingManager = await deployManager({
        token: failingToken,
        ens,
        nameWrapper,
        validatorRootNode: rootNode("club-root"),
        agentRootNode: rootNode("agent-root"),
        validatorMerkleRoot: validatorMerkle.root,
        agentMerkleRoot: agentMerkle.root,
        owner,
      });

      await failingToken.approve(failingManager.address, web3.utils.toWei("10"), { from: employer });
      await failingToken.setFailTransferFroms(true, { from: owner });
      await expectRevert.unspecified(
        failingManager.createJob("ipfs", web3.utils.toWei("10"), 1000, "details", { from: employer })
      );
    });

    it("reverts payouts when transfer returns false", async () => {
      const failingToken = await FailingERC20.new({ from: owner });
      await failingToken.mint(employer, web3.utils.toWei("100"), { from: owner });
      const failingManager = await deployManager({
        token: failingToken,
        ens,
        nameWrapper,
        validatorRootNode: rootNode("club-root"),
        agentRootNode: rootNode("agent-root"),
        validatorMerkleRoot: validatorMerkle.root,
        agentMerkleRoot: agentMerkle.root,
        owner,
      });
      await failingManager.setRequiredValidatorApprovals(1, { from: owner });

      const jobId = await createJob({
        manager: failingManager,
        token: failingToken,
        employer,
        payout: web3.utils.toWei("50"),
      });
      const agiType = await MockERC721.new({ from: owner });
      await agiType.mint(agent, { from: owner });
      await failingManager.addAGIType(agiType.address, 92, { from: owner });
      await failingManager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      await failingManager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

      await failingToken.setFailTransfers(true, { from: owner });
      await expectRevert.unspecified(
        failingManager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator })
      );
    });

    it("reverts purchaseNFT when transferFrom fails", async () => {
      const failingToken = await FailingERC20.new({ from: owner });
      await failingToken.mint(employer, web3.utils.toWei("100"), { from: owner });
      await failingToken.mint(buyer, web3.utils.toWei("100"), { from: owner });

      const failingManager = await deployManager({
        token: failingToken,
        ens,
        nameWrapper,
        validatorRootNode: rootNode("club-root"),
        agentRootNode: rootNode("agent-root"),
        validatorMerkleRoot: validatorMerkle.root,
        agentMerkleRoot: agentMerkle.root,
        owner,
      });
      await failingManager.setRequiredValidatorApprovals(1, { from: owner });
      const jobId = await createJob({
        manager: failingManager,
        token: failingToken,
        employer,
        payout: web3.utils.toWei("50"),
      });
      const agiType = await MockERC721.new({ from: owner });
      await agiType.mint(agent, { from: owner });
      await failingManager.addAGIType(agiType.address, 92, { from: owner });
      await failingManager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      await failingManager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await failingManager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator });

      const tokenId = (await failingManager.nextTokenId()).toNumber() - 1;
      await failingManager.listNFT(tokenId, web3.utils.toWei("10"), { from: employer });
      await failingToken.approve(failingManager.address, web3.utils.toWei("10"), { from: buyer });
      await failingToken.setFailTransferFroms(true, { from: owner });

      await expectRevert.unspecified(failingManager.purchaseNFT(tokenId, { from: buyer }));
    });
  });

  describe("Admin & configuration", () => {
    it("enforces owner-only modifiers and updates config", async () => {
      await expectRevert.unspecified(manager.pause({ from: other }));
      await manager.setBaseIpfsUrl("ipfs://new", { from: owner });
      assert.equal(await manager.canAccessPremiumFeature(agent), false);

      await manager.setPremiumReputationThreshold(1, { from: owner });
      assert.equal(await manager.premiumReputationThreshold(), "1");

      await manager.addModerator(moderator, { from: owner });
      assert.equal(await manager.moderators(moderator), true);
      await manager.removeModerator(moderator, { from: owner });
      assert.equal(await manager.moderators(moderator), false);

      await manager.addAdditionalAgent(agent, { from: owner });
      await manager.addAdditionalValidator(validator, { from: owner });
      assert.equal(await manager.additionalAgents(agent), true);
      assert.equal(await manager.additionalValidators(validator), true);

      await manager.removeAdditionalAgent(agent, { from: owner });
      await manager.removeAdditionalValidator(validator, { from: owner });
      assert.equal(await manager.additionalAgents(agent), false);
      assert.equal(await manager.additionalValidators(validator), false);
    });

    it("withdrawAGI respects bounds", async () => {
      await token.approve(manager.address, web3.utils.toWei("5"), { from: employer });
      await manager.contributeToRewardPool(web3.utils.toWei("5"), { from: employer });
      await expectRevert.unspecified(manager.withdrawAGI(0, { from: owner }));
      await expectRevert.unspecified(manager.withdrawAGI(web3.utils.toWei("100"), { from: owner }));
      await expectRevert.unspecified(manager.withdrawAGI(web3.utils.toWei("5"), { from: owner }));
      await manager.pause({ from: owner });
      await manager.withdrawAGI(web3.utils.toWei("5"), { from: owner });
      const balance = await token.balanceOf(manager.address);
      assert.equal(balance.toString(), "0");
    });
  });

  describe("NFT marketplace", () => {
    it("lists, purchases, and delists NFTs", async () => {
      const payout = web3.utils.toWei("40");
      const jobId = await createJob({ manager, token, employer, payout });
      const agiType = await MockERC721.new({ from: owner });
      await agiType.mint(agent, { from: owner });
      await manager.addAGIType(agiType.address, 92, { from: owner });
      await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator });

      const tokenId = (await manager.nextTokenId()).toNumber() - 1;
      await expectRevert.unspecified(manager.listNFT(tokenId, 0, { from: employer }));
      await manager.listNFT(tokenId, web3.utils.toWei("5"), { from: employer });
      await token.approve(manager.address, web3.utils.toWei("5"), { from: buyer });
      await manager.purchaseNFT(tokenId, { from: buyer });
      assert.equal(await manager.ownerOf(tokenId), buyer);

      await manager.listNFT(tokenId, web3.utils.toWei("7"), { from: buyer });
      await manager.delistNFT(tokenId, { from: buyer });
      await expectRevert.unspecified(manager.purchaseNFT(tokenId, { from: employer }));
    });
  });

  describe("Ownership gating (ENS + Merkle)", () => {
    it("accepts valid Merkle proofs and rejects invalid ones", async () => {
      const payout = web3.utils.toWei("15");
      const jobId = await createJob({ manager, token, employer, payout });

      await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await expectRevert.unspecified(manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator }));
      await manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator });
    });

    it("accepts NameWrapper and Resolver ownership", async () => {
      const payout = web3.utils.toWei("12");
      const jobId = await createJob({ manager, token, employer, payout });

      await setNameWrapperOwnership(nameWrapper, rootNode("agent-root"), "alice", agent);
      await manager.applyForJob(jobId, "alice", EMPTY_PROOF, { from: agent });

      await setResolverOwnership(ens, resolver, rootNode("club-root"), "validator", validator);
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    });
  });

  describe("Timing constraints", () => {
    it("prevents completion request after duration", async () => {
      const payout = web3.utils.toWei("10");
      const jobId = await createJob({ manager, token, employer, payout, duration: 1 });
      await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });
      await time.increase(2);
      await expectRevert.unspecified(manager.requestJobCompletion(jobId, "late", { from: agent }));
    });
  });
});
