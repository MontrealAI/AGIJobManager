const assert = require("assert");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { rootNode } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");

const { toBN, toWei } = web3.utils;

function leafFor(address) {
  return Buffer.from(web3.utils.soliditySha3({ type: "address", value: address }).slice(2), "hex");
}

function buildMerkle(addresses) {
  const leaves = addresses.map(leafFor);
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return {
    root: tree.getHexRoot(),
    proofFor: (addr) => tree.getHexProof(leafFor(addr)),
  };
}

contract("AGIJobManager agent payout snapshots", (accounts) => {
  const [owner, employer, agent, validator, other] = accounts;
  let token;
  let ens;
  let nameWrapper;
  let manager;
  let agentMerkle;
  let validatorMerkle;

  const payout = toBN(toWei("100"));

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    agentMerkle = buildMerkle([agent]);
    validatorMerkle = buildMerkle([validator]);

    manager = await AGIJobManager.new(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      rootNode("club-root"),
      rootNode("agent-root"),
      validatorMerkle.root,
      agentMerkle.root,
      { from: owner }
    );

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });
  });

  async function createJob() {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    return tx.logs[0].args.jobId.toNumber();
  }

  it("rejects agents with a 0% payout tier", async () => {
    const jobId = await createJob();

    await expectCustomError(
      manager.applyForJob.call(jobId, "agent", agentMerkle.proofFor(agent), { from: agent }),
      "IneligibleAgentPayout"
    );
  });

  it("uses the snapshot even if the agent sells their AGI-type after assignment", async () => {
    const jobId = await createJob();
    const agiTypeLow = await MockERC721.new({ from: owner });
    const agiTypeHigh = await MockERC721.new({ from: owner });

    await manager.addAGIType(agiTypeLow.address, 25, { from: owner });
    await manager.addAGIType(agiTypeHigh.address, 75, { from: owner });

    const mintTx = await agiTypeHigh.mint(agent, { from: owner });
    const highTokenId = mintTx.logs.find((log) => log.event === \"Transfer\").args.tokenId.toNumber();

    await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });

    await agiTypeHigh.transferFrom(agent, other, highTokenId, { from: agent });

    const balanceBefore = await token.balanceOf(agent);
    await manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator });
    const balanceAfter = await token.balanceOf(agent);

    const expectedPayout = payout.muln(75).divn(100);
    assert.equal(balanceAfter.sub(balanceBefore).toString(), expectedPayout.toString());
  });

  it("ignores post-assignment upgrades to a higher AGI-type tier", async () => {
    const jobId = await createJob();
    const agiTypeLow = await MockERC721.new({ from: owner });
    const agiTypeHigh = await MockERC721.new({ from: owner });

    await manager.addAGIType(agiTypeLow.address, 25, { from: owner });
    await manager.addAGIType(agiTypeHigh.address, 75, { from: owner });

    await agiTypeLow.mint(agent, { from: owner });
    await manager.applyForJob(jobId, "agent", agentMerkle.proofFor(agent), { from: agent });

    await agiTypeHigh.mint(agent, { from: owner });

    const balanceBefore = await token.balanceOf(agent);
    await manager.validateJob(jobId, "validator", validatorMerkle.proofFor(validator), { from: validator });
    const balanceAfter = await token.balanceOf(agent);

    const expectedPayout = payout.muln(25).divn(100);
    assert.equal(balanceAfter.sub(balanceBefore).toString(), expectedPayout.toString());
  });

  it("pays additionalAgents using the configured nonzero default tier", async () => {
    const jobId = await createJob();

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.setAdditionalAgentPayoutPercentage(50, { from: owner });

    await manager.applyForJob(jobId, "agent", [], { from: agent });

    const balanceBefore = await token.balanceOf(agent);
    await manager.validateJob(jobId, "validator", [], { from: validator });
    const balanceAfter = await token.balanceOf(agent);

    const expectedPayout = payout.muln(50).divn(100);
    assert.equal(balanceAfter.sub(balanceBefore).toString(), expectedPayout.toString());
  });
});
