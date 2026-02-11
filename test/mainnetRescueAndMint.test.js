const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockRescueERC20 = artifacts.require("MockRescueERC20");
const ERC721ReceiverEmployer = artifacts.require("ERC721ReceiverEmployer");
const NonReceiverEmployer = artifacts.require("NonReceiverEmployer");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");

contract("AGIJobManager rescue hardening", (accounts) => {
  const [owner, employer, agent] = accounts;
  const ZERO32 = "0x" + "00".repeat(32);

  async function deployManager(token) {
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    return AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        wrapper.address,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32
      ),
      { from: owner }
    );
  }

  async function settleContractEmployerJob(manager, token, contractEmployer) {
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });

    const payout = web3.utils.toWei("2");
    await token.mint(contractEmployer.address, payout, { from: owner });
    await contractEmployer.createJob("ipfs://spec", payout, 100, "details", { from: owner });

    await token.mint(agent, web3.utils.toWei("3"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("3"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "ipfs://completion", { from: agent });

    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
    await manager.finalizeJob(0, { from: owner });
  }

  it("rescueERC20 keeps AGI backing safe and follows withdrawAGI pause posture", async () => {
    const agi = await MockERC20.new({ from: owner });
    const manager = await deployManager(agi);

    await agi.mint(employer, web3.utils.toWei("10"), { from: owner });
    await agi.approve(manager.address, web3.utils.toWei("10"), { from: employer });
    await manager.createJob("ipfs://spec", web3.utils.toWei("10"), 1000, "details", { from: employer });

    await expectCustomError(
      manager.rescueERC20.call(agi.address, owner, web3.utils.toWei("1"), { from: owner }),
      "InvalidState"
    );

    await manager.pause({ from: owner });
    await expectCustomError(
      manager.rescueERC20.call(agi.address, owner, web3.utils.toWei("1"), { from: owner }),
      "InsufficientWithdrawableBalance"
    );

    await agi.mint(manager.address, web3.utils.toWei("4"), { from: owner });
    await manager.rescueERC20(agi.address, owner, web3.utils.toWei("4"), { from: owner });
    assert.equal((await agi.balanceOf(owner)).toString(), web3.utils.toWei("4"));

    await manager.setSettlementPaused(true, { from: owner });
    await expectCustomError(
      manager.rescueERC20.call(agi.address, owner, "1", { from: owner }),
      "SettlementPaused"
    );
  });

  it("rescueERC20 transfers arbitrary non-AGI tokens", async () => {
    const agi = await MockERC20.new({ from: owner });
    const manager = await deployManager(agi);
    const stray = await MockRescueERC20.new({ from: owner });

    await stray.mint(manager.address, 25, { from: owner });
    await manager.rescueERC20(stray.address, owner, 25, { from: owner });
    assert.equal((await stray.balanceOf(owner)).toString(), "25");
  });

  it("safe-mints completion NFTs to ERC721Receiver employers", async () => {
    const token = await MockERC20.new({ from: owner });
    const manager = await deployManager(token);
    const receiverEmployer = await ERC721ReceiverEmployer.new(manager.address, token.address, { from: owner });

    await settleContractEmployerJob(manager, token, receiverEmployer);

    assert.equal((await receiverEmployer.receivedCount()).toString(), "1");
    const tokenId = await receiverEmployer.lastTokenId();
    assert.equal(await manager.ownerOf(tokenId), receiverEmployer.address);
  });

  it("falls back to _mint for contract employers without IERC721Receiver", async () => {
    const token = await MockERC20.new({ from: owner });
    const manager = await deployManager(token);
    const nonReceiverEmployer = await NonReceiverEmployer.new(manager.address, token.address, { from: owner });

    await settleContractEmployerJob(manager, token, nonReceiverEmployer);

    assert.equal(await manager.ownerOf(0), nonReceiverEmployer.address);
  });

  it("blocks external callers from the internal safe-mint wrapper", async () => {
    const token = await MockERC20.new({ from: owner });
    const manager = await deployManager(token);

    await expectCustomError(
      manager.safeMintCompletionTo.call(employer, 999, { from: owner }),
      "NotAuthorized"
    );
  });
});
