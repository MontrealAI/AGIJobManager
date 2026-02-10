const assert = require("assert");
const { time } = require("@openzeppelin/test-helpers");

const ENSJobPages = artifacts.require("ENSJobPages");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockPublicResolver = artifacts.require("MockPublicResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockNameWrapperReverting = artifacts.require("MockNameWrapperReverting");

const { deployMainnetFixture, seedAgent, createJob } = require("./helpers/mainnetFixture");

contract("ens hooks integration", (accounts) => {
  const [owner, employer, agent] = accounts;

  async function setupPages(nameWrapperAddress) {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const jobsRoot = web3.utils.keccak256("jobs-root");
    const pages = await ENSJobPages.new(ens.address, nameWrapperAddress, resolver.address, jobsRoot, "alpha.jobs.agi.eth", { from: owner });
    return { pages };
  }

  it("invokes hook-backed flows without bricking core lifecycle", async () => {
    const { token, manager, nft } = await deployMainnetFixture(accounts);
    await seedAgent({ owner, agent, token, nft, manager });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const { pages } = await setupPages(wrapper.address);

    await pages.setJobManager(manager.address, { from: owner });
    await manager.setEnsJobPages(pages.address, { from: owner });

    const jobId = await createJob({ owner, employer, token, manager, payout: web3.utils.toBN(web3.utils.toWei("6")) });
    await manager.applyForJob(jobId, "agent", [], { from: agent });
    await manager.requestJobCompletion(jobId, "done", { from: agent });
    await time.increase((await manager.completionReviewPeriod()).addn(1));
    await manager.finalizeJob(jobId, { from: employer });

    const uri = await pages.jobEnsURI(jobId);
    assert(uri.includes("job-0"));
  });

  it("keeps lockJobENS best-effort when wrapper setChildFuses reverts", async () => {
    const { token, manager, nft } = await deployMainnetFixture(accounts);
    await seedAgent({ owner, agent, token, nft, manager });
    const wrapper = await MockNameWrapperReverting.new({ from: owner });
    const { pages } = await setupPages(wrapper.address);

    await pages.setJobManager(manager.address, { from: owner });
    await manager.setEnsJobPages(pages.address, { from: owner });

    const jobId = await createJob({ owner, employer, token, manager, payout: web3.utils.toBN(web3.utils.toWei("2")), duration: 1 });
    await manager.applyForJob(jobId, "agent", [], { from: agent });
    await time.increase(2);
    await manager.expireJob(jobId, { from: employer });

    await manager.lockJobENS(jobId, true, { from: owner });
    await wrapper.setRevertSetChildFuses(true, { from: owner });
    await manager.lockJobENS(jobId, true, { from: owner });
    assert.equal((await wrapper.revertSetChildFuses()).toString(), "true");
  });
});
