const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { buildInitConfig } = require("./helpers/deploy");
const { expectCustomError } = require("./helpers/errors");
const { getJob } = require("./helpers/job");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager validation gating", (accounts) => {
  const [owner, employer, agent, validator] = accounts;
  let token;
  let manager;

  const payout = toBN(toWei("5"));

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    await MockResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner },
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 10, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });

    await token.mint(employer, payout.muln(2), { from: owner });
  });

  async function createJob() {
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    return tx.logs[0].args.jobId.toNumber();
  }

  it("blocks validation and disapproval before completion is requested", async () => {
    const jobId = await createJob();
    await manager.applyForJob(jobId, "ignored", EMPTY_PROOF, { from: agent });

    await expectCustomError(
      manager.validateJob.call(jobId, "validator", EMPTY_PROOF, { from: validator }),
      "InvalidState",
    );
    await expectCustomError(
      manager.disapproveJob.call(jobId, "validator", EMPTY_PROOF, { from: validator }),
      "InvalidState",
    );

    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    const tx = await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    const validatedEvent = tx.logs.find((log) => log.event === "JobValidated");
    assert.ok(validatedEvent, "validation should succeed after completion request");
  });

  it("permits disapproval after completion is requested", async () => {
    const jobId = await createJob();
    await manager.applyForJob(jobId, "ignored", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await manager.disapproveJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    const job = await getJob(manager, jobId);
    assert.equal(job.disputed, true, "job should be marked disputed after disapproval threshold");
  });
});
