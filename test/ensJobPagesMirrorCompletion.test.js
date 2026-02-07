const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const ENSJobPages = artifacts.require("ENSJobPages");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockPublicResolver = artifacts.require("MockPublicResolver");

const { buildInitConfig } = require("./helpers/deploy");
const { fundAgents } = require("./helpers/bonds");
const { namehash } = require("./helpers/ens");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];

contract("ENSJobPages completion mirror", (accounts) => {
  const [owner, employer, agent] = accounts;
  const rootName = "alpha.jobs.agi.eth";
  const rootNode = namehash(rootName);

  let token;
  let manager;
  let ensJobPages;
  let ensRegistry;
  let resolver;
  let nameWrapper;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    ensRegistry = await MockENSRegistry.new({ from: owner });
    resolver = await MockPublicResolver.new({ from: owner });

    ensJobPages = await ENSJobPages.new({ from: owner });
    await ensJobPages.setENSRegistry(ensRegistry.address, { from: owner });
    await ensJobPages.setNameWrapper(nameWrapper.address, { from: owner });
    await ensJobPages.setPublicResolver(resolver.address, { from: owner });
    await ensJobPages.setJobsRootNode(rootNode, { from: owner });
    await ensJobPages.setJobsRootName(rootName, { from: owner });
    await ensRegistry.setOwner(rootNode, ensJobPages.address, { from: owner });

    manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        ensJobPages.address,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT
      ),
      { from: owner }
    );
    await ensJobPages.setController(manager.address, { from: owner });

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 90, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await fundAgents(token, manager, [agent], owner);
  });

  it("mirrors completion pointers via the helper after completion request", async () => {
    const payout = web3.utils.toWei("3");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs://spec", payout, 10, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs://completion", { from: agent });

    await ensJobPages.mirrorCompletion(jobId, { from: employer });

    const node = await ensJobPages.jobEnsNode(jobId);
    const completion = await resolver.text(node, "agijobs.completion.public");
    assert.strictEqual(completion, "ipfs://completion", "completion pointer should be mirrored");
  });
});
