const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");
const MockENSJobPages = artifacts.require("MockENSJobPages");

const { buildInitConfig } = require("./helpers/deploy");
const { fundAgents } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];

contract("ENS job pages hooks", (accounts) => {
  const [owner, employer, agent] = accounts;
  let token;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let jobPages;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });
    jobPages = await MockENSJobPages.new({ from: owner });

    manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        jobPages.address,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT
      ),
      { from: owner }
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 90, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await fundAgents(token, manager, [agent], owner);

    await manager.setCompletionReviewPeriod(1, { from: owner });
  });

  it("attempts ENS page creation and agent assignment hooks", async () => {
    const payout = web3.utils.toWei("10");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs://spec", payout, 100, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    createTx;
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs://completion", { from: agent });
  });

  it("does not block lifecycle when ENS hooks revert", async () => {
    await jobPages.setReverts(true, false, false, false, false, { from: owner });
    const payout = web3.utils.toWei("5");
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const createTx = await manager.createJob("ipfs://spec", payout, 100, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    createTx;

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
  });

});
