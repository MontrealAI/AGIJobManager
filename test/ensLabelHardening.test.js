const assert = require("assert");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const AGIJobManager = artifacts.require("AGIJobManager");
const EnsLabelUtilsHarness = artifacts.require("EnsLabelUtilsHarness");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);

function leafFor(addr) {
  return web3.utils.soliditySha3({ type: "address", value: addr });
}

contract("ENS label hardening", (accounts) => {
  const [owner, employer, agent, validator, outsider] = accounts;

  describe("EnsLabelUtils.requireValidLabel", () => {
    let harness;

    beforeEach(async () => {
      harness = await EnsLabelUtilsHarness.new({ from: owner });
    });

    it("accepts valid labels and enforces boundary lengths", async () => {
      await harness.check("alice");

      const sixtyThree = "a".repeat(63);
      await harness.check(sixtyThree);

      const sixtyFour = "a".repeat(64);
      await expectCustomError(harness.check(sixtyFour), "InvalidENSLabel");
    });

    it("rejects invalid labels", async () => {
      await expectCustomError(harness.check("alice.bob"), "InvalidENSLabel");
      await expectCustomError(harness.check(""), "InvalidENSLabel");
      await expectCustomError(harness.check("A"), "InvalidENSLabel");
      await expectCustomError(harness.check("a_b"), "InvalidENSLabel");
      await expectCustomError(harness.check("-a"), "InvalidENSLabel");
      await expectCustomError(harness.check("a-"), "InvalidENSLabel");
    });
  });

  describe("AGIJobManager integration routing", () => {
    let token;
    let manager;

    const payout = web3.utils.toWei("10");

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
          web3.utils.soliditySha3("club"),
          web3.utils.soliditySha3("agent"),
          ZERO_ROOT,
          ZERO_ROOT,
          ZERO_ROOT,
          ZERO_ROOT,
        ),
        { from: owner },
      );

      await token.mint(employer, payout, { from: owner });
      await token.approve(manager.address, payout, { from: employer });
      await token.mint(agent, web3.utils.toWei("100"), { from: owner });
      await token.approve(manager.address, web3.utils.toWei("100"), { from: agent });
      await token.mint(validator, web3.utils.toWei("100"), { from: owner });
      await token.approve(manager.address, web3.utils.toWei("100"), { from: validator });

      const agiType = await MockERC721.new({ from: owner });
      await agiType.mint(agent, { from: owner });
      await manager.addAGIType(agiType.address, 50, { from: owner });
    });

    it("keeps Merkle allowlist authorization working with empty subdomain", async () => {
      const leaf = Buffer.from(leafFor(agent).slice(2), "hex");
      const tree = new MerkleTree([leaf], keccak256, { sortPairs: true });
      await manager.updateMerkleRoots(ZERO_ROOT, tree.getHexRoot(), { from: owner });

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await manager.applyForJob(jobId, "", tree.getHexProof(leaf), { from: agent });
      const job = await manager.getJobCore(jobId);
      assert.equal(job.assignedAgent, agent, "agent should be assigned via Merkle proof");
    });

    it("keeps additionalAgents authorization working with invalid subdomain", async () => {
      await manager.addAdditionalAgent(agent, { from: owner });

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await manager.applyForJob(jobId, "", [], { from: agent });
      const job = await manager.getJobCore(jobId);
      assert.equal(job.assignedAgent, agent, "agent should be assigned via additional allowlist");
    });

    it("keeps validator Merkle authorization working with empty subdomain", async () => {
      const agentLeaf = Buffer.from(leafFor(agent).slice(2), "hex");
      const validatorLeaf = Buffer.from(leafFor(validator).slice(2), "hex");
      const agentTree = new MerkleTree([agentLeaf], keccak256, { sortPairs: true });
      const validatorTree = new MerkleTree([validatorLeaf], keccak256, { sortPairs: true });
      await manager.updateMerkleRoots(validatorTree.getHexRoot(), agentTree.getHexRoot(), { from: owner });

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await manager.applyForJob(jobId, "", agentTree.getHexProof(agentLeaf), { from: agent });
      await manager.requestJobCompletion(jobId, "ipfs-completion", { from: agent });
      await manager.validateJob(jobId, "", validatorTree.getHexProof(validatorLeaf), { from: validator });

      const validation = await manager.getJobValidation(jobId);
      assert.equal(validation.validatorApprovals.toString(), "1", "validator vote should be recorded via Merkle proof");
    });

    it("keeps additionalValidators authorization working with invalid subdomain", async () => {
      await manager.addAdditionalAgent(agent, { from: owner });
      await manager.addAdditionalValidator(validator, { from: owner });

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await manager.applyForJob(jobId, "", [], { from: agent });
      await manager.requestJobCompletion(jobId, "ipfs-completion", { from: agent });
      await manager.disapproveJob(jobId, "alice.bob", [], { from: validator });

      const validation = await manager.getJobValidation(jobId);
      assert.equal(validation.validatorDisapprovals.toString(), "1", "validator vote should be recorded via additional allowlist");
    });

    it("reverts with InvalidENSLabel when ENS path is attempted with multi-label input", async () => {
      await manager.updateRootNodes(
        web3.utils.soliditySha3("club"),
        web3.utils.soliditySha3("agent"),
        web3.utils.soliditySha3("alpha-club"),
        web3.utils.soliditySha3("alpha-agent"),
        { from: owner },
      );

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await expectCustomError(manager.applyForJob.call(jobId, "alice.bob", [], { from: outsider }), "InvalidENSLabel");
    });
  });
});
