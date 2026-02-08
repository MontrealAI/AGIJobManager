const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockENSJobPages = artifacts.require("MockENSJobPages");

const { buildInitConfig } = require("./helpers/deploy");

contract("AGIJobManager ENS job pages hooks", (accounts) => {
  const [owner, employer, agent] = accounts;
  const ZERO32 = "0x" + "00".repeat(32);

  async function deployManager(baseIpfsUrl = "") {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        baseIpfsUrl,
        ens.address,
        nameWrapper.address,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32
      ),
      { from: owner }
    );
    return { token, manager };
  }

  async function seedAgentType(manager, nft, agentAddr) {
    await manager.addAGIType(nft.address, 60, { from: owner });
    await nft.mint(agentAddr, { from: owner });
    await manager.addAdditionalAgent(agentAddr, { from: owner });
  }

  it("calls ENS job page hooks during lifecycle", async () => {
    const { token, manager } = await deployManager();
    const nft = await MockERC721.new({ from: owner });
    const ensJobPages = await MockENSJobPages.new({ from: owner });

    await seedAgentType(manager, nft, agent);
    await manager.setEnsJobPages(ensJobPages.address, { from: owner });

    const payout = web3.utils.toWei("10");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob("ipfs://spec.json", payout, 100, "details", { from: employer });
    assert.equal((await ensJobPages.createCalls()).toString(), "1");

    await token.mint(agent, web3.utils.toWei("2"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("2"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });
    assert.equal((await ensJobPages.assignCalls()).toString(), "1");

    await manager.requestJobCompletion(0, "ipfs://completion.json", { from: agent });
    assert.equal((await ensJobPages.completionCalls()).toString(), "1");

    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
    await manager.finalizeJob(0, { from: employer });
    assert.equal((await ensJobPages.revokeCalls()).toString(), "1");

    await manager.lockJobENS(0, true, { from: employer });
    assert.equal((await ensJobPages.lockCalls()).toString(), "1");
    assert.equal(await ensJobPages.lastBurnFuses(), true, "burnFuses should pass through");
  });

  it("does not block flows when ENS hooks revert", async () => {
    const { token, manager } = await deployManager();
    const nft = await MockERC721.new({ from: owner });
    const ensJobPages = await MockENSJobPages.new({ from: owner });

    await seedAgentType(manager, nft, agent);
    await manager.setEnsJobPages(ensJobPages.address, { from: owner });
    await ensJobPages.setRevertHook(1, true, { from: owner });
    await ensJobPages.setRevertHook(2, true, { from: owner });
    await ensJobPages.setRevertHook(3, true, { from: owner });
    await ensJobPages.setRevertHook(4, true, { from: owner });
    assert.equal(await ensJobPages.revertHook(1), true, "create hook should revert");

    const payout = web3.utils.toWei("5");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob("ipfs://spec.json", payout, 50, "details", { from: employer });

    await token.mint(agent, web3.utils.toWei("2"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("2"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });

    await manager.requestJobCompletion(0, "ipfs://completion.json", { from: agent });
    assert.equal((await ensJobPages.completionCalls()).toString(), "0", "reverted hook should not count");

    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
    await manager.finalizeJob(0, { from: employer });
  });

  it("does not block cancel/expire when ENS hooks revert", async () => {
    const { token, manager } = await deployManager();
    const nft = await MockERC721.new({ from: owner });
    const ensJobPages = await MockENSJobPages.new({ from: owner });

    await seedAgentType(manager, nft, agent);
    await manager.setEnsJobPages(ensJobPages.address, { from: owner });
    await ensJobPages.setRevertHook(4, true, { from: owner });

    const payout = web3.utils.toWei("3");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob("ipfs://spec.json", payout, 100, "details", { from: employer });
    await manager.cancelJob(0, { from: employer });

    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs://spec2.json", payout, 1, "details", { from: employer });

    await token.mint(agent, web3.utils.toWei("2"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("2"), { from: agent });
    await manager.applyForJob(1, "agent", [], { from: agent });

    await time.increase(2);
    await manager.expireJob(1, { from: employer });
  });

  it("uses ENS tokenURI when configured and preserves ens:// scheme", async () => {
    const { token, manager } = await deployManager("ipfs://base");
    const nft = await MockERC721.new({ from: owner });
    const ensJobPages = await MockENSJobPages.new({ from: owner });

    await seedAgentType(manager, nft, agent);
    await manager.setEnsJobPages(ensJobPages.address, { from: owner });
    await manager.setUseEnsJobTokenURI(true, { from: owner });

    const payout = web3.utils.toWei("10");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob("ipfs://spec.json", payout, 100, "details", { from: employer });

    await token.mint(agent, web3.utils.toWei("2"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("2"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "QmCompletion", { from: agent });

    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
    const receipt = await manager.finalizeJob(0, { from: employer });
    const issued = receipt.logs.find((log) => log.event === "NFTIssued");
    assert.ok(issued, "NFTIssued event should be emitted");
    const tokenId = issued.args.tokenId.toString();
    const tokenUri = await manager.tokenURI(tokenId);
    assert.equal(tokenUri, "ens://job-0.alpha.jobs.agi.eth");
  });

  it("falls back to completion URI when ENS tokenURI is empty", async () => {
    const { token, manager } = await deployManager("ipfs://base");
    const nft = await MockERC721.new({ from: owner });
    const ensJobPages = await MockENSJobPages.new({ from: owner });

    await seedAgentType(manager, nft, agent);
    await manager.setEnsJobPages(ensJobPages.address, { from: owner });
    await manager.setUseEnsJobTokenURI(true, { from: owner });
    await ensJobPages.setJobEnsUriOverride("", { from: owner });

    const payout = web3.utils.toWei("10");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob("ipfs://spec.json", payout, 100, "details", { from: employer });

    await token.mint(agent, web3.utils.toWei("2"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("2"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "QmCompletion", { from: agent });

    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
    const receipt = await manager.finalizeJob(0, { from: employer });
    const issued = receipt.logs.find((log) => log.event === "NFTIssued");
    const tokenId = issued.args.tokenId.toString();
    const tokenUri = await manager.tokenURI(tokenId);
    assert.equal(tokenUri, "ipfs://base/QmCompletion");
  });

  it("does not call lock hook before terminal state", async () => {
    const { token, manager } = await deployManager();
    const nft = await MockERC721.new({ from: owner });
    const ensJobPages = await MockENSJobPages.new({ from: owner });

    await seedAgentType(manager, nft, agent);
    await manager.setEnsJobPages(ensJobPages.address, { from: owner });

    const payout = web3.utils.toWei("10");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob("ipfs://spec.json", payout, 100, "details", { from: employer });
    await manager.lockJobENS(0, true, { from: employer });
    assert.equal((await ensJobPages.lockCalls()).toString(), "0");
  });

  it("uses completion URI when ENS tokenURI is disabled", async () => {
    const { token, manager } = await deployManager("ipfs://base");
    const nft = await MockERC721.new({ from: owner });

    await seedAgentType(manager, nft, agent);

    const payout = web3.utils.toWei("10");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob("ipfs://spec.json", payout, 100, "details", { from: employer });

    await token.mint(agent, web3.utils.toWei("2"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("2"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "QmCompletion", { from: agent });

    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
    const receipt = await manager.finalizeJob(0, { from: employer });
    const issued = receipt.logs.find((log) => log.event === "NFTIssued");
    const tokenId = issued.args.tokenId.toString();
    const tokenUri = await manager.tokenURI(tokenId);
    assert.equal(tokenUri, "ipfs://base/QmCompletion");
  });

});
