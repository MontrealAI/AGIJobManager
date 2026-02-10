const { expectRevert } = require("@openzeppelin/test-helpers");
const { deployMainnetFixture, seedAgent, seedValidator, createJob } = require("./helpers/mainnetFixture");

contract("pausing access control", (accounts) => {
  const [owner, employer, agent, validator] = accounts;

  it("gates apply/finalize across pause and settlementPause", async () => {
    const { token, manager, nft } = await deployMainnetFixture(accounts);
    await seedAgent({ owner, agent, token, nft, manager });
    await seedValidator({ owner, validator, token, manager });
    const payout = web3.utils.toBN(web3.utils.toWei("2"));
    const jobId = await createJob({ owner, employer, token, manager, payout, duration: 100 });

    await manager.pause({ from: owner });
    await expectRevert.unspecified(manager.applyForJob(jobId, "agent", [], { from: agent }));
    await manager.unpause({ from: owner });
    await manager.applyForJob(jobId, "agent", [], { from: agent });
    await manager.requestJobCompletion(jobId, "done", { from: agent });

    await manager.setSettlementPaused(true, { from: owner });
    await expectRevert.unspecified(manager.finalizeJob(jobId, { from: employer }));
  });
});
