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
const { buildInitConfig } = require("./helpers/deploy");
const { fundValidators } = require("./helpers/bonds");
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
  let agentRoot;
  let alphaClubRoot;
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
    agentRoot = namehash("agent.agi.eth");
    alphaClubRoot = namehash("alpha.club.agi.eth");
    alphaAgentRoot = namehash("alpha.agent.agi.eth");

    manager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        alphaClubRoot,
        alphaAgentRoot,
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    agiTypeNft = await MockERC721.new({ from: owner });
    await manager.addAGIType(agiTypeNft.address, 1, { from: owner });
    await agiTypeNft.mint(agent, { from: owner });

    await fundValidators(token, manager, [validator], owner);
  });

  it("authorizes an agent via NameWrapper ownership under alpha.agent", async () => {
    const jobId = await createJob();
    await setNameWrapperOwnership(nameWrapper, alphaAgentRoot, "helper", agent);

    const tx = await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    const appliedEvent = tx.logs.find((log) => log.event === "JobApplied");
    assert.ok(appliedEvent, "JobApplied should be emitted");

    const job = await manager.getJobCore(jobId);
    assert.equal(job.assignedAgent, agent, "agent should be assigned");
  });

  it("authorizes a validator via ENS resolver addr under alpha.club", async () => {
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

    const job = await manager.getJobCore(jobId);
    assert.equal(job.completed, true, "job should be completed");
  });

  it("authorizes base namespaces for agent and validator", async () => {
    const jobId = await createJob();
    await setNameWrapperOwnership(nameWrapper, agentRoot, "helper", agent);
    await manager.applyForJob(jobId, "helper", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });

    await setResolverOwnership(ens, resolver, clubRoot, "alice", validator);
    const tx = await manager.validateJob(jobId, "alice", EMPTY_PROOF, { from: validator });
    const validatedEvent = tx.logs.find((log) => log.event === "JobValidated");
    assert.ok(validatedEvent, "JobValidated should be emitted for base club");
  });

  it("rejects unauthorized agents with no allowlist or ENS ownership", async () => {
    const jobId = await createJob();
    await expectRevert.unspecified(
      manager.applyForJob(jobId, "intruder", EMPTY_PROOF, { from: outsider })
    );
  });

  it("rejects ownership outside the configured base/alpha namespaces", async () => {
    const jobId = await createJob();
    const otherRoot = namehash("other.agent.agi.eth");
    const nonAlphaNode = subnode(otherRoot, "helper");
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

  it("accepts Merkle allowlist proofs regardless of namespace roots", async () => {
    const leafFor = (addr) => web3.utils.soliditySha3({ type: "address", value: addr });
    const leaves = [agent, validator].map((addr) => Buffer.from(leafFor(addr).slice(2), "hex"));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const agentLeaf = Buffer.from(leafFor(agent).slice(2), "hex");
    const validatorLeaf = Buffer.from(leafFor(validator).slice(2), "hex");

    const merkleManager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        alphaClubRoot,
        alphaAgentRoot,
        tree.getHexRoot(),
        tree.getHexRoot(),
      ),
      { from: owner }
    );

    await merkleManager.addAGIType(agiTypeNft.address, 1, { from: owner });
    await merkleManager.setRequiredValidatorApprovals(1, { from: owner });
    await token.mint(employer, payout, { from: owner });
    await token.approve(merkleManager.address, payout, { from: employer });
    await fundValidators(token, merkleManager, [validator], owner);
    const jobId = (await merkleManager.nextJobId()).toNumber();
    await merkleManager.createJob("ipfs-job", payout, 3600, "details", { from: employer });

    await merkleManager.applyForJob(jobId, "helper", tree.getHexProof(agentLeaf), { from: agent });
    await merkleManager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await merkleManager.validateJob(jobId, "alice", tree.getHexProof(validatorLeaf), { from: validator });
  });
});
