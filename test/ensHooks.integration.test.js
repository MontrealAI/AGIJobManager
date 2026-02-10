const assert = require("assert");
const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const ENSJobPages = artifacts.require("ENSJobPages");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockNameWrapperReverting = artifacts.require("MockNameWrapperReverting");
const MockPublicResolver = artifacts.require("MockPublicResolver");

const { buildInitConfig } = require("./helpers/deploy");
const { rootNode, setNameWrapperOwnership } = require("./helpers/ens");
const { fundAgents, fundValidators } = require("./helpers/bonds");
const { expectCustomError } = require("./helpers/errors");

const ZERO_ROOT = "0x" + "00".repeat(32);

contract("ensHooks.integration", (accounts) => {
  const [owner, employer, agent, validator] = accounts;

  async function setup(nameWrapperArtifact) {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENSRegistry.new({ from: owner });
    const wrapper = await nameWrapperArtifact.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const agiTypeNft = await MockERC721.new({ from: owner });
    const clubRoot = rootNode("club");
    const agentRoot = rootNode("agent");

    const manager = await AGIJobManager.new(
      ...buildInitConfig(token.address, "ipfs://base", ens.address, wrapper.address, clubRoot, agentRoot, clubRoot, agentRoot, ZERO_ROOT, ZERO_ROOT),
      { from: owner }
    );
    await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
    await agiTypeNft.mint(agent, { from: owner });

    await setNameWrapperOwnership(wrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(wrapper, clubRoot, "validator", validator);
    await fundAgents(token, manager, [agent], owner, 3);
    await fundValidators(token, manager, [validator], owner, 3);

    const jobsRoot = rootNode("jobs");
    const pages = await ENSJobPages.new(ens.address, wrapper.address, resolver.address, jobsRoot, "jobs.agi.eth", { from: owner });
    await pages.setJobManager(manager.address, { from: owner });
    await ens.setOwner(jobsRoot, pages.address, { from: owner });
    await wrapper.setOwner(web3.utils.toBN(jobsRoot), owner, { from: owner });
    await wrapper.setApprovalForAll(pages.address, true, { from: owner });

    await manager.setEnsJobPages(pages.address, { from: owner });
    await manager.setVoteQuorum(1, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await token.mint(employer, web3.utils.toBN(web3.utils.toWei("20")), { from: owner });
    await token.approve(manager.address, web3.utils.toBN(web3.utils.toWei("20")), { from: employer });

    return { manager, pages, resolver };
  }

  it("invokes hooks best-effort across create/assign/completion/revoke", async () => {
    const { manager, pages, resolver } = await setup(MockNameWrapper);
    await manager.createJob("ipfs://spec", web3.utils.toBN(web3.utils.toWei("5")), 1000, "d", { from: employer });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await manager.requestJobCompletion(0, "ipfs://completion", { from: agent });
    await manager.validateJob(0, "validator", [], { from: validator });
    const cp = await manager.challengePeriodAfterApproval();
    await time.increase(cp.addn(1));
    await manager.finalizeJob(0, { from: employer });

    const node = await pages.jobEnsNode(0);
    const completion = await resolver.text(node, "agijobs.completion.public");
    assert.equal(completion, "ipfs://completion");
  });

  it("lockJobENS burnFuses owner-only and wrapper failures do not revert", async () => {
    const { manager } = await setup(MockNameWrapperReverting);
    await manager.createJob("ipfs://spec", web3.utils.toBN(web3.utils.toWei("5")), 1, "d", { from: employer });
    await manager.applyForJob(0, "agent", [], { from: agent });
    await time.increase(2);
    await manager.expireJob(0, { from: employer });

    await expectCustomError(manager.lockJobENS.call(0, true, { from: agent }), "NotAuthorized");

    const tx = await manager.lockJobENS(0, true, { from: owner });
    const hookLog = tx.logs.find((l) => l.event === "EnsHookAttempted");
    assert.equal(hookLog.args.success, true);
    assert.equal(hookLog.args.hook.toString(), "6");
  });
});
