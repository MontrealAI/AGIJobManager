const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const { namehash, subnode, setNameWrapperOwnership, setResolverOwnership } = require("./helpers/ens");
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
  let alphaClubRoot;
  let agentRoot;
  let alphaAgentRoot;
  let agiTypeNft;

  const payout = toBN(toWei("10"));

  async function createJob() {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    return tx.logs[0].args.jobId.toNumber();
  }

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    clubRoot = namehash("club.agi.eth");
    alphaClubRoot = namehash("alpha.club.agi.eth");
    agentRoot = namehash("agent.agi.eth");
    alphaAgentRoot = namehash("alpha.agent.agi.eth");

    manager = await AGIJobManager.new(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      clubRoot,
      alphaClubRoot,
      agentRoot,
      alphaAgentRoot,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    agiTypeNft = await MockERC721.new({ from: owner });
    await manager.addAGIType(agiTypeNft.address, 1, { from: owner });
    await agiTypeNft.mint(agent, { from: owner });
  });

  it("authorizes an agent via NameWrapper ownership under agent.agi.eth", async () => {
    const jobId = await createJob();
    await setNameWrapperOwnership(nameWrapper, agentRoot, "helper", agent);

    const tx = await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    const appliedEvent = tx.logs.find((log) => log.event === "JobApplied");
    assert.ok(appliedEvent, "JobApplied should be emitted");

    const job = await manager.jobs(jobId);
    assert.equal(job.assignedAgent, agent, "agent should be assigned");
  });

  it("authorizes an agent via NameWrapper ownership under alpha.agent.agi.eth", async () => {
    const jobId = await createJob();
    await setNameWrapperOwnership(nameWrapper, alphaAgentRoot, "helper", agent);

    const tx = await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    const appliedEvent = tx.logs.find((log) => log.event === "JobApplied");
    assert.ok(appliedEvent, "JobApplied should be emitted");

    const job = await manager.jobs(jobId);
    assert.equal(job.assignedAgent, agent, "agent should be assigned");
  });

  it("authorizes a validator via ENS resolver addr under club.agi.eth", async () => {
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

  it("authorizes a validator via ENS resolver addr under alpha.club.agi.eth", async () => {
    const jobId = await createJob();
    await setNameWrapperOwnership(nameWrapper, alphaAgentRoot, "helper", agent);
    await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

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

  it("rejects ownership under unrelated ENS roots", async () => {
    const jobId = await createJob();
    const unrelatedRoot = namehash("node.agi.eth");
    const unrelatedNode = subnode(unrelatedRoot, "helper");
    await nameWrapper.setOwner(toBN(unrelatedNode), agent, { from: owner });

    await expectRevert.unspecified(
      manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent })
    );
  });

  it("accepts Merkle proofs regardless of namespace roots", async () => {
    const agentLeaf = Buffer.from(web3.utils.soliditySha3({ type: "address", value: agent }).slice(2), "hex");
    const validatorLeaf = Buffer.from(
      web3.utils.soliditySha3({ type: "address", value: validator }).slice(2),
      "hex"
    );
    const agentTree = new MerkleTree([agentLeaf], keccak256, { sortPairs: true });
    const validatorTree = new MerkleTree([validatorLeaf], keccak256, { sortPairs: true });

    const merkleManager = await AGIJobManager.new(
      token.address,
      "ipfs://base",
      ens.address,
      nameWrapper.address,
      clubRoot,
      alphaClubRoot,
      agentRoot,
      alphaAgentRoot,
      validatorTree.getHexRoot(),
      agentTree.getHexRoot(),
      { from: owner }
    );

    await merkleManager.setRequiredValidatorApprovals(1, { from: owner });
    const merkleAgiType = await MockERC721.new({ from: owner });
    await merkleAgiType.mint(agent, { from: owner });
    await merkleManager.addAGIType(merkleAgiType.address, 1, { from: owner });

    await token.mint(employer, payout, { from: owner });
    await token.approve(merkleManager.address, payout, { from: employer });
    const tx = await merkleManager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    const jobId = tx.logs[0].args.jobId.toNumber();

    await merkleManager.applyForJob(jobId, "helper", agentTree.getHexProof(agentLeaf), { from: agent });
    await merkleManager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await merkleManager.validateJob(
      jobId,
      "alice",
      validatorTree.getHexProof(validatorLeaf),
      { from: validator }
    );

    const status = await merkleManager.getJobStatus(jobId);
    const completed = status.completed ?? status[0];
    assert.equal(completed, true, "job should be completed via Merkle allowlist");
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
