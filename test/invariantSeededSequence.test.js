const { time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { buildInitConfig } = require("./helpers/deploy");

contract("AGIJobManager seeded invariant sequences", (accounts) => {
  const [owner, employerA, employerB, agentA, agentB, validatorA, validatorB] = accounts;
  const ZERO32 = "0x" + "00".repeat(32);

  function makeRng(seed) {
    let state = BigInt(seed);
    return () => {
      state = (1103515245n * state + 12345n) % (1n << 31n);
      return Number(state);
    };
  }

  async function assertInvariants(manager, token, harnessActive) {
    const balance = BigInt((await token.balanceOf(manager.address)).toString());
    const lockedEscrow = BigInt((await manager.lockedEscrow()).toString());
    const lockedAgent = BigInt((await manager.lockedAgentBonds()).toString());
    const lockedValidator = BigInt((await manager.lockedValidatorBonds()).toString());
    const lockedDispute = BigInt((await manager.lockedDisputeBonds()).toString());
    const lockedTotal = lockedEscrow + lockedAgent + lockedValidator + lockedDispute;

    assert.ok(balance >= lockedTotal, "solvency invariant violated");

    const withdrawable = BigInt((await manager.withdrawableAGI()).toString());
    assert.equal(withdrawable.toString(), (balance - lockedTotal).toString(), "withdrawable mismatch");

  }

  it("runs deterministic bounded action sequences while preserving accounting invariants", async () => {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        wrapper.address,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32,
        ZERO32
      ),
      { from: owner }
    );

    const nft = await MockERC721.new({ from: owner });
    await nft.mint(agentA, { from: owner });
    await nft.mint(agentB, { from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await manager.addAdditionalAgent(agentA, { from: owner });
    await manager.addAdditionalAgent(agentB, { from: owner });
    await manager.addAdditionalValidator(validatorA, { from: owner });
    await manager.addAdditionalValidator(validatorB, { from: owner });
    await manager.setRequiredValidatorApprovals(2, { from: owner });

    const funded = web3.utils.toWei("200");
    for (const acct of [employerA, employerB, agentA, agentB, validatorA, validatorB]) {
      await token.mint(acct, funded, { from: owner });
      await token.approve(manager.address, funded, { from: acct });
    }

    const employers = [employerA, employerB];
    const agents = [agentA, agentB];
    const validators = [validatorA, validatorB];
    const harnessActive = { [agentA]: 0, [agentB]: 0 };
    const activeJobs = [];
    const rng = makeRng(1337);

    for (let i = 0; i < 30; i++) {
      const action = rng() % 7;
      try {
        if (action === 0) {
          const employer = employers[rng() % employers.length];
          const payout = web3.utils.toWei(String((rng() % 5) + 1));
          await manager.createJob("ipfs://spec", payout, 300, "seeded", { from: employer });
          const jobId = Number((await manager.nextJobId()).toString()) - 1;
          activeJobs.push(jobId);
        } else if (action === 1 && activeJobs.length) {
          const jobId = activeJobs[rng() % activeJobs.length];
          const agent = agents[rng() % agents.length];
          await manager.applyForJob(jobId, "agent", [], { from: agent });
          harnessActive[agent] += 1;
        } else if (action === 2 && activeJobs.length) {
          const jobId = activeJobs[rng() % activeJobs.length];
          const core = await manager.getJobCore(jobId);
          if (core.assignedAgent !== "0x0000000000000000000000000000000000000000") {
            await manager.requestJobCompletion(jobId, "ipfs://done", { from: core.assignedAgent });
          }
        } else if (action === 3 && activeJobs.length) {
          const jobId = activeJobs[rng() % activeJobs.length];
          const val = validators[rng() % validators.length];
          await manager.validateJob(jobId, "validator", [], { from: val });
        } else if (action === 4 && activeJobs.length) {
          const jobId = activeJobs[rng() % activeJobs.length];
          await time.increase(2);
          const core = await manager.getJobCore(jobId);
          await manager.finalizeJob(jobId, { from: core.employer });
          if (core.assignedAgent !== "0x0000000000000000000000000000000000000000") {
            harnessActive[core.assignedAgent] = Math.max(harnessActive[core.assignedAgent] - 1, 0);
          }
        } else if (action === 5 && activeJobs.length) {
          const jobId = activeJobs[rng() % activeJobs.length];
          const core = await manager.getJobCore(jobId);
          if (core.assignedAgent === "0x0000000000000000000000000000000000000000") {
            await manager.cancelJob(jobId, { from: core.employer });
          }
        } else if (action === 6 && activeJobs.length) {
          const jobId = activeJobs[rng() % activeJobs.length];
          const core = await manager.getJobCore(jobId);
          if (core.assignedAgent !== "0x0000000000000000000000000000000000000000") {
            await time.increase(301);
            await manager.expireJob(jobId, { from: owner });
            harnessActive[core.assignedAgent] = Math.max(harnessActive[core.assignedAgent] - 1, 0);
          }
        }
      } catch (_) {
        // Expected: deterministic adversarial runner intentionally probes invalid transitions.
      }

      await assertInvariants(manager, token, harnessActive);
    }
  });
});
