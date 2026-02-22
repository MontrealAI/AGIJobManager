const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockPublicResolver = artifacts.require("MockPublicResolver");
const ENSJobPages = artifacts.require("ENSJobPages");
const MockENSJobPagesMalformed = artifacts.require("MockENSJobPagesMalformed");
const MockHookCaller = artifacts.require("MockHookCaller");

const { buildInitConfig } = require("./helpers/deploy");
const { fundAgents } = require("./helpers/bonds");

contract("Job token metadata routing and mappings", (accounts) => {
  const [owner, employer, agent] = accounts;
  const ZERO32 = "0x" + "00".repeat(32);

  async function deployManager(baseIpfsUrl = "ipfs://base/") {
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

  async function createAndFinalize({ manager, token, completionURI }) {
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 80, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await fundAgents(token, manager, [agent], owner);

    const payout = web3.utils.toWei("10");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob("ipfs://spec.json", payout, 100, "details", { from: employer });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, completionURI, { from: agent });

    const reviewPeriod = await manager.completionReviewPeriod();
    await time.increase(reviewPeriod.addn(1));
    return manager.finalizeJob(0, { from: employer });
  }

  it("falls back to completion URI if ENS router payload is malformed", async () => {
    const { token, manager } = await deployManager("ipfs://base/");
    const malformed = await MockENSJobPagesMalformed.new({ from: owner });
    await malformed.setTokenURIBytes("0x1234", { from: owner });

    await manager.setEnsJobPages(malformed.address, { from: owner });
    await manager.setUseEnsJobTokenURI(true, { from: owner });

    const receipt = await createAndFinalize({ manager, token, completionURI: "QmCompletion" });
    const minted = receipt.logs.find((log) => log.event === "NFTIssued");
    const tokenUri = await manager.tokenURI(minted.args.tokenId);
    assert.equal(tokenUri, "ipfs://base/QmCompletion");
  });

  it("router handleHook does not revert and preview matches selector output", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const router = await ENSJobPages.new(ens.address, "0x0000000000000000000000000000000000000000", resolver.address, ZERO32, "", { from: owner });
    const hookCaller = await MockHookCaller.new({ from: owner });

    await router.setJobManager(hookCaller.address, { from: owner });
    await router.setBaseMetadataURI("ipfs://metadata/", { from: owner });
    await router.setUseJobIdJsonSuffix(true, { from: owner });

    await hookCaller.callHandleHook(router.address, 1, 99, { from: owner });

    const preview = await router.previewTokenURI(99);
    assert.equal(preview, "ipfs://metadata/99.json");

    const selector = web3.utils.keccak256("jobEnsURI(uint256)").slice(0, 10);
    const payload = web3.eth.abi.encodeFunctionCall(
      {
        name: "jobEnsURI",
        type: "function",
        inputs: [{ name: "jobId", type: "uint256" }]
      },
      ["99"]
    );
    assert.equal(payload.slice(0, 10), selector);

    const raw = await web3.eth.call({ to: router.address, data: payload });
    const decoded = web3.eth.abi.decodeParameters(["string"], raw);
    assert.equal(decoded[0], preview);
  });
});
