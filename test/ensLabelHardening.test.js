const assert = require("assert");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const AGIJobManager = artifacts.require("AGIJobManager");
const EnsLabelUtilsHarness = artifacts.require("EnsLabelUtilsHarness");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");
const RevertingENSRegistry = artifacts.require("RevertingENSRegistry");
const RevertingNameWrapper = artifacts.require("RevertingNameWrapper");

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
      for (const label of ["alice", "a", "a-1", "0", "abc123"]) {
        await harness.check(label);
      }

      const sixtyThree = "a".repeat(63);
      await harness.check(sixtyThree);

      const sixtyFour = "a".repeat(64);
      await expectCustomError(harness.check(sixtyFour), "InvalidENSLabel");
    });

    it("rejects invalid labels", async () => {
      for (const label of ["alice.bob", "", "A", "a_b", "-a", "a-", ".", "..", "a..b", "a b", "\n"]) {
        await expectCustomError(harness.check(label), "InvalidENSLabel");
      }
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
      const revertingEns = await RevertingENSRegistry.new({ from: owner });
      const revertingWrapper = await RevertingNameWrapper.new({ from: owner });
      await revertingEns.setRevertResolver(true, { from: owner });
      await revertingWrapper.setRevertOwnerOf(true, { from: owner });
      await manager.updateEnsRegistry(revertingEns.address, { from: owner });
      await manager.updateNameWrapper(revertingWrapper.address, { from: owner });

      const leaf = leafFor(agent);
      await manager.updateMerkleRoots(ZERO_ROOT, leaf, { from: owner });

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await manager.applyForJob(jobId, "", [], { from: agent });
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

    it("reverts with InvalidENSLabel before ENS staticcalls when ENS path is attempted", async () => {
      const revertingEns = await RevertingENSRegistry.new({ from: owner });
      const revertingWrapper = await RevertingNameWrapper.new({ from: owner });
      await revertingEns.setRevertResolver(true, { from: owner });
      await revertingWrapper.setRevertOwnerOf(true, { from: owner });

      const strictManager = await AGIJobManager.new(
        ...buildInitConfig(
          token.address,
          "ipfs://base",
          revertingEns.address,
          revertingWrapper.address,
          web3.utils.soliditySha3("club"),
          web3.utils.soliditySha3("agent"),
          web3.utils.soliditySha3("alpha-club"),
          web3.utils.soliditySha3("alpha-agent"),
          ZERO_ROOT,
          ZERO_ROOT,
        ),
        { from: owner },
      );

      await token.approve(strictManager.address, payout, { from: employer });
      const createReceipt = await strictManager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await expectCustomError(strictManager.applyForJob.call(jobId, "alice.bob", [], { from: outsider }), "InvalidENSLabel");
    });

    it("reverts with InvalidENSLabel for validator ENS path before ENS staticcalls", async () => {
      const revertingEns = await RevertingENSRegistry.new({ from: owner });
      const revertingWrapper = await RevertingNameWrapper.new({ from: owner });
      await revertingEns.setRevertResolver(true, { from: owner });
      await revertingWrapper.setRevertOwnerOf(true, { from: owner });

      const strictManager = await AGIJobManager.new(
        ...buildInitConfig(
          token.address,
          "ipfs://base",
          revertingEns.address,
          revertingWrapper.address,
          web3.utils.soliditySha3("club"),
          web3.utils.soliditySha3("agent"),
          web3.utils.soliditySha3("alpha-club"),
          web3.utils.soliditySha3("alpha-agent"),
          ZERO_ROOT,
          ZERO_ROOT,
        ),
        { from: owner },
      );

      await strictManager.addAdditionalAgent(agent, { from: owner });
      const strictAgiType = await MockERC721.new({ from: owner });
      await strictAgiType.mint(agent, { from: owner });
      await strictManager.addAGIType(strictAgiType.address, 50, { from: owner });
      await token.approve(strictManager.address, payout, { from: employer });
      await token.approve(strictManager.address, web3.utils.toWei("100"), { from: agent });

      const createReceipt = await strictManager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();
      await strictManager.applyForJob(jobId, "", [], { from: agent });
      await strictManager.requestJobCompletion(jobId, "ipfs-completion", { from: agent });

      await expectCustomError(strictManager.validateJob.call(jobId, "alice.bob", [], { from: validator }), "InvalidENSLabel");
    });
  });

  describe("deterministic routing regressions", () => {
    let token;
    let manager;

    const payout = web3.utils.toWei("10");

    beforeEach(async () => {
      token = await MockERC20.new({ from: owner });

      manager = await AGIJobManager.new(
        ...buildInitConfig(
          token.address,
          "ipfs://base",
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          ZERO_ROOT,
          ZERO_ROOT,
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

    it("allows Merkle-authorized agent applyForJob with empty subdomain", async () => {
      const agentLeaf = leafFor(agent);
      await manager.updateMerkleRoots(ZERO_ROOT, agentLeaf, { from: owner });

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await manager.applyForJob(jobId, "", [], { from: agent });
      const job = await manager.getJobCore(jobId);
      assert.equal(job.assignedAgent, agent, "agent should be assigned via Merkle auth");
    });

    it("allows Merkle-authorized validator validateJob with empty subdomain", async () => {
      const agentLeaf = leafFor(agent);
      const validatorLeaf = leafFor(validator);
      await manager.updateMerkleRoots(validatorLeaf, agentLeaf, { from: owner });

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await manager.applyForJob(jobId, "", [], { from: agent });
      await manager.requestJobCompletion(jobId, "ipfs-completion", { from: agent });
      await manager.validateJob(jobId, "", [], { from: validator });

      const validation = await manager.getJobValidation(jobId);
      assert.equal(validation.validatorApprovals.toString(), "1", "validator vote should be recorded");
    });


    it("uses ENS verification path for syntactically-valid labels", async () => {
      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await expectCustomError(manager.applyForJob.call(jobId, "alice", [], { from: outsider }), "NotAuthorized");
    });

    it("reverts with InvalidENSLabel (not NotAuthorized) on ENS path for invalid label", async () => {
      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await expectCustomError(manager.applyForJob.call(jobId, "alice.bob", [], { from: outsider }), "InvalidENSLabel");
    });
  });
});
