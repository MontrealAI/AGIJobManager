const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const EnsLabelUtilsHarness = artifacts.require("EnsLabelUtilsHarness");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");
const { fundAgents, fundValidators } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const { toWei } = web3.utils;

function leafFor(addr) {
  return Buffer.from(web3.utils.soliditySha3({ type: "address", value: addr }).slice(2), "hex");
}

contract("EnsLabelUtils + ENS routing hardening", (accounts) => {
  const [owner, employer, agent, validator, outsider] = accounts;
  const payout = toWei("10");
  const duration = 3600;

  let harness;

  beforeEach(async () => {
    harness = await EnsLabelUtilsHarness.new({ from: owner });
  });

  it("accepts a valid lowercase single label", async () => {
    await harness.check("alice");
  });

  it("rejects invalid labels and enforces 63-byte boundary", async () => {
    await expectCustomError(harness.check("alice.bob"), "InvalidENSLabel");
    await expectCustomError(harness.check(""), "InvalidENSLabel");
    await expectCustomError(harness.check("A"), "InvalidENSLabel");
    await expectCustomError(harness.check("a_b"), "InvalidENSLabel");
    await expectCustomError(harness.check("-a"), "InvalidENSLabel");
    await expectCustomError(harness.check("a-"), "InvalidENSLabel");

    await harness.check("a".repeat(63));
    await expectCustomError(harness.check("a".repeat(64)), "InvalidENSLabel");
  });

  it("skips label validation for merkle-authorized applyForJob", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const nft = await MockERC721.new({ from: owner });

    const tree = new MerkleTree([leafFor(agent)], keccak256, { sortPairs: true });
    const manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        web3.utils.keccak256("club"),
        web3.utils.keccak256("agent"),
        web3.utils.keccak256("alphaclub"),
        web3.utils.keccak256("alphaagent"),
        ZERO_ROOT,
        tree.getHexRoot(),
      ),
      { from: owner },
    );

    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs-job", payout, duration, "details", { from: employer });

    await nft.mint(agent, { from: owner });
    await manager.addAGIType(nft.address, 60, { from: owner });
    await fundAgents(token, manager, [agent], owner);

    const receipt = await manager.applyForJob(0, "", [], { from: agent });
    assert.equal(receipt.logs[0].event, "JobApplied");
    assert.equal(receipt.logs[0].args.agent, agent);
  });

  it("skips label validation for additional validator authorization", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const nft = await MockERC721.new({ from: owner });

    const manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        web3.utils.keccak256("club"),
        web3.utils.keccak256("agent"),
        web3.utils.keccak256("alphaclub"),
        web3.utils.keccak256("alphaagent"),
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner },
    );

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });

    await nft.mint(agent, { from: owner });
    await manager.addAGIType(nft.address, 60, { from: owner });

    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs-job", payout, duration, "details", { from: employer });

    await fundAgents(token, manager, [agent], owner);
    await fundValidators(token, manager, [validator], owner);

    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "ipfs://done", { from: agent });

    const receipt = await manager.validateJob(0, "", [], { from: validator });
    assert.equal(receipt.logs[0].event, "JobValidated");
    assert.equal(receipt.logs[0].args.validator, validator);
  });

  it("reverts with InvalidENSLabel when ENS path is attempted", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const nft = await MockERC721.new({ from: owner });

    const manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        web3.utils.keccak256("club"),
        web3.utils.keccak256("agent"),
        web3.utils.keccak256("alphaclub"),
        web3.utils.keccak256("alphaagent"),
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner },
    );

    await nft.mint(outsider, { from: owner });
    await manager.addAGIType(nft.address, 60, { from: owner });

    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs-job", payout, duration, "details", { from: employer });

    await fundAgents(token, manager, [outsider], owner);

    await expectCustomError(manager.applyForJob.call(0, "alice.bob", [], { from: outsider }), "InvalidENSLabel");
  });
});
