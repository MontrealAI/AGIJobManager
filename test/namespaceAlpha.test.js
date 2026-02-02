const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { namehash, subnode, setNameWrapperOwnership, setResolverOwnership } = require("./helpers/ens");
const { AGI_TOKEN_ADDRESS, createFixedTokenManager } = require("./helpers/fixedToken");
const { expectRevert } = require("@openzeppelin/test-helpers");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager alpha namespace gating", (accounts) => {
  const [owner, employer, agent, validator, outsider] = accounts;
  let token;
  let fixedToken;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let clubRoot;
  let agentRoot;
  let agiTypeNft;

  const payout = toBN(toWei("10"));

  async function createJob() {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    return tx.logs[0].args.jobId.toNumber();
  }

  before(async () => {
    fixedToken = await createFixedTokenManager(MockERC20);
  });

  beforeEach(async () => {
    token = await fixedToken.reset();
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    clubRoot = namehash("club.agi.eth");
    agentRoot = namehash("agent.agi.eth");

    manager = await AGIJobManager.new(
      AGI_TOKEN_ADDRESS,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      clubRoot,
      agentRoot,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    agiTypeNft = await MockERC721.new({ from: owner });
    await manager.addAGIType(agiTypeNft.address, 1, { from: owner });
    await agiTypeNft.mint(agent, { from: owner });
  });

  it("authorizes an agent via NameWrapper ownership under alpha.agent", async () => {
    const jobId = await createJob();
    const alphaAgentRoot = namehash("alpha.agent.agi.eth");
    await setNameWrapperOwnership(nameWrapper, alphaAgentRoot, "helper", agent);

    const tx = await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    const appliedEvent = tx.logs.find((log) => log.event === "JobApplied");
    assert.ok(appliedEvent, "JobApplied should be emitted");

    const job = await manager.jobs(jobId);
    assert.equal(job.assignedAgent, agent, "agent should be assigned");
  });

  it("authorizes a validator via ENS resolver addr under alpha.club", async () => {
    const jobId = await createJob();
    await setNameWrapperOwnership(nameWrapper, agentRoot, "helper", agent);
    await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    const alphaClubRoot = namehash("alpha.club.agi.eth");
    await setResolverOwnership(ens, resolver, alphaClubRoot, "alice", validator);

    const tx = await manager.validateJob(jobId, "alice", EMPTY_PROOF, { from: validator });
    const validatedEvent = tx.logs.find((log) => log.event === "JobValidated");
    const completedEvent = tx.logs.find((log) => log.event === "JobCompleted");
    assert.ok(validatedEvent, "JobValidated should be emitted");
    assert.ok(completedEvent, "JobCompleted should be emitted when approvals threshold met");

    const status = await manager.getJobStatus(jobId);
    const completed = status.completed ?? status[0];
    assert.equal(completed, true, "job should be completed");
  });

  it("rejects unauthorized agents with no allowlist or ENS ownership", async () => {
    const jobId = await createJob();
    await expectRevert.unspecified(
      manager.applyForJob(jobId, "intruder", EMPTY_PROOF, { from: outsider })
    );
  });

  it("accepts envless club/agent ownership in addition to alpha", async () => {
    const jobId = await createJob();
    await setNameWrapperOwnership(nameWrapper, agentRoot, "helper", agent);

    await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await setResolverOwnership(ens, resolver, clubRoot, "alice", validator);
    const tx = await manager.validateJob(jobId, "alice", EMPTY_PROOF, { from: validator });
    const completedEvent = tx.logs.find((log) => log.event === "JobCompleted");
    assert.ok(completedEvent, "envless validator should complete job");
  });

  it("rejects unrelated ENS roots", async () => {
    const jobId = await createJob();
    const unrelatedRoot = namehash("agent.other.eth");
    const nonAlphaNode = subnode(unrelatedRoot, "helper");
    await nameWrapper.setOwner(toBN(nonAlphaNode), agent, { from: owner });

    await expectRevert.unspecified(
      manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent })
    );
  });

  it("allows additionalAgents/additionalValidators bypass", async () => {
    const jobId = await createJob();

    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });

    await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    const tx = await manager.validateJob(jobId, "alice", EMPTY_PROOF, { from: validator });

    const validatedEvent = tx.logs.find((log) => log.event === "JobValidated");
    assert.ok(validatedEvent, "JobValidated should be emitted for allowlisted validator");
  });
});
