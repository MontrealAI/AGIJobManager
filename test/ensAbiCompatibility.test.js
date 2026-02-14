const { time, expectEvent } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const ENSJobPages = artifacts.require("ENSJobPages");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockPublicResolver = artifacts.require("MockPublicResolver");
const MockHookCaller = artifacts.require("MockHookCaller");
const MockENSJobPages = artifacts.require("MockENSJobPages");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { namehash } = require("./helpers/ens");

contract("ENS ABI compatibility + URI path", (accounts) => {
  const [owner, employer, agent] = accounts;
  const ZERO32 = "0x" + "00".repeat(32);

  async function deployManager(token, ens, wrapper) {
    return AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "",
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

  async function seedSimpleJob(manager, token, nft) {
    await manager.addAGIType(nft.address, 60, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });

    const payout = web3.utils.toWei("5");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob("ipfs://spec.json", payout, 1, "details", { from: employer });
    await token.mint(agent, web3.utils.toWei("2"), { from: owner });
    await token.approve(manager.address, web3.utils.toWei("2"), { from: agent });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "ipfs://completion.json", { from: agent });
    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
  }

  it("matches required selectors, calldata size, and string ABI shape", async () => {
    const expectedHandleSelector = "0x1f76f7a2";
    const expectedJobUriSelector = "0x751809b4";

    const actualHandleSelector = web3.utils.keccak256("handleHook(uint8,uint256)").slice(0, 10);
    const actualJobUriSelector = web3.utils.keccak256("jobEnsURI(uint256)").slice(0, 10);
    assert.equal(actualHandleSelector, expectedHandleSelector);
    assert.equal(actualJobUriSelector, expectedJobUriSelector);

    const handleCalldata = web3.eth.abi.encodeFunctionCall(
      {
        name: "handleHook",
        type: "function",
        inputs: [
          { type: "uint8", name: "hook" },
          { type: "uint256", name: "jobId" },
        ],
      },
      ["0", "123"]
    );
    const jobUriCalldata = web3.eth.abi.encodeFunctionCall(
      {
        name: "jobEnsURI",
        type: "function",
        inputs: [{ type: "uint256", name: "jobId" }],
      },
      ["123"]
    );

    assert.equal((handleCalldata.length - 2) / 2, 0x44, "handleHook calldata should be 0x44 bytes");
    assert.equal((jobUriCalldata.length - 2) / 2, 0x24, "jobEnsURI calldata should be 0x24 bytes");

    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const caller = await MockHookCaller.new({ from: owner });
    const rootName = "jobs.agi.eth";
    const rootNode = namehash(rootName);

    const pages = await ENSJobPages.new(ens.address, wrapper.address, resolver.address, rootNode, rootName, {
      from: owner,
    });
    await pages.setJobManager(caller.address, { from: owner });
    await ens.setOwner(rootNode, pages.address, { from: owner });

    const hookReceipt = await caller.callHandleHook(pages.address, 0, 123, { from: owner });
    await expectEvent.inTransaction(hookReceipt.tx, pages, "ENSHookSkipped", {
      hook: "0",
      jobId: "123",
      reason: web3.utils.padRight(web3.utils.asciiToHex("UNKNOWN_HOOK"), 64),
    });

    const raw = await web3.eth.call({ to: pages.address, data: jobUriCalldata });
    const offsetWord = web3.utils.toBN("0x" + raw.slice(2, 66));
    const stringLenWord = web3.utils.toBN("0x" + raw.slice(66, 130));
    const decoded = web3.eth.abi.decodeParameter("string", raw);
    assert.equal(offsetWord.toString(), "32", "ABI offset should be 32 for single string return");
    assert.equal(stringLenWord.toString(), decoded.length.toString(), "ABI string length word should match");
    assert.equal(decoded, "ens://job-123.jobs.agi.eth");
    assert.isAtMost(decoded.length, 1024, "ENS URI should stay within AGIJobManager bounds");
  });

  it("uses ENS job URI for completion NFT when enabled", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENSRegistry.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const nft = await MockERC721.new({ from: owner });
    const manager = await deployManager(token, ens, wrapper);
    const pages = await MockENSJobPages.new({ from: owner });

    await manager.setEnsJobPages(pages.address, { from: owner });
    await manager.setUseEnsJobTokenURI(true, { from: owner });

    await seedSimpleJob(manager, token, nft);
    await manager.finalizeJob(0, { from: employer });

    const uri = await manager.tokenURI(0);
    assert.equal(uri, "ens://job-0.alpha.jobs.agi.eth");
    assert.isAtMost(uri.length, 1024, "ENS URI should stay within AGIJobManager bounds");
  });

  it("keeps AGI job creation live when ENSJobPages is present but unconfigured", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENSRegistry.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const manager = await deployManager(token, ens, wrapper);

    const rootName = "jobs.agi.eth";
    const rootNode = namehash(rootName);
    const pages = await ENSJobPages.new(ens.address, wrapper.address, resolver.address, rootNode, rootName, {
      from: owner,
    });
    await pages.setJobManager(manager.address, { from: owner });
    await manager.setEnsJobPages(pages.address, { from: owner });

    const payout = web3.utils.toWei("1");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const tx = await manager.createJob("ipfs://spec.json", payout, 60, "details", { from: employer });
    assert.equal(tx.logs[0].event, "JobCreated");
  });
});
