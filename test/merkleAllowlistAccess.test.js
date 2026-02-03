const assert = require("assert");

const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const ZERO_ROOT = "0x" + "00".repeat(32);
const { toBN, toWei } = web3.utils;

contract("AGIJobManager Merkle allowlist access", (accounts) => {
  const [owner, employer, agent, allowlistedNoNft] = accounts;
  let token;
  let ens;
  let nameWrapper;
  let manager;
  let agiTypeNft;
  let merkleTree;
  let agentLeaf;
  let noNftLeaf;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });
    agiTypeNft = await MockERC721.new({ from: owner });

    const leafFor = (addr) => web3.utils.soliditySha3({ type: "address", value: addr });
    const leaves = [agent, allowlistedNoNft].map((addr) => Buffer.from(leafFor(addr).slice(2), "hex"));
    merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    agentLeaf = Buffer.from(leafFor(agent).slice(2), "hex");
    noNftLeaf = Buffer.from(leafFor(allowlistedNoNft).slice(2), "hex");

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
        merkleTree.getHexRoot(),
      ),
      { from: owner },
    );

    await manager.addAGIType(agiTypeNft.address, 42, { from: owner });
    await agiTypeNft.mint(agent, { from: owner });
  });

  async function createJob() {
    const payout = toBN(toWei("2"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    return tx.logs[0].args.jobId.toNumber();
  }

  it("accepts Merkle allowlist access but keeps payout tied to AGIType ownership", async () => {
    const jobId = await createJob();
    await manager.applyForJob(jobId, "allowlisted", merkleTree.getHexProof(agentLeaf), { from: agent });

    const payoutPct = await manager.getJobAgentPayoutPct(jobId);
    assert.equal(payoutPct.toString(), "42", "payout snapshot should match AGIType payout percentage");

    const jobIdTwo = await createJob();
    await expectCustomError(
      manager.applyForJob.call(jobIdTwo, "allowlisted", merkleTree.getHexProof(noNftLeaf), { from: allowlistedNoNft }),
      "IneligibleAgentPayout",
    );
  });
});
