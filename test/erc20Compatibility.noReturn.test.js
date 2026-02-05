const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const ERC20NoReturn = artifacts.require("ERC20NoReturn");
const MockENS = artifacts.require("MockENS");
const MockERC721 = artifacts.require("MockERC721");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { rootNode } = require("./helpers/ens");
const { buildInitConfig } = require("./helpers/deploy");
const { fundValidators } = require("./helpers/bonds");
const { expectRevert } = require("@openzeppelin/test-helpers");

const ZERO_ROOT = "0x" + "00".repeat(32);

contract("AGIJobManager ERC20 compatibility", (accounts) => {
  const [owner, employer, agent, validator, buyer] = accounts;
  let token;
  let manager;

  beforeEach(async () => {
    token = await ERC20NoReturn.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        rootNode("club-root"),
        rootNode("agent-root"),
        rootNode("club-root"),
        rootNode("agent-root"),
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 60, { from: owner });

    await fundValidators(token, manager, [validator], owner);
  });

  it("accepts ERC20 tokens that return no data on transfer/transferFrom", async () => {
    const payout = web3.utils.toWei("25");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.cancelJob(jobId, { from: employer });

    const employerBalance = await token.balanceOf(employer);
    assert.equal(employerBalance.toString(), payout.toString(), "employer should be refunded");
  });

  it("supports NFT marketplace transfers when the token returns no data", async () => {
    const payout = web3.utils.toWei("50");
    const price = web3.utils.toWei("12");

    await token.mint(employer, payout, { from: owner });
    await token.mint(buyer, price, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await token.approve(manager.address, price, { from: buyer });

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });

    const createTx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "", [], { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    const validateTx = await manager.validateJob(jobId, "", [], { from: validator });
    const nftIssued = validateTx.logs.find((log) => log.event === "NFTIssued");
    const tokenId = nftIssued.args.tokenId.toNumber();

    await manager.listNFT(tokenId, price, { from: employer });
    await manager.purchaseNFT(tokenId, { from: buyer });

    const newOwner = await manager.ownerOf(tokenId);
    assert.equal(newOwner, buyer, "buyer should own the NFT");

    const employerBalance = await token.balanceOf(employer);
    assert.equal(employerBalance.toString(), price.toString(), "seller should receive payment");
  });

  it("reverts with TransferFailed when transferFrom cannot be completed", async () => {
    const payout = web3.utils.toWei("10");
    await token.mint(employer, payout, { from: owner });

    await expectRevert.unspecified(
      manager.createJob("ipfs-job", payout, 3600, "details", { from: employer })
    );
  });
});
