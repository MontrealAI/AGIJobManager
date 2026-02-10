const assert = require("assert");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { deployMainnetFixture, seedAgent, seedValidator, createJob } = require("./helpers/mainnetFixture");

contract("validatorVoting bonds", (accounts) => {
  const [owner, employer, agent, v1, v2] = accounts;

  it("locks validator bonds and prevents double voting", async () => {
    const { token, manager, nft } = await deployMainnetFixture(accounts);
    await seedAgent({ owner, agent, token, nft, manager });
    await seedValidator({ owner, validator: v1, token, manager });
    await seedValidator({ owner, validator: v2, token, manager });

    const jobId = await createJob({ owner, employer, token, manager, payout: web3.utils.toBN(web3.utils.toWei("6")), duration: 200 });
    await manager.applyForJob(jobId, "agent", [], { from: agent });
    await manager.requestJobCompletion(jobId, "done", { from: agent });

    const before = await manager.lockedValidatorBonds();
    await manager.validateJob(jobId, "validator", [], { from: v1 });
    const after = await manager.lockedValidatorBonds();
    assert(after.gt(before));

    await expectRevert.unspecified(manager.validateJob(jobId, "validator", [], { from: v1 }));
  });
});
