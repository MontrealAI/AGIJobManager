const assert = require("assert");
const { expectRevert } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");
const FailingERC20 = artifacts.require("FailingERC20");
const ReentrantERC20 = artifacts.require("ReentrantERC20");
const NonReceiverBuyer = artifacts.require("NonReceiverBuyer");
const ERC721ReceiverBuyer = artifacts.require("ERC721ReceiverBuyer");

const { rootNode, setNameWrapperOwnership } = require("./helpers/ens");
const { expectCustomError, extractRevertData, selectorFor } = require("./helpers/errors");

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

  async function expectPausedRevert(promise, callFn, pauseController) {
    try {
      await promise;
    } catch (error) {
      if (error?.message?.includes("Pausable: paused")) {
        return;
      }
      const data = extractRevertData(error);
      if (data) {
        const selector = selectorFor("EnforcedPause").toLowerCase();
        if (data.toLowerCase().startsWith(selector)) {
          return;
        }
      }
      if (callFn) {
        await expectRevert.unspecified(callFn());
        const paused = await manager.paused();
        if (!paused) {
          throw error;
        }
        if (pauseController) {
          await manager.unpause({ from: pauseController });
          try {
            await callFn();
          } finally {
            await manager.pause({ from: pauseController });
          }
        }
        return;
      }
      throw error;
    }
    throw new Error("Expected pause revert, but the call succeeded.");
  }

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
    const price = toBN(toWei("5"));

    await expectCustomError(manager.listNFT.call(tokenId, 0, { from: employer }), "InvalidParameters");
    await expectCustomError(manager.listNFT.call(tokenId, 10, { from: other }), "NotAuthorized");

    await manager.listNFT(tokenId, price, { from: employer });

    await token.mint(buyer, price, { from: owner });
    await token.approve(manager.address, price, { from: buyer });
    const purchaseTx = await manager.purchaseNFT(tokenId, { from: buyer });
    const purchaseEvent = purchaseTx.logs.find((log) => log.event === "NFTPurchased");
    assert.ok(purchaseEvent, "NFTPurchased event should be emitted");
    assert.strictEqual(purchaseEvent.args.tokenId.toNumber(), tokenId, "event tokenId should match");
    assert.strictEqual(purchaseEvent.args.buyer, buyer, "event buyer should match");
    assert(purchaseEvent.args.price.eq(price), "event price should match");

    const newOwner = await manager.ownerOf(tokenId);
    assert.equal(newOwner, buyer, "buyer should own NFT after purchase");

    await expectCustomError(manager.delistNFT.call(tokenId, { from: buyer }), "NotAuthorized");

    const listing = await manager.listings(tokenId);
    assert.strictEqual(listing.isActive, false, "listing should be inactive after purchase");
  });

  it("blocks marketplace actions while paused and resumes after unpause", async () => {
    const tokenId = await mintJobNft();
    const price = toBN(toWei("5"));

    await manager.pause({ from: owner });
    await expectPausedRevert(
      manager.listNFT(tokenId, price, { from: employer }),
      () => manager.listNFT.call(tokenId, price, { from: employer }),
      owner
    );

    await manager.unpause({ from: owner });
    await manager.listNFT(tokenId, price, { from: employer });

    await manager.pause({ from: owner });
    await expectPausedRevert(
      manager.delistNFT(tokenId, { from: employer }),
      () => manager.delistNFT.call(tokenId, { from: employer }),
      owner
    );

    await token.mint(buyer, price, { from: owner });
    await token.approve(manager.address, price, { from: buyer });
    await expectPausedRevert(
      manager.purchaseNFT(tokenId, { from: buyer }),
      () => manager.purchaseNFT.call(tokenId, { from: buyer }),
      owner
    );

    await manager.unpause({ from: owner });
    await manager.purchaseNFT(tokenId, { from: buyer });

    const newOwner = await manager.ownerOf(tokenId);
    assert.equal(newOwner, buyer, "buyer should own NFT after unpause");
  });

  it("reverts when buyer contract lacks ERC721 receiver hooks", async () => {
    const tokenId = await mintJobNft();
    const price = toBN(toWei("5"));
    const nonReceiver = await NonReceiverBuyer.new({ from: owner });

    await manager.listNFT(tokenId, price, { from: employer });
    await token.mint(nonReceiver.address, price, { from: owner });
    await nonReceiver.approveToken(token.address, manager.address, price, { from: owner });

    await expectRevert.unspecified(
      nonReceiver.purchase(manager.address, tokenId, { from: owner })
    );

    const listing = await manager.listings(tokenId);
    assert.strictEqual(listing.isActive, true, "listing should remain active on revert");

    const currentOwner = await manager.ownerOf(tokenId);
    assert.equal(currentOwner, employer, "NFT owner should remain the seller");
  });

  it("allows purchase by ERC721 receiver contract", async () => {
    const tokenId = await mintJobNft();
    const price = toBN(toWei("5"));
    const receiver = await ERC721ReceiverBuyer.new({ from: owner });

    await manager.listNFT(tokenId, price, { from: employer });
    await token.mint(receiver.address, price, { from: owner });
    await receiver.approveToken(token.address, manager.address, price, { from: owner });

    await receiver.purchase(manager.address, tokenId, { from: owner });

    const currentOwner = await manager.ownerOf(tokenId);
    assert.equal(currentOwner, receiver.address, "NFT owner should be the receiver contract");

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

    await expectRevert.unspecified(
      managerReentrant.purchaseNFT(tokenIdA, { from: buyer })
    );

    const ownerA = await managerReentrant.ownerOf(tokenIdA);
    assert.equal(ownerA, employer, "tokenIdA should remain with seller");

    const ownerB = await managerReentrant.ownerOf(tokenIdB);
    assert.equal(ownerB, employer, "tokenIdB should remain with seller");

    const listingA = await managerReentrant.listings(tokenIdA);
    assert.strictEqual(listingA.isActive, true, "tokenIdA listing should remain active");

    const listingB = await managerReentrant.listings(tokenIdB);
    assert.strictEqual(listingB.isActive, true, "tokenIdB listing should remain active");
  });
});
