const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const EnsLabelUtilsHarness = artifacts.require("EnsLabelUtilsHarness");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);

function singleLeafRoot(account) {
  return web3.utils.soliditySha3({ type: "address", value: account });
}

contract("ENS label and auth routing deterministic regressions", (accounts) => {
  const [owner, employer, agent, validator, outsider] = accounts;

  describe("EnsLabelUtils.requireValidLabel", () => {
    let harness;

    beforeEach(async () => {
      harness = await EnsLabelUtilsHarness.new({ from: owner });
    });

    it('accepts "alice"', async () => {
      await harness.check("alice");
    });

    it("reverts with InvalidENSLabel for known invalid labels", async () => {
      const invalidLabels = ["alice.bob", "", "A", "a_b", "-a", "a-", "a".repeat(64)];
      for (const label of invalidLabels) {
        await expectCustomError(harness.check(label), "InvalidENSLabel");
      }
    });
  });

  describe("Option A auth routing", () => {
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

    it("allows Merkle-authorized agent to applyForJob with empty subdomain", async () => {
      await manager.updateMerkleRoots(ZERO_ROOT, singleLeafRoot(agent), { from: owner });

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await manager.applyForJob(jobId, "", [], { from: agent });

      const job = await manager.getJobCore(jobId);
      assert.equal(job.assignedAgent, agent, "agent should be assigned through Merkle auth");
    });

    it("allows Merkle-authorized validator to validateJob with empty subdomain", async () => {
      await manager.updateMerkleRoots(singleLeafRoot(validator), singleLeafRoot(agent), { from: owner });

      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await manager.applyForJob(jobId, "", [], { from: agent });
      await manager.requestJobCompletion(jobId, "ipfs-completion", { from: agent });
      await manager.validateJob(jobId, "", [], { from: validator });

      const validation = await manager.getJobValidation(jobId);
      assert.equal(validation.validatorApprovals.toString(), "1", "validator Merkle vote should be recorded");
    });

    it("reverts with InvalidENSLabel (not NotAuthorized) for invalid ENS label on ENS path", async () => {
      const createReceipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
      const jobId = createReceipt.logs[0].args.jobId.toNumber();

      await expectCustomError(manager.applyForJob.call(jobId, "alice.bob", [], { from: outsider }), "InvalidENSLabel");
    });
  });
});
