const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager Merkle allowlist access-only", (accounts) => {
  const [owner, employer, agent, validator] = accounts;
  let token;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;

  const payout = toBN(toWei("10"));

  function buildMerkle(addrs) {
    const leafFor = (addr) => web3.utils.soliditySha3({ type: "address", value: addr });
    const leaves = addrs.map((addr) => Buffer.from(leafFor(addr).slice(2), "hex"));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    return { tree, leafFor };
  }

  async function createJob() {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const receipt = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    return receipt.logs[0].args.jobId.toNumber();
  }

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    const { tree } = buildMerkle([agent, validator]);

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
        tree.getHexRoot()
      ),
      { from: owner }
    );
    await manager.setRequiredValidatorApprovals(1, { from: owner });
  });

  it("requires AGIType payout even when allowlisted", async () => {
    const { tree, leafFor } = buildMerkle([agent, validator]);
    await manager.setAgentMerkleRoot(tree.getHexRoot(), { from: owner });
    await manager.setValidatorMerkleRoot(tree.getHexRoot(), { from: owner });

    const jobId = await createJob();
    const agentLeaf = Buffer.from(leafFor(agent).slice(2), "hex");
    await expectCustomError(
      manager.applyForJob.call(jobId, "helper", tree.getHexProof(agentLeaf), { from: agent }),
      "IneligibleAgentPayout"
    );
  });

  it("keeps payouts based on AGIType tiers, not allowlists", async () => {
    const { tree, leafFor } = buildMerkle([agent, validator]);
    await manager.setAgentMerkleRoot(tree.getHexRoot(), { from: owner });
    await manager.setValidatorMerkleRoot(tree.getHexRoot(), { from: owner });

    const agiTypeNft = await MockERC721.new({ from: owner });
    await manager.addAGIType(agiTypeNft.address, 40, { from: owner });
    await agiTypeNft.mint(agent, { from: owner });

    const jobId = await createJob();
    const agentLeaf = Buffer.from(leafFor(agent).slice(2), "hex");
    const validatorLeaf = Buffer.from(leafFor(validator).slice(2), "hex");

    await manager.applyForJob(jobId, "helper", tree.getHexProof(agentLeaf), { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    const balanceBefore = await token.balanceOf(agent);
    await manager.validateJob(jobId, "helper", tree.getHexProof(validatorLeaf), { from: validator });
    const balanceAfter = await token.balanceOf(agent);

    const expected = payout.muln(40).divn(100);
    assert.equal(balanceAfter.sub(balanceBefore).toString(), expected.toString(), "payout should match AGIType");
  });
});
