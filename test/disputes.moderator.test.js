const assert = require("assert");
const { deployMainnetFixture, seedAgent, createJob, fundDisputant } = require("./helpers/mainnetFixture");

contract("disputes moderator", (accounts) => {
  const [owner, employer, agent, moderator] = accounts;

  it("opens dispute with bond and allows moderator NO_ACTION", async () => {
    const { token, manager, nft } = await deployMainnetFixture(accounts);
    await manager.addModerator(moderator, { from: owner });
    await seedAgent({ owner, agent, token, nft, manager });

    const payout = web3.utils.toWei("10");
    const jobId = await createJob({ owner, employer, token, manager, payout: web3.utils.toBN(payout), duration: 200 });
    await manager.applyForJob(jobId, "agent", [], { from: agent });
    await manager.requestJobCompletion(jobId, "done", { from: agent });
    await fundDisputant({ owner, disputant: employer, token, manager, payout });
    await manager.disputeJob(jobId, { from: employer });

    await manager.resolveDisputeWithCode(jobId, 0, "noop", { from: moderator });
    const core = await manager.getJobCore(jobId);
    assert.equal(core.disputed, true);
  });
});
