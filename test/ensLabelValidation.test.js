const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");
const EnsLabelUtilsHarness = artifacts.require("EnsLabelUtilsHarness");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");
const { fundAgents } = require("./helpers/bonds");

const { toBN, toWei } = web3.utils;

const ZERO_ROOT = "0x" + "00".repeat(32);
const NON_ZERO_ROOT = web3.utils.soliditySha3("agent-root");
const EMPTY_PROOF = [];

contract("ENS label hardening", (accounts) => {
  const [owner, employer, agent, outsider] = accounts;
  const payout = toBN(toWei("10"));

  const leafFor = (addr) => web3.utils.soliditySha3({ type: "address", value: addr });

  describe("EnsLabelUtils.requireValidLabel", () => {
    let harness;

    beforeEach(async () => {
      harness = await EnsLabelUtilsHarness.new({ from: owner });
    });

    it("accepts a valid single label", async () => {
      await harness.check.call("alice", { from: owner });
    });

    it("rejects invalid labels", async () => {
      await expectCustomError(harness.check.call("alice.bob", { from: owner }), "InvalidENSLabel");
      await expectCustomError(harness.check.call("", { from: owner }), "InvalidENSLabel");
      await expectCustomError(harness.check.call("A", { from: owner }), "InvalidENSLabel");
      await expectCustomError(harness.check.call("a_b", { from: owner }), "InvalidENSLabel");
      await expectCustomError(harness.check.call("-a", { from: owner }), "InvalidENSLabel");
      await expectCustomError(harness.check.call("a-", { from: owner }), "InvalidENSLabel");
    });

    it("enforces 63-byte maximum length", async () => {
      await harness.check.call("a".repeat(63), { from: owner });
      await expectCustomError(harness.check.call("a".repeat(64), { from: owner }), "InvalidENSLabel");
    });
  });

  describe("AGIJobManager authorization routing", () => {
    let token;
    let manager;

    beforeEach(async () => {
      token = await MockERC20.new({ from: owner });
      const ens = await MockENS.new({ from: owner });
      const nameWrapper = await MockNameWrapper.new({ from: owner });
      const agiType = await MockERC721.new({ from: owner });

      manager = await AGIJobManager.new(
        ...buildInitConfig(
          token.address,
          "ipfs://base",
          ens.address,
          nameWrapper.address,
          ZERO_ROOT,
          NON_ZERO_ROOT,
          ZERO_ROOT,
          ZERO_ROOT,
          ZERO_ROOT,
          leafFor(agent),
        ),
        { from: owner },
      );

      await manager.addAGIType(agiType.address, 50, { from: owner });
      await agiType.mint(agent, { from: owner });
      await agiType.mint(outsider, { from: owner });

      await token.mint(employer, payout, { from: owner });
      await token.approve(manager.address, payout, { from: employer });
      await fundAgents(token, manager, [agent, outsider], owner);
    });

    it("keeps Merkle authorization compatible with empty subdomain", async () => {
      const jobId = (await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer }))
        .logs[0]
        .args.jobId.toNumber();

      await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });

      const jobCore = await manager.getJobCore(jobId);
      assert.equal(jobCore.assignedAgent, agent, "agent should be assigned via Merkle path even with empty label");
    });

    it("keeps additional allowlist authorization compatible with invalid subdomain", async () => {
      const jobId = (await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer }))
        .logs[0]
        .args.jobId.toNumber();

      await manager.addAdditionalAgent(agent, { from: owner });
      await manager.applyForJob(jobId, "alice.bob", EMPTY_PROOF, { from: agent });

      const jobCore = await manager.getJobCore(jobId);
      assert.equal(jobCore.assignedAgent, agent, "agent should be assigned via additional allowlist with invalid label");
    });

    it("reverts with InvalidENSLabel when ENS path is attempted with invalid label", async () => {
      const jobId = (await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer }))
        .logs[0]
        .args.jobId.toNumber();

      await expectCustomError(
        manager.applyForJob.call(jobId, "alice.bob", EMPTY_PROOF, { from: outsider }),
        "InvalidENSLabel",
      );
    });
  });
});
