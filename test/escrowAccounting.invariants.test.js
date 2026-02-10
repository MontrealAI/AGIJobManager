const assert = require("assert");
const { BN, time } = require("@openzeppelin/test-helpers");
const { deployMainnetFixture, seedAgent, createJob } = require("./helpers/mainnetFixture");

contract("escrow accounting invariants", (accounts) => {
  const [owner, employer, agent] = accounts;

  async function assertSolvent(manager, token) {
    const balance = new BN(await token.balanceOf(manager.address));
    const locked = (await manager.lockedEscrow())
      .add(await manager.lockedAgentBonds())
      .add(await manager.lockedValidatorBonds())
      .add(await manager.lockedDisputeBonds());
    const withdrawable = new BN(await manager.withdrawableAGI());
    assert(balance.gte(locked));
    assert(withdrawable.eq(balance.sub(locked)));
  }

  it("keeps locked totals and withdrawable consistent across bounded mixed outcomes", async () => {
    const { token, manager, nft } = await deployMainnetFixture(accounts);
    await seedAgent({ owner, agent, token, nft, manager });

    for (let i = 0; i < 8; i += 1) {
      const payout = web3.utils.toBN(web3.utils.toWei((1 + (i % 2)).toString()));
      const jobId = await createJob({ owner, employer, token, manager, payout, duration: 2 + i, uri: `job-${i}` });
      await manager.applyForJob(jobId, `agent-${i}`, [], { from: agent });
      if (i % 2 === 0) {
        await manager.requestJobCompletion(jobId, `completion-${i}`, { from: agent });
        await time.increase((await manager.completionReviewPeriod()).addn(1));
        await manager.finalizeJob(jobId, { from: employer });
      } else {
        await time.increase(3 + i);
        await manager.expireJob(jobId, { from: employer });
      }
      await assertSolvent(manager, token);
    }
  });
});
