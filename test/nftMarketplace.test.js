const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");
const FailingERC20 = artifacts.require("FailingERC20");
const ReentrantERC20 = artifacts.require("ReentrantERC20");

const { rootNode, setNameWrapperOwnership } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager NFT marketplace", (accounts) => {
  const [owner, employer, agent, validator, buyer, other] = accounts;
  let token;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let clubRoot;
  let agentRoot;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    clubRoot = rootNode("club-root");
    agentRoot = rootNode("agent-root");

    manager = await AGIJobManager.new(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      clubRoot,
      agentRoot,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );

    await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator", validator);

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 92, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
  });

  async function mintJobNft() {
    const payout = toBN(toWei("40"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-finished", { from: agent });
    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    return 0;
  }

  it("lists, purchases, and delists NFTs", async () => {
    const tokenId = await mintJobNft();

    await expectCustomError(manager.listNFT.call(tokenId, 0, { from: employer }), "InvalidParameters");
    await expectCustomError(manager.listNFT.call(tokenId, 10, { from: other }), "NotAuthorized");

    await manager.listNFT(tokenId, toBN(toWei("5")), { from: employer });

    await token.mint(buyer, toBN(toWei("5")), { from: owner });
    await token.approve(manager.address, toBN(toWei("5")), { from: buyer });
    await manager.purchaseNFT(tokenId, { from: buyer });

    const newOwner = await manager.ownerOf(tokenId);
    assert.equal(newOwner, buyer, "buyer should own NFT after purchase");

    await expectCustomError(manager.delistNFT.call(tokenId, { from: buyer }), "NotAuthorized");

    const listing = await manager.listings(tokenId);
    assert.strictEqual(listing.isActive, false, "listing should be inactive after purchase");
  });

  it("reverts on transfer failures during purchase", async () => {
    const failing = await FailingERC20.new({ from: owner });
    await failing.mint(employer, toBN(toWei("40")), { from: owner });

    const managerFailing = await AGIJobManager.new(
      failing.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      clubRoot,
      agentRoot,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );
    await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator", validator);

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await managerFailing.addAGIType(agiType.address, 92, { from: owner });
    await managerFailing.setRequiredValidatorApprovals(1, { from: owner });

    await failing.approve(managerFailing.address, toBN(toWei("40")), { from: employer });
    const createTx = await managerFailing.createJob("ipfs", toBN(toWei("40")), 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await managerFailing.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await managerFailing.requestJobCompletion(jobId, "ipfs-finished", { from: agent });
    await managerFailing.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });

    await managerFailing.listNFT(0, toBN(toWei("4")), { from: employer });

    await failing.mint(buyer, toBN(toWei("4")), { from: owner });
    await failing.setFailTransferFroms(true, { from: owner });
    await failing.approve(managerFailing.address, toBN(toWei("4")), { from: buyer });
    await expectCustomError(managerFailing.purchaseNFT.call(0, { from: buyer }), "TransferFailed");
  });

  it("blocks reentrancy during NFT purchase", async () => {
    const reentrant = await ReentrantERC20.new({ from: owner });
    const managerReentrant = await AGIJobManager.new(
      reentrant.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      clubRoot,
      agentRoot,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );
    await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator", validator);

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await managerReentrant.addAGIType(agiType.address, 92, { from: owner });
    await managerReentrant.setRequiredValidatorApprovals(1, { from: owner });

    const mintJobNftWith = async () => {
      const payout = toBN(toWei("40"));
      await reentrant.mint(employer, payout, { from: owner });
      await reentrant.approve(managerReentrant.address, payout, { from: employer });
      const createTx = await managerReentrant.createJob("ipfs", payout, 1000, "details", { from: employer });
      const jobId = createTx.logs[0].args.jobId.toNumber();
      await managerReentrant.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
      await managerReentrant.requestJobCompletion(jobId, "ipfs-finished", { from: agent });
      await managerReentrant.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
      const nextTokenId = await managerReentrant.nextTokenId();
      return nextTokenId.toNumber() - 1;
    };

    const tokenIdA = await mintJobNftWith();
    const tokenIdB = await mintJobNftWith();

    const priceA = toBN(toWei("5"));
    const priceB = toBN(toWei("7"));

    await managerReentrant.listNFT(tokenIdA, priceA, { from: employer });
    await managerReentrant.listNFT(tokenIdB, priceB, { from: employer });

    await reentrant.mint(buyer, priceA, { from: owner });
    await reentrant.approve(managerReentrant.address, priceA, { from: buyer });

    await reentrant.mint(reentrant.address, priceB, { from: owner });
    await reentrant.setReentry(managerReentrant.address, tokenIdB, true, { from: owner });
    await reentrant.approveManager(priceB, { from: owner });

    await managerReentrant.purchaseNFT(tokenIdA, { from: buyer });

    const reenterAttempted = await reentrant.reenterAttempted();
    assert.strictEqual(reenterAttempted, true, "reentrant call should have been attempted");

    const reentrancyBlocked = await reentrant.reentrancyBlocked();
    assert.strictEqual(reentrancyBlocked, true, "reentrant call should be blocked");

    const ownerB = await managerReentrant.ownerOf(tokenIdB);
    assert.equal(ownerB, employer, "tokenIdB should remain with seller");

    const listingB = await managerReentrant.listings(tokenIdB);
    assert.strictEqual(listingB.isActive, true, "tokenIdB listing should remain active");
  });
});
