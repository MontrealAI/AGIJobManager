const assert = require("assert");
const { BN, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const FailTransferToken = artifacts.require("FailTransferToken");
const FailingERC20 = artifacts.require("FailingERC20");
const { buildInitConfig } = require("./helpers/deploy");
const {
  fundValidators,
  fundAgents,
  fundDisputeBond,
  computeValidatorBond,
  computeAgentBond,
} = require("./helpers/bonds");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function hashAddress(address) {
  return Buffer.from(
    web3.utils.soliditySha3({ type: "address", value: address }).slice(2),
    "hex"
  );
}

function buildTree(addresses) {
  const leaves = addresses.map(hashAddress);
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return { tree, root: tree.getHexRoot() };
}

function buildProof(tree, address) {
  return tree.getHexProof(hashAddress(address));
}

function makeSubnode(rootNode, label) {
  const labelHash = web3.utils.soliditySha3({ type: "string", value: label });
  return web3.utils.soliditySha3(
    { type: "bytes32", value: rootNode },
    { type: "bytes32", value: labelHash }
  );
}

function extractRevertData(error) {
  if (!error || !error.data) {
    return null;
  }
  if (typeof error.data === "string") {
    return error.data;
  }
  if (typeof error.data === "object") {
    const values = Array.isArray(error.data) ? error.data : Object.values(error.data);
    for (const value of values) {
      if (value && typeof value === "string") {
        return value;
      }
      if (value && value.result) {
        return value.result;
      }
      if (value && value.data) {
        if (typeof value.data === "string") {
          return value.data;
        }
        if (value.data.result) {
          return value.data.result;
        }
      }
    }
  }
  if (error.data.result) {
    return error.data.result;
  }
  if (error.data.data) {
    if (typeof error.data.data === "string") {
      return error.data.data;
    }
    if (error.data.data.result) {
      return error.data.data.result;
    }
  }
  return null;
}

async function expectCustomError(promise, errorName) {
  try {
    await promise;
  } catch (error) {
    const selector = web3.utils.keccak256(`${errorName}()`).slice(0, 10);
    const data = extractRevertData(error);
    if (data && data.startsWith(selector)) {
      return;
    }
    const message = error.message || "";
    if (message.includes(selector)) {
      return;
    }
    if (message.includes("Custom error (could not decode)") || message.includes("revert")) {
      return;
    }
    throw error;
  }
  assert.fail(`Expected custom error ${errorName} not received`);
}

async function createJob(manager, token, employer, payout, duration = 1000, ipfsHash = "ipfs-job") {
  const jobId = (await manager.nextJobId()).toNumber();
  await token.approve(manager.address, payout, { from: employer });
  const receipt = await manager.createJob(ipfsHash, payout, duration, "details", { from: employer });
  return { jobId, receipt };
}

async function assignJob(manager, jobId, agent, proof, subdomain = "agent") {
  return manager.applyForJob(jobId, subdomain, proof, { from: agent });
}

contract("AGIJobManager comprehensive", (accounts) => {
  const [
    owner,
    employer,
    agent,
    validator1,
    validator2,
    validator3,
    validator4,
    moderator,
    buyer,
    other,
  ] = accounts;

  let token;
  let nft;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let validatorTree;
  let agentTree;
  let validatorRoot;
  let agentRoot;
  let baseIpfsUrl;
  let clubRootNode;
  let agentRootNode;
  let alphaClubRootNode;
  let alphaAgentRootNode;
  let agentTokenId;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    nft = await MockERC721.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    const validatorTreeData = buildTree([validator1, validator2, validator3]);
    validatorTree = validatorTreeData.tree;
    validatorRoot = validatorTreeData.root;

    const agentTreeData = buildTree([agent]);
    agentTree = agentTreeData.tree;
    agentRoot = agentTreeData.root;

    baseIpfsUrl = "ipfs://base";
    clubRootNode = web3.utils.soliditySha3({ type: "string", value: "club-root" });
    agentRootNode = web3.utils.soliditySha3({ type: "string", value: "agent-root" });
    alphaClubRootNode = clubRootNode;
    alphaAgentRootNode = agentRootNode;

    manager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        baseIpfsUrl,
        ens.address,
        nameWrapper.address,
        clubRootNode,
        agentRootNode,
        alphaClubRootNode,
        alphaAgentRootNode,
        validatorRoot,
        agentRoot,
      ),
      { from: owner }
    );
    await manager.setChallengePeriodAfterApproval(1, { from: owner });

    await token.mint(employer, web3.utils.toWei("500"), { from: owner });
    await token.mint(buyer, web3.utils.toWei("500"), { from: owner });
    await token.mint(other, web3.utils.toWei("500"), { from: owner });
    await manager.addAGIType(nft.address, 1, { from: owner });
    const mintReceipt = await nft.mint(agent, { from: owner });
    agentTokenId = mintReceipt.logs[0].args.tokenId.toNumber();

    await fundValidators(token, manager, [validator1, validator2, validator3], owner);
    await fundAgents(token, manager, [agent, other], owner);
  });

  describe("deployment & initialization", () => {
    it("deploys with expected defaults and ownership", async () => {
      assert.equal(await manager.agiToken(), token.address);
      assert.equal(await manager.requiredValidatorApprovals(), "3");
      assert.equal(await manager.requiredValidatorDisapprovals(), "3");
      assert.equal(await manager.validationRewardPercentage(), "8");
      assert.equal(await manager.maxJobPayout(), web3.utils.toWei("88888888"));
      assert.equal(await manager.jobDurationLimit(), "10000000");
      assert.equal(await manager.owner(), owner);
      assert.equal(await manager.name(), "AGIJobs");
      assert.equal(await manager.symbol(), "Job");
      assert.equal(await manager.ens(), ens.address);
      assert.equal(await manager.nameWrapper(), nameWrapper.address);
      assert.equal(await manager.clubRootNode(), clubRootNode);
      assert.equal(await manager.agentRootNode(), agentRootNode);
      assert.equal(await manager.alphaClubRootNode(), alphaClubRootNode);
      assert.equal(await manager.alphaAgentRootNode(), alphaAgentRootNode);
      assert.equal(await manager.validatorMerkleRoot(), validatorRoot);
      assert.equal(await manager.agentMerkleRoot(), agentRoot);
    });

    it("allows owner to pause/unpause and blocks whenNotPaused flows", async () => {
      await expectRevert.unspecified(manager.pause({ from: other }));
      await manager.pause({ from: owner });

      await expectRevert.unspecified(
        manager.createJob("ipfs", web3.utils.toWei("1"), 1000, "details", { from: employer }));
      assert.equal((await manager.nextJobId()).toString(), "0");

      await manager.unpause({ from: owner });
      await token.approve(manager.address, web3.utils.toWei("1"), { from: employer });
      await manager.createJob("ipfs", web3.utils.toWei("1"), 1000, "details", { from: employer });
    });
  });

  describe("job lifecycle happy path", () => {
    it("escrows payout, completes, pays agent/validators, and mints NFT", async () => {
      await nft.mint(agent, { from: owner });
      await manager.addAGIType(nft.address, 90, { from: owner });

      const payout = new BN(web3.utils.toWei("100"));
      const { jobId } = await createJob(manager, token, employer, payout, 2000, "ipfs-job-1");

      const applyReceipt = await assignJob(manager, jobId, agent, buildProof(agentTree, agent));
      expectEvent(applyReceipt, "JobApplied", { jobId: new BN(jobId), agent });

      const completionReceipt = await manager.requestJobCompletion(jobId, "ipfs-final", { from: agent });
      expectEvent(completionReceipt, "JobCompletionRequested", {
        jobId: new BN(jobId),
        agent,
        jobCompletionURI: "ipfs-final",
      });

      const validator1Proof = buildProof(validatorTree, validator1);
      const validator2Proof = buildProof(validatorTree, validator2);
      const validator3Proof = buildProof(validatorTree, validator3);

      const employerBalanceBefore = new BN(await token.balanceOf(employer));
      const agentBalanceBefore = new BN(await token.balanceOf(agent));
      const validator1BalanceBefore = new BN(await token.balanceOf(validator1));
      const validator2BalanceBefore = new BN(await token.balanceOf(validator2));
      const validator3BalanceBefore = new BN(await token.balanceOf(validator3));

      await manager.validateJob(jobId, "validator", validator1Proof, { from: validator1 });
      await manager.validateJob(jobId, "validator", validator2Proof, { from: validator2 });
      const receipt = await manager.validateJob(jobId, "validator", validator3Proof, { from: validator3 });

      expectEvent(receipt, "JobValidated", { jobId: new BN(jobId), validator: validator3 });

      await time.increase((await manager.challengePeriodAfterApproval()).addn(1));
      const finalizeReceipt = await manager.finalizeJob(jobId, { from: employer });
      expectEvent(finalizeReceipt, "JobCompleted", { jobId: new BN(jobId), agent });
      expectEvent(finalizeReceipt, "NFTIssued");

      const agentPayout = payout.muln(90).divn(100);
      const totalValidatorPayout = payout.muln(8).divn(100);
      const validatorPayout = totalValidatorPayout.divn(3);
      const validatorRemainder = totalValidatorPayout.sub(validatorPayout.muln(3));
      const agentBond = await computeAgentBond(manager, payout, new BN(2000));
      const expectedAgentPayout = agentPayout.add(validatorRemainder).add(agentBond);

      const agentBalanceAfter = new BN(await token.balanceOf(agent));
      const validator1BalanceAfter = new BN(await token.balanceOf(validator1));
      const validator2BalanceAfter = new BN(await token.balanceOf(validator2));
      const validator3BalanceAfter = new BN(await token.balanceOf(validator3));
      const employerBalanceAfter = new BN(await token.balanceOf(employer));

      assert(agentBalanceAfter.sub(agentBalanceBefore).eq(expectedAgentPayout));
      assert(validator1BalanceAfter.sub(validator1BalanceBefore).eq(validatorPayout));
      assert(validator2BalanceAfter.sub(validator2BalanceBefore).eq(validatorPayout));
      assert(validator3BalanceAfter.sub(validator3BalanceBefore).eq(validatorPayout));
      assert(employerBalanceBefore.sub(employerBalanceAfter).eq(new BN(0)));

      const reputationAgent = new BN(await manager.reputation(agent));
      const reputationValidator = new BN(await manager.reputation(validator1));
      assert(reputationAgent.gt(new BN(0)));
      assert(reputationValidator.gt(new BN(0)));

      const tokenId = (await manager.nextTokenId()).subn(1);
      assert.equal(await manager.ownerOf(tokenId), employer);
      assert.equal(await manager.tokenURI(tokenId), `${baseIpfsUrl}/ipfs-final`);
    });

    it("prevents reassigning an already assigned job", async () => {
      const payout = new BN(web3.utils.toWei("2"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);

      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));
      await expectCustomError(
        assignJob(manager, jobId, other, buildProof(agentTree, other)),
        "InvalidState"
      );
    });

    it("rejects empty completion metadata URIs", async () => {
      const payout = new BN(web3.utils.toWei("2"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));

      await expectCustomError(manager.requestJobCompletion(jobId, "", { from: agent }), "InvalidParameters");
    });
  });

  describe("job creation and cancellation rules", () => {
    it("validates createJob parameters", async () => {
      await expectCustomError(
        manager.createJob("ipfs", 0, 1000, "details", { from: employer }),
        "InvalidParameters"
      );
      await expectCustomError(
        manager.createJob("ipfs", web3.utils.toWei("1"), 0, "details", { from: employer }),
        "InvalidParameters"
      );

      const maxPayout = new BN(await manager.maxJobPayout());
      await expectCustomError(
        manager.createJob("ipfs", maxPayout.addn(1), 1000, "details", { from: employer }),
        "InvalidParameters"
      );
    });

    it("restricts cancel/delist to proper callers and states", async () => {
      const payout = new BN(web3.utils.toWei("3"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);

      await expectCustomError(manager.cancelJob(jobId, { from: other }), "NotAuthorized");

      const employerBalanceBefore = new BN(await token.balanceOf(employer));
      await manager.cancelJob(jobId, { from: employer });
      const employerBalanceAfter = new BN(await token.balanceOf(employer));
      assert(employerBalanceAfter.sub(employerBalanceBefore).eq(payout));

      const { jobId: jobId2 } = await createJob(manager, token, employer, payout, 1000, "ipfs-2");
      await assignJob(manager, jobId2, agent, buildProof(agentTree, agent));

      await expectCustomError(manager.cancelJob(jobId2, { from: employer }), "InvalidState");
      await expectRevert.unspecified(manager.delistJob(jobId2, { from: other }));
      await expectCustomError(manager.delistJob(jobId2, { from: owner }), "InvalidState");
    });

    it("escrows funds on createJob", async () => {
      const payout = new BN(web3.utils.toWei("4"));
      const contractBalanceBefore = new BN(await token.balanceOf(manager.address));
      const { jobId } = await createJob(manager, token, employer, payout, 1000, "ipfs-escrow");
      const contractBalanceAfter = new BN(await token.balanceOf(manager.address));

      assert(contractBalanceAfter.sub(contractBalanceBefore).eq(payout));

      const job = await manager.getJobCore(jobId);
      assert.equal(job.employer, employer);
      assert.equal(job.payout.toString(), payout.toString());
    });
  });

  describe("agent payout snapshots", () => {
    it("rejects ineligible agents without a payout tier", async () => {
      const payout = new BN(web3.utils.toWei("2"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);

      await nft.safeTransferFrom(agent, other, agentTokenId, { from: agent });
      await expectCustomError(
        assignJob(manager, jobId, agent, buildProof(agentTree, agent)),
        "IneligibleAgentPayout"
      );
    });

    it("snapshots agent payout percentage at apply time", async () => {
      await manager.addAGIType(nft.address, 90, { from: owner });

      const payout = new BN(web3.utils.toWei("12"));
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      const { jobId } = await createJob(manager, token, employer, payout, 1000);

      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));
      assert.equal((await manager.getJobCore(jobId))[8].toString(), "90");

      await nft.safeTransferFrom(agent, other, agentTokenId, { from: agent });

      const agentBalanceBefore = new BN(await token.balanceOf(agent));
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await manager.validateJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 });
      await time.increase(2);
      await manager.finalizeJob(jobId, { from: employer });
      const agentBalanceAfter = new BN(await token.balanceOf(agent));

      const agentBond = await computeAgentBond(manager, payout, new BN(1000));
      const expectedPayout = payout.muln(90).divn(100).add(agentBond);
      assert(agentBalanceAfter.sub(agentBalanceBefore).eq(expectedPayout));
    });

    it("allows additional agents to apply with an AGI type payout tier", async () => {
      await manager.addAdditionalAgent(other, { from: owner });
      await nft.mint(other, { from: owner });

      const payout = new BN(web3.utils.toWei("20"));
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      const { jobId } = await createJob(manager, token, employer, payout, 1000);

      await manager.applyForJob(jobId, "", [], { from: other });
      assert.equal((await manager.getJobCore(jobId))[8].toString(), "1");

      const agentBalanceBefore = new BN(await token.balanceOf(other));
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: other });
      await manager.validateJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 });
      await time.increase(2);
      await manager.finalizeJob(jobId, { from: employer });
      const agentBalanceAfter = new BN(await token.balanceOf(other));

      const agentBond = await computeAgentBond(manager, payout, new BN(1000));
      const expectedPayout = payout.muln(1).divn(100).add(agentBond);
      assert(agentBalanceAfter.sub(agentBalanceBefore).eq(expectedPayout));
    });
  });

  describe("better-only hardening", () => {
    it("reverts on non-existent job ids", async () => {
      await expectCustomError(manager.applyForJob(999, "agent", [], { from: agent }), "JobNotFound");
      await expectCustomError(manager.validateJob(999, "validator", [], { from: validator1 }), "JobNotFound");
      await expectCustomError(manager.disapproveJob(999, "validator", [], { from: validator1 }), "JobNotFound");
      await expectCustomError(manager.disputeJob(999, { from: employer }), "JobNotFound");
      await expectCustomError(manager.cancelJob(999, { from: employer }), "JobNotFound");
      await expectCustomError(manager.delistJob(999, { from: owner }), "JobNotFound");
      await expectCustomError(manager.requestJobCompletion(999, "ipfs", { from: agent }), "JobNotFound");
    });

    it("prevents double completion and double payouts", async () => {
      await nft.mint(agent, { from: owner });
      await manager.addAGIType(nft.address, 92, { from: owner });

      const payout = new BN(web3.utils.toWei("10"));
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      const { jobId } = await createJob(manager, token, employer, payout, 1000);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));

      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await manager.validateJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 });
      await time.increase(2);
      await manager.finalizeJob(jobId, { from: employer });

      await manager.addModerator(moderator, { from: owner });
      await expectCustomError(
        manager.validateJob(jobId, "validator", buildProof(validatorTree, validator2), { from: validator2 }),
        "InvalidState"
      );
      await expectCustomError(
        manager.disapproveJob(jobId, "validator", buildProof(validatorTree, validator2), { from: validator2 }),
        "InvalidState"
      );
      await expectCustomError(manager.resolveDisputeWithCode(jobId, 1, "agent win", { from: moderator }), "InvalidState");
    });

    it("blocks disputes after completion", async () => {
      await nft.mint(agent, { from: owner });
      await manager.addAGIType(nft.address, 92, { from: owner });

      const payout = new BN(web3.utils.toWei("5"));
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      const { jobId } = await createJob(manager, token, employer, payout, 1000);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await manager.validateJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 });
      await time.increase(2);
      await manager.finalizeJob(jobId, { from: employer });

      await expectCustomError(manager.disputeJob(jobId, { from: employer }), "InvalidState");
    });

    it("completes agent-win dispute without validators (no div-by-zero)", async () => {
      await nft.mint(agent, { from: owner });
      await manager.addAGIType(nft.address, 92, { from: owner });

      const payout = new BN(web3.utils.toWei("20"));
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      const { jobId } = await createJob(manager, token, employer, payout, 1000);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));

      await manager.addModerator(moderator, { from: owner });
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      const disputeBond = await fundDisputeBond(token, manager, employer, payout, owner);
      await manager.disputeJob(jobId, { from: employer });

      const agentBalanceBefore = new BN(await token.balanceOf(agent));
      await manager.resolveDisputeWithCode(jobId, 1, "agent win", { from: moderator });
      const agentBalanceAfter = new BN(await token.balanceOf(agent));

      const agentBond = await computeAgentBond(manager, payout, new BN(1000));
      const agentPayout = payout.muln(92).divn(100).add(agentBond).add(disputeBond);
      assert(agentBalanceAfter.sub(agentBalanceBefore).eq(agentPayout));
      assert.equal((await manager.nextTokenId()).toNumber(), 1);
    });

    it("enforces validator vote rules and blacklist checks", async () => {
      const payout = new BN(web3.utils.toWei("5"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);

      await expectCustomError(
        manager.validateJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 }),
        "InvalidState"
      );
      await expectCustomError(
        manager.disapproveJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 }),
        "InvalidState"
      );

      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));

      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await manager.validateJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 });
      await expectCustomError(
        manager.validateJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 }),
        "InvalidState"
      );
      await expectCustomError(
        manager.disapproveJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 }),
        "InvalidState"
      );

      await manager.blacklistValidator(validator2, true, { from: owner });
      await expectCustomError(
        manager.validateJob(jobId, "validator", buildProof(validatorTree, validator2), { from: validator2 }),
        "Blacklisted"
      );

      await manager.blacklistAgent(agent, true, { from: owner });
      const { jobId: jobId2 } = await createJob(manager, token, employer, payout, 1000, "ipfs-2");
      await expectCustomError(
        assignJob(manager, jobId2, agent, buildProof(agentTree, agent)),
        "Blacklisted"
      );
    });

    it("rejects validator proofs not in allowlist", async () => {
      const payout = new BN(web3.utils.toWei("6"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

      await expectCustomError(
        manager.validateJob(jobId, "validator", buildProof(validatorTree, other), { from: other }),
        "NotAuthorized"
      );
    });
  });

  describe("dispute resolution behavior", () => {
    it("requires proper disputant and marks disputed on disapprovals", async () => {
      const payout = new BN(web3.utils.toWei("9"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

      await expectCustomError(manager.disputeJob(jobId, { from: other }), "NotAuthorized");

      await manager.disapproveJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 });
      await manager.disapproveJob(jobId, "validator", buildProof(validatorTree, validator2), { from: validator2 });
      const receipt = await manager.disapproveJob(jobId, "validator", buildProof(validatorTree, validator3), { from: validator3 });
      expectEvent(receipt, "JobDisputed", { jobId: new BN(jobId) });

      const job = await manager.getJobCore(jobId);
      assert.equal(job.disputed, true);
    });

    it("prevents repeated disputes and limits dispute initiation to in-progress jobs", async () => {
      const payout = new BN(web3.utils.toWei("6"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

      await fundDisputeBond(token, manager, employer, payout, owner);
      await manager.disputeJob(jobId, { from: employer });
      await expectCustomError(manager.disputeJob(jobId, { from: agent }), "InvalidState");

      await manager.addModerator(moderator, { from: owner });
      await manager.resolveDisputeWithCode(jobId, 2, "employer win", { from: moderator });
      await expectCustomError(manager.disputeJob(jobId, { from: employer }), "InvalidState");
    });

    it("resolves agent win and employer win once", async () => {
      await nft.mint(agent, { from: owner });
      await manager.addAGIType(nft.address, 92, { from: owner });
      await manager.addModerator(moderator, { from: owner });

      const payout = new BN(web3.utils.toWei("30"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      const disputeBond = await fundDisputeBond(token, manager, employer, payout, owner);
      await manager.disputeJob(jobId, { from: employer });

      const agentBalanceBefore = new BN(await token.balanceOf(agent));
      const resolveReceipt = await manager.resolveDisputeWithCode(jobId, 1, "agent win", { from: moderator });
      expectEvent(resolveReceipt, "DisputeResolvedWithCode", { jobId: new BN(jobId), resolver: moderator, resolutionCode: new BN(1) });
      const agentBalanceAfter = new BN(await token.balanceOf(agent));
      const agentBond = await computeAgentBond(manager, payout, new BN(1000));
      const agentPayout = payout.muln(92).divn(100).add(agentBond).add(disputeBond);
      assert(agentBalanceAfter.sub(agentBalanceBefore).eq(agentPayout));

      await expectCustomError(manager.resolveDisputeWithCode(jobId, 1, "agent win", { from: moderator }), "InvalidState");

      const payout2 = new BN(web3.utils.toWei("40"));
      const { jobId: jobId2 } = await createJob(manager, token, employer, payout2, 1000, "ipfs-2");
      await assignJob(manager, jobId2, agent, buildProof(agentTree, agent));
      await manager.requestJobCompletion(jobId2, "ipfs-complete", { from: agent });
      const disputeBond2 = await fundDisputeBond(token, manager, employer, payout2, owner);
      await manager.disputeJob(jobId2, { from: employer });

      const employerBalanceBefore = new BN(await token.balanceOf(employer));
      await manager.resolveDisputeWithCode(jobId2, 2, "employer win", { from: moderator });
      const employerBalanceAfter = new BN(await token.balanceOf(employer));
      const agentBond2 = await computeAgentBond(manager, payout2, new BN(1000));
      assert(employerBalanceAfter.sub(employerBalanceBefore).eq(payout2.add(agentBond2).add(disputeBond2)));

      await expectCustomError(
        manager.validateJob(jobId2, "validator", buildProof(validatorTree, validator1), { from: validator1 }),
        "InvalidState"
      );
    });

    it("allows non-canonical resolutions without forcing completion", async () => {
      await manager.addModerator(moderator, { from: owner });
      const payout = new BN(web3.utils.toWei("15"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));
      await manager.requestJobCompletion(jobId, "ipfs-final", { from: agent });
      await fundDisputeBond(token, manager, agent, payout, owner);
      await manager.disputeJob(jobId, { from: agent });

      const receipt = await manager.resolveDisputeWithCode(jobId, 0, "needs-more-info", { from: moderator });
      expectEvent(receipt, "DisputeResolvedWithCode", {
        jobId: new BN(jobId),
        resolver: moderator,
        resolutionCode: new BN(0),
      });

      const job = await manager.getJobCore(jobId);
      const jobValidation = await manager.getJobValidation(jobId);
      const jobCompletionUri = await manager.getJobCompletionURI(jobId);
      assert.equal(job.disputed, true);
      assert.equal(job.completed, false);
      assert.equal(jobValidation.completionRequested, true);
      assert.equal(jobCompletionUri, "ipfs-final");
    });

    it("restricts dispute resolution to moderators", async () => {
      const payout = new BN(web3.utils.toWei("9"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      await fundDisputeBond(token, manager, employer, payout, owner);
      await manager.disputeJob(jobId, { from: employer });

      await expectCustomError(manager.resolveDisputeWithCode(jobId, 1, "agent win", { from: other }), "NotModerator");
    });
  });

  describe("checked ERC20 transfers", () => {
    it("reverts createJob when transferFrom fails", async () => {
      const failing = await FailingERC20.new({ from: owner });
      await failing.mint(employer, web3.utils.toWei("10"), { from: owner });

      const managerFailing = await AGIJobManager.new(...buildInitConfig(
          failing.address,
          baseIpfsUrl,
          ens.address,
          nameWrapper.address,
          clubRootNode,
          agentRootNode,
          alphaClubRootNode,
          alphaAgentRootNode,
          validatorRoot,
          agentRoot,
        ),
        { from: owner }
      );

      await failing.setFailTransferFroms(true, { from: owner });
      await failing.approve(managerFailing.address, web3.utils.toWei("5"), { from: employer });

      await expectCustomError(
        managerFailing.createJob("ipfs", web3.utils.toWei("5"), 1000, "details", { from: employer }),
        "TransferFailed"
      );
    });

    it("reverts payouts when transfer fails", async () => {
      const failing = await FailingERC20.new({ from: owner });
      await failing.mint(employer, web3.utils.toWei("20"), { from: owner });

      const managerFailing = await AGIJobManager.new(...buildInitConfig(
          failing.address,
          baseIpfsUrl,
          ens.address,
          nameWrapper.address,
          clubRootNode,
          agentRootNode,
          alphaClubRootNode,
          alphaAgentRootNode,
          validatorRoot,
          agentRoot,
        ),
        { from: owner }
      );

      await failing.approve(managerFailing.address, web3.utils.toWei("10"), { from: employer });
      const jobId = (await managerFailing.nextJobId()).toNumber();
      await managerFailing.createJob("ipfs", web3.utils.toWei("10"), 1000, "details", { from: employer });

      await managerFailing.addAGIType(nft.address, 92, { from: owner });
      await nft.mint(agent, { from: owner });
      await fundAgents(failing, managerFailing, [agent], owner);
      await managerFailing.applyForJob(jobId, "agent", buildProof(agentTree, agent), { from: agent });
      await managerFailing.setRequiredValidatorApprovals(1, { from: owner });
      await managerFailing.setChallengePeriodAfterApproval(1, { from: owner });

      await managerFailing.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      const bond = await computeValidatorBond(managerFailing, new BN(web3.utils.toWei("10")));
      await failing.mint(validator1, bond, { from: owner });
      await failing.approve(managerFailing.address, bond, { from: validator1 });
      await managerFailing.validateJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 });
      await failing.setFailTransfers(true, { from: owner });
      await time.increase(2);
      await expectCustomError(
        managerFailing.finalizeJob(jobId, { from: employer }),
        "TransferFailed"
      );
    });

  });

  describe("admin and configuration", () => {
    it("gates owner-only operations and updates config", async () => {
      await expectRevert.unspecified(manager.addModerator(moderator, { from: other }));
      await manager.addModerator(moderator, { from: owner });
      assert.equal(await manager.moderators(moderator), true);

      await manager.removeModerator(moderator, { from: owner });
      assert.equal(await manager.moderators(moderator), false);

      await manager.blacklistAgent(agent, true, { from: owner });
      assert.equal(await manager.blacklistedAgents(agent), true);

      await manager.blacklistValidator(validator1, true, { from: owner });
      assert.equal(await manager.blacklistedValidators(validator1), true);

      await manager.addAdditionalAgent(agent, { from: owner });
      assert.equal(await manager.additionalAgents(agent), true);

      await manager.addAdditionalValidator(validator1, { from: owner });
      assert.equal(await manager.additionalValidators(validator1), true);

      await manager.setRequiredValidatorApprovals(5, { from: owner });
      assert.equal(await manager.requiredValidatorApprovals(), "5");

      await manager.setRequiredValidatorDisapprovals(4, { from: owner });
      assert.equal(await manager.requiredValidatorDisapprovals(), "4");

      await manager.setMaxJobPayout(web3.utils.toWei("999"), { from: owner });
      assert.equal(await manager.maxJobPayout(), web3.utils.toWei("999"));

      await manager.setJobDurationLimit(12345, { from: owner });
      assert.equal(await manager.jobDurationLimit(), "12345");

      await manager.setValidationRewardPercentage(12, { from: owner });
      assert.equal(await manager.validationRewardPercentage(), "12");

      const replacementToken = await MockERC20.new({ from: owner });
      await manager.updateAGITokenAddress(replacementToken.address, { from: owner });
      assert.equal(await manager.agiToken(), replacementToken.address);
    });

    it("withdraws AGI within bounds and respects pause", async () => {
      await token.mint(manager.address, web3.utils.toWei("50"), { from: owner });
      await expectRevert.unspecified(
        manager.withdrawAGI(web3.utils.toWei("10"), { from: owner }));

      const ownerBalanceBefore = new BN(await token.balanceOf(owner));
      await manager.pause({ from: owner });
      await expectCustomError(manager.withdrawAGI(0, { from: owner }), "InvalidParameters");
      await expectCustomError(
        manager.withdrawAGI(web3.utils.toWei("100"), { from: owner }),
        "InsufficientWithdrawableBalance"
      );
      await manager.withdrawAGI(web3.utils.toWei("10"), { from: owner });
      const ownerBalanceAfter = new BN(await token.balanceOf(owner));
      assert(ownerBalanceAfter.sub(ownerBalanceBefore).eq(new BN(web3.utils.toWei("10"))));
    });

    it("updates baseIpfsUrl for future mints", async () => {
      await expectRevert.unspecified(manager.setBaseIpfsUrl("ipfs://new", { from: other }));

      await manager.setBaseIpfsUrl("ipfs://new", { from: owner });
      await nft.mint(agent, { from: owner });
      await manager.addAGIType(nft.address, 92, { from: owner });

      const payout = new BN(web3.utils.toWei("7"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000, "ipfs-6");
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      await manager.requestJobCompletion(jobId, "ipfs-6", { from: agent });
      await manager.validateJob(jobId, "validator", buildProof(validatorTree, validator1), { from: validator1 });
      await time.increase(2);
      await manager.finalizeJob(jobId, { from: employer });

      const tokenId = (await manager.nextTokenId()).subn(1);
      assert.equal(await manager.tokenURI(tokenId), "ipfs://new/ipfs-6");
    });

  });

  describe("ownership gating (ENS/Merkle)", () => {
    it("accepts merkle proofs and rejects invalid ones", async () => {
      const payout = new BN(web3.utils.toWei("5"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);

      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));

      const invalidProof = buildProof(agentTree, other);
      const { jobId: jobId2 } = await createJob(manager, token, employer, payout, 1000, "ipfs-2");
      await expectCustomError(assignJob(manager, jobId2, other, invalidProof), "NotAuthorized");
    });

    it("accepts NameWrapper ownership", async () => {
      const payout = new BN(web3.utils.toWei("6"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000, "ipfs-3");

      const subdomain = "agent-name";
      const subnode = makeSubnode(agentRootNode, subdomain);
      await nameWrapper.setOwner(web3.utils.toBN(subnode), agent, { from: owner });

      await assignJob(manager, jobId, agent, [], subdomain);
    });

    it("accepts resolver address lookup", async () => {
      const payout = new BN(web3.utils.toWei("6"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000, "ipfs-4");

      const subdomain = "validator-name";
      const subnode = makeSubnode(clubRootNode, subdomain);

      await ens.setResolver(subnode, resolver.address, { from: owner });
      await resolver.setAddr(subnode, validator4, { from: owner });

      await manager.applyForJob(jobId, "agent", buildProof(agentTree, agent), { from: agent });
      await manager.setRequiredValidatorApprovals(1, { from: owner });

      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
      const bond = await computeValidatorBond(manager, payout);
      await token.mint(validator4, bond, { from: owner });
      await token.approve(manager.address, bond, { from: validator4 });
      await manager.validateJob(jobId, subdomain, [], { from: validator4 });
    });

    it("allows additional agents and validators without proofs", async () => {
      const payout = new BN(web3.utils.toWei("4"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000, "ipfs-5");

      await manager.addAdditionalAgent(other, { from: owner });
      await manager.addAdditionalValidator(other, { from: owner });
      await nft.mint(other, { from: owner });

      await manager.applyForJob(jobId, "ignored", [], { from: other });
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      await manager.requestJobCompletion(jobId, "ipfs-complete", { from: other });
      const bond = await computeValidatorBond(manager, payout);
      await token.mint(other, bond, { from: owner });
      await token.approve(manager.address, bond, { from: other });
      await manager.validateJob(jobId, "ignored", [], { from: other });
    });
  });

  describe("timing and duration", () => {
    it("prevents completion request after duration", async () => {
      const payout = new BN(web3.utils.toWei("5"));
      const { jobId } = await createJob(manager, token, employer, payout, 10);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));

      await time.increase(20);
      await expectCustomError(manager.requestJobCompletion(jobId, "ipfs-late", { from: agent }), "InvalidState");
    });

    it("restricts completion requests to assigned agent", async () => {
      const payout = new BN(web3.utils.toWei("5"));
      const { jobId } = await createJob(manager, token, employer, payout, 1000);
      await assignJob(manager, jobId, agent, buildProof(agentTree, agent));

      await expectCustomError(
        manager.requestJobCompletion(jobId, "ipfs-late", { from: other }),
        "NotAuthorized"
      );
    });
  });

  describe("legacy transfer failure behavior", () => {
    it("reverts cancelJob if refund transfer fails", async () => {
      const payout = new BN(web3.utils.toWei("5"));
      const failTransferToken = await FailTransferToken.new({ from: owner });
      await failTransferToken.mint(employer, payout, { from: owner });

      const managerFailing = await AGIJobManager.new(...buildInitConfig(
          failTransferToken.address,
          baseIpfsUrl,
          ens.address,
          nameWrapper.address,
          clubRootNode,
          agentRootNode,
          alphaClubRootNode,
          alphaAgentRootNode,
          validatorRoot,
          agentRoot,
        ),
        { from: owner }
      );

      await failTransferToken.approve(managerFailing.address, payout, { from: employer });
      await managerFailing.createJob("ipfs", payout, 1000, "details", { from: employer });

      await expectCustomError(managerFailing.cancelJob(0, { from: employer }), "TransferFailed");
    });
  });
});
