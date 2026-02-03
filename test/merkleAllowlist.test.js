const assert = require("assert");

const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const { toBN, toWei } = web3.utils;

contract("AGIJobManager Merkle allowlists", (accounts) => {
  const [owner, employer, agent, validator] = accounts;
  let token;
  let manager;
  let tree;

  const payout = toBN(toWei("10"));

  const leafFor = (addr) => web3.utils.soliditySha3({ type: "address", value: addr });

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    await MockResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    const leaves = [agent, validator].map((addr) => Buffer.from(leafFor(addr).slice(2), "hex"));
    tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

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
        tree.getHexRoot(),
        tree.getHexRoot(),
      ),
      { from: owner },
    );

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
  });

  it("keeps allowlists as access-only (no payout boost)", async () => {
    const jobId = (await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer }))
      .logs[0]
      .args.jobId.toNumber();

    const agentLeaf = Buffer.from(leafFor(agent).slice(2), "hex");
    await expectCustomError(
      manager.applyForJob.call(jobId, "ignored", tree.getHexProof(agentLeaf), { from: agent }),
      "IneligibleAgentPayout"
    );
  });

  it("pays allowlisted agents based on AGIType payout tiers", async () => {
    const payoutTier = 60;
    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, payoutTier, { from: owner });

    const jobId = (await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer }))
      .logs[0]
      .args.jobId.toNumber();

    const agentLeaf = Buffer.from(leafFor(agent).slice(2), "hex");
    const validatorLeaf = Buffer.from(leafFor(validator).slice(2), "hex");

    await manager.applyForJob(jobId, "ignored", tree.getHexProof(agentLeaf), { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    const before = await token.balanceOf(agent);
    await manager.validateJob(jobId, "ignored", tree.getHexProof(validatorLeaf), { from: validator });
    const after = await token.balanceOf(agent);

    const expected = payout.muln(payoutTier).divn(100);
    assert.equal(after.sub(before).toString(), expected.toString(), "payout should match AGIType tier");
  });
});
