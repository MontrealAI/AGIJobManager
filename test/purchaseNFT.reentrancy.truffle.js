const assert = require("assert");
const { expectRevert } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC721 = artifacts.require("MockERC721");
const ReentrantERC20 = artifacts.require("ReentrantERC20");

const { AGI_TOKEN_ADDRESS, AGENT_ROOT_NODE, CLUB_ROOT_NODE, setTokenCode } = require("./helpers/fixedToken");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager purchaseNFT reentrancy", (accounts) => {
  const [owner, employer, agent, validator, buyer, ensPlaceholder, nameWrapperPlaceholder] = accounts;
  let token;
  let manager;

  const createAndCompleteJob = async (payout) => {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-finished", { from: agent });
    const validateTx = await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    const issueEvent = validateTx.logs.find((log) => log.event === "NFTIssued");
    return issueEvent.args.tokenId.toNumber();
  };

  beforeEach(async () => {
    token = await setTokenCode(ReentrantERC20);
    manager = await AGIJobManager.new(
      AGI_TOKEN_ADDRESS,
      "ipfs://base",
      ensPlaceholder,
      nameWrapperPlaceholder,
      CLUB_ROOT_NODE,
      AGENT_ROOT_NODE,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 70, { from: owner });

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
  });

  it("allows purchases when reentrancy is disabled", async () => {
    const payout = toBN(toWei("40"));
    const tokenId = await createAndCompleteJob(payout);
    const price = toBN(toWei("5"));

    await manager.listNFT(tokenId, price, { from: employer });
    await token.mint(buyer, price, { from: owner });
    await token.approve(manager.address, price, { from: buyer });

    await manager.purchaseNFT(tokenId, { from: buyer });

    const newOwner = await manager.ownerOf(tokenId);
    assert.equal(newOwner, buyer, "buyer should own NFT after purchase");

    const listing = await manager.listings(tokenId);
    assert.strictEqual(listing.isActive, false, "listing should be inactive after purchase");
  });

  it("reverts when a reentrant token attempts nested purchaseNFT", async () => {
    const payout = toBN(toWei("40"));
    const tokenIdA = await createAndCompleteJob(payout);
    const tokenIdB = await createAndCompleteJob(payout);

    const priceA = toBN(toWei("5"));
    const priceB = toBN(toWei("7"));

    await manager.listNFT(tokenIdA, priceA, { from: employer });
    await manager.listNFT(tokenIdB, priceB, { from: employer });

    await token.mint(buyer, priceA, { from: owner });
    await token.approve(manager.address, priceA, { from: buyer });

    await token.mint(token.address, priceB, { from: owner });
    await token.setReentry(manager.address, tokenIdB, true, { from: owner });
    await token.approveManager(priceB, { from: owner });

    const buyerBalanceBefore = await token.balanceOf(buyer);
    const sellerBalanceBefore = await token.balanceOf(employer);
    await expectRevert.unspecified(manager.purchaseNFT(tokenIdA, { from: buyer }));
    const buyerBalanceAfter = await token.balanceOf(buyer);
    const sellerBalanceAfter = await token.balanceOf(employer);
    assert(
      buyerBalanceAfter.eq(buyerBalanceBefore),
      "buyer balance should be unchanged after revert"
    );
    assert(
      sellerBalanceAfter.eq(sellerBalanceBefore),
      "seller balance should be unchanged after revert"
    );

    const ownerA = await manager.ownerOf(tokenIdA);
    assert.equal(ownerA, employer, "tokenIdA should remain with seller");
    const ownerB = await manager.ownerOf(tokenIdB);
    assert.equal(ownerB, employer, "tokenIdB should remain with seller");

    const listingA = await manager.listings(tokenIdA);
    assert.strictEqual(listingA.isActive, true, "tokenIdA listing should remain active");
    const listingB = await manager.listings(tokenIdB);
    assert.strictEqual(listingB.isActive, true, "tokenIdB listing should remain active");
  });

  it("reverts when reentrancy targets the same listing", async () => {
    const payout = toBN(toWei("40"));
    const tokenId = await createAndCompleteJob(payout);
    const price = toBN(toWei("5"));

    await manager.listNFT(tokenId, price, { from: employer });
    await token.mint(buyer, price, { from: owner });
    await token.approve(manager.address, price, { from: buyer });

    await token.mint(token.address, price, { from: owner });
    await token.setReentry(manager.address, tokenId, true, { from: owner });
    await token.approveManager(price, { from: owner });

    await expectRevert.unspecified(manager.purchaseNFT(tokenId, { from: buyer }));

    const currentOwner = await manager.ownerOf(tokenId);
    assert.equal(currentOwner, employer, "tokenId should remain with seller");

    const listing = await manager.listings(tokenId);
    assert.strictEqual(listing.isActive, true, "listing should remain active");
  });
});
