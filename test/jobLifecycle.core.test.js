const assert = require("assert");
const { expectRevert, time } = require("@openzeppelin/test-helpers");
const { deployMainnetFixture, seedAgent, seedValidator, createJob } = require("./helpers/mainnetFixture");

contract("jobLifecycle core", (accounts) => {
  const [owner, employer, agent, validator] = accounts;

  it("covers deterministic create -> apply -> complete -> finalize", async () => {
    const { token, manager, nft } = await deployMainnetFixture(accounts);
    await seedAgent({ owner, agent, token, nft, manager });
    await seedValidator({ owner, validator, token, manager });
    await manager.setRequiredValidatorApprovals(1, { from: owner });

    const payout = web3.utils.toBN(web3.utils.toWei("5"));
    const lockedBefore = await manager.lockedEscrow();
    const jobId = await createJob({ owner, employer, token, manager, payout, duration: 200, uri: "core-job" });
    const lockedAfter = await manager.lockedEscrow();
    assert(lockedAfter.sub(lockedBefore).eq(payout));

    await manager.applyForJob(jobId, "agent", [], { from: agent });
    await manager.requestJobCompletion(jobId, "done", { from: agent });
    await manager.validateJob(jobId, "validator", [], { from: validator });
    await expectRevert.unspecified(manager.finalizeJob(jobId, { from: employer }));
    await time.increase((await manager.challengePeriodAfterApproval()).addn(1));
    await manager.finalizeJob(jobId, { from: employer });

    const core = await manager.getJobCore(jobId);
    assert.equal(core.completed, true);
  });

  it("covers deterministic expiry branch", async () => {
    const { token, manager, nft } = await deployMainnetFixture(accounts);
    await seedAgent({ owner, agent, token, nft, manager });

    const jobId = await createJob({ owner, employer, token, manager, payout: web3.utils.toBN(web3.utils.toWei("3")), duration: 1, uri: "exp-job" });
    await manager.applyForJob(jobId, "agent", [], { from: agent });
    await time.increase(2);
    await manager.expireJob(jobId, { from: employer });

    const core = await manager.getJobCore(jobId);
    assert.equal(core.expired, true);
  });
});
