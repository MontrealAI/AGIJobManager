const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const EnsLabelUtilsHarness = artifacts.require("EnsLabelUtilsHarness");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];

function merkleRootFor(addr) {
  return web3.utils.soliditySha3({ type: "address", value: addr });
}

contract("ENS label hardening", (accounts) => {
  const [owner, employer, agent, validator, outsider] = accounts;

  describe("EnsLabelUtils.requireValidLabel", () => {
    let harness;

    beforeEach(async () => {
      harness = await EnsLabelUtilsHarness.new({ from: owner });
    });

    it("accepts alice", async () => {
      await harness.check("alice");
    });

    it("rejects invalid ENS labels", async () => {
      await expectCustomError(harness.check("alice.bob"), "InvalidENSLabel");
      await expectCustomError(harness.check(""), "InvalidENSLabel");
      await expectCustomError(harness.check("A"), "InvalidENSLabel");
      await expectCustomError(harness.check("a_b"), "InvalidENSLabel");
      await expectCustomError(harness.check("-a"), "InvalidENSLabel");
      await expectCustomError(harness.check("a-"), "InvalidENSLabel");
      await expectCustomError(harness.check("a".repeat(64)), "InvalidENSLabel");
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
      await manager.updateMerkleRoots(ZERO_ROOT, merkleRootFor(agent), { from: owner });

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
      const job = await manager.getJobCore(jobId);
      assert.equal(job.assignedAgent, agent, "agent should be assigned via Merkle proof");
    });

    it("allows Merkle-authorized validator validateJob with empty subdomain", async () => {
      await manager.updateMerkleRoots(merkleRootFor(validator), merkleRootFor(agent), { from: owner });

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
      await manager.requestJobCompletion(jobId, "ipfs-completion", { from: agent });
      await manager.validateJob(jobId, "", EMPTY_PROOF, { from: validator });

      const validation = await manager.getJobValidation(jobId);
      assert.equal(validation.validatorApprovals.toString(), "1", "validator vote should be recorded via Merkle proof");
    });

    it("reverts with InvalidENSLabel (not NotAuthorized) for non-allowlisted/non-merkle applyForJob", async () => {
      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await expectCustomError(manager.applyForJob.call(jobId, "alice.bob", EMPTY_PROOF, { from: outsider }), "InvalidENSLabel");
    });
  });
});
