const assert = require("assert");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { namehash, setNameWrapperOwnership, setResolverOwnership } = require("./helpers/ens");
const { expectRevert } = require("@openzeppelin/test-helpers");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager alpha namespace gating", (accounts) => {
  const [owner, employer, agent, validator, outsider] = accounts;
  let token;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let clubRoot;
  let clubRootAlpha;
  let agentRoot;
  let agentRootAlpha;
  let agiTypeNft;

  const payout = toBN(toWei("10"));

  async function createJob(target = manager) {
    await token.mint(employer, payout, { from: owner });
    await token.approve(target.address, payout, { from: employer });
    const tx = await target.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    return tx.logs[0].args.jobId.toNumber();
  }

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    clubRoot = namehash("club.agi.eth");
    clubRootAlpha = namehash("alpha.club.agi.eth");
    agentRoot = namehash("agent.agi.eth");
    agentRootAlpha = namehash("alpha.agent.agi.eth");

    manager = await AGIJobManager.new(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      clubRoot,
      agentRoot,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );
    await manager.setAlphaRootNodes(clubRootAlpha, agentRootAlpha, { from: owner });

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    agiTypeNft = await MockERC721.new({ from: owner });
    await manager.addAGIType(agiTypeNft.address, 1, { from: owner });
    await agiTypeNft.mint(agent, { from: owner });
  });

  it("authorizes an agent via NameWrapper ownership under agent root", async () => {
    const jobId = await createJob();
    await setNameWrapperOwnership(nameWrapper, agentRoot, "helper", agent);

    const tx = await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    const appliedEvent = tx.logs.find((log) => log.event === "JobApplied");
    assert.ok(appliedEvent, "JobApplied should be emitted");

    const job = await manager.jobs(jobId);
    assert.equal(job.assignedAgent, agent, "agent should be assigned");
  });

  it("authorizes an agent via NameWrapper ownership under alpha.agent root", async () => {
    const jobId = await createJob();
    await setNameWrapperOwnership(nameWrapper, agentRootAlpha, "helper", agent);

    const tx = await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    const appliedEvent = tx.logs.find((log) => log.event === "JobApplied");
    assert.ok(appliedEvent, "JobApplied should be emitted");

    const job = await manager.jobs(jobId);
    assert.equal(job.assignedAgent, agent, "agent should be assigned");
  });

  it("authorizes a validator via ENS resolver addr under club root", async () => {
    const jobId = await createJob();
    await setNameWrapperOwnership(nameWrapper, agentRoot, "helper", agent);
    await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await setResolverOwnership(ens, resolver, clubRoot, "alice", validator);

    const tx = await manager.validateJob(jobId, "alice", EMPTY_PROOF, { from: validator });
    const validatedEvent = tx.logs.find((log) => log.event === "JobValidated");
    const completedEvent = tx.logs.find((log) => log.event === "JobCompleted");
    assert.ok(validatedEvent, "JobValidated should be emitted");
    assert.ok(completedEvent, "JobCompleted should be emitted when approvals threshold met");

    const status = await manager.getJobStatus(jobId);
    const completed = status.completed ?? status[0];
    assert.equal(completed, true, "job should be completed");
  });

  it("authorizes a validator via ENS resolver addr under alpha.club root", async () => {
    const jobId = await createJob();
    await setNameWrapperOwnership(nameWrapper, agentRootAlpha, "helper", agent);
    await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await setResolverOwnership(ens, resolver, clubRootAlpha, "alice", validator);

    const tx = await manager.validateJob(jobId, "alice", EMPTY_PROOF, { from: validator });
    const validatedEvent = tx.logs.find((log) => log.event === "JobValidated");
    const completedEvent = tx.logs.find((log) => log.event === "JobCompleted");
    assert.ok(validatedEvent, "JobValidated should be emitted");
    assert.ok(completedEvent, "JobCompleted should be emitted when approvals threshold met");

    const status = await manager.getJobStatus(jobId);
    const completed = status.completed ?? status[0];
    assert.equal(completed, true, "job should be completed");
  });

  it("accepts merkle allowlist proofs for agent and validator roles", async () => {
    const leaf = Buffer.from(
      web3.utils.soliditySha3({ type: "address", value: agent }).slice(2),
      "hex"
    );
    const validatorLeaf = Buffer.from(
      web3.utils.soliditySha3({ type: "address", value: validator }).slice(2),
      "hex"
    );
    const agentTree = new MerkleTree([leaf], keccak256, { sortPairs: true });
    const validatorTree = new MerkleTree([validatorLeaf], keccak256, { sortPairs: true });

    const allowlistManager = await AGIJobManager.new(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      clubRoot,
      agentRoot,
      validatorTree.getHexRoot(),
      agentTree.getHexRoot(),
      { from: owner }
    );
    await allowlistManager.setAlphaRootNodes(clubRootAlpha, agentRootAlpha, { from: owner });
    await allowlistManager.setRequiredValidatorApprovals(1, { from: owner });
    await allowlistManager.addAGIType(agiTypeNft.address, 1, { from: owner });

    const jobId = await createJob(allowlistManager);
    await allowlistManager.applyForJob(
      jobId,
      "allowlisted",
      agentTree.getHexProof(leaf),
      { from: agent }
    );
    await allowlistManager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await allowlistManager.validateJob(
      jobId,
      "allowlisted",
      validatorTree.getHexProof(validatorLeaf),
      { from: validator }
    );
  });

  it("rejects unauthorized agents with no allowlist or ENS ownership", async () => {
    const jobId = await createJob();
    await expectRevert.unspecified(
      manager.applyForJob(jobId, "intruder", EMPTY_PROOF, { from: outsider })
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
