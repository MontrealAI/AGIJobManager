const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { rootNode, setNameWrapperOwnership } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");
const { fundValidators, fundAgents, computeAgentBond } = require("./helpers/bonds");
const { time } = require("@openzeppelin/test-helpers");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager agent payout snapshots", (accounts) => {
  const [owner, employer, agent, validator, other] = accounts;
  let token;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let clubRoot;
  let agentRoot;

  const createJob = async (payout) => {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const receipt = await manager.createJob("ipfs", payout, 1000, "details", { from: employer });
    return receipt.logs[0].args.jobId.toNumber();
  };

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    clubRoot = rootNode("club-root");
    agentRoot = rootNode("agent-root");

    manager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        "ipfs://base",
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        clubRoot,
        agentRoot,
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator", validator);
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });

    await fundValidators(token, manager, [validator], owner);
    await fundAgents(token, manager, [agent, other], owner);
  });

  it("rejects agents with a 0% payout tier", async () => {
    const payout = toBN(toWei("100"));
    const jobId = await createJob(payout);

    await expectCustomError(
      manager.applyForJob.call(jobId, "agent", EMPTY_PROOF, { from: agent }),
      "IneligibleAgentPayout"
    );
  });

  it("snapshots payout to prevent selling NFTs after assignment", async () => {
    const payout = toBN(toWei("100"));
    const jobId = await createJob(payout);

    const agiType = await MockERC721.new({ from: owner });
    const tokenId = await agiType.mint.call(agent, { from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 75, { from: owner });

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    const job = await manager.getJobCore(jobId);
    const snapshotPct = job[8];
    assert.strictEqual(snapshotPct.toNumber(), 75);

    await agiType.transferFrom(agent, other, tokenId, { from: agent });
    const agentBalanceBefore = await token.balanceOf(agent);

    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await time.increase(2);
    await manager.finalizeJob(jobId, { from: employer });

    const agentBalanceAfter = await token.balanceOf(agent);
    const agentBond = await computeAgentBond(manager, payout, 1000);
    const expected = payout.muln(75).divn(100).add(agentBond);
    assert.equal(agentBalanceAfter.sub(agentBalanceBefore).toString(), expected.toString());
  });

  it("snapshots payout to prevent buying NFTs after assignment", async () => {
    const payout = toBN(toWei("100"));
    const jobId = await createJob(payout);

    const agiType25 = await MockERC721.new({ from: owner });
    await agiType25.mint(agent, { from: owner });
    await manager.addAGIType(agiType25.address, 25, { from: owner });

    const agiType75 = await MockERC721.new({ from: owner });
    await manager.addAGIType(agiType75.address, 75, { from: owner });

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    const job = await manager.getJobCore(jobId);
    const snapshotPct = job[8];
    assert.strictEqual(snapshotPct.toNumber(), 25);

    await agiType75.mint(agent, { from: owner });
    const agentBalanceBefore = await token.balanceOf(agent);

    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await time.increase(2);
    await manager.finalizeJob(jobId, { from: employer });

    const agentBalanceAfter = await token.balanceOf(agent);
    const agentBond = await computeAgentBond(manager, payout, 1000);
    const expected = payout.muln(25).divn(100).add(agentBond);
    assert.equal(agentBalanceAfter.sub(agentBalanceBefore).toString(), expected.toString());
  });

  it("rejects additional agents without a payout tier", async () => {
    const payout = toBN(toWei("100"));
    const jobId = await createJob(payout);

    await manager.addAdditionalAgent(agent, { from: owner });

    await expectCustomError(
      manager.applyForJob.call(jobId, "agent", EMPTY_PROOF, { from: agent }),
      "IneligibleAgentPayout"
    );
  });

  it("snapshots payout for additional agents after assignment", async () => {
    const payout = toBN(toWei("100"));
    const jobId = await createJob(payout);

    const agiType = await MockERC721.new({ from: owner });
    const tokenId = await agiType.mint.call(agent, { from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 60, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });

    await manager.applyForJob(jobId, "", EMPTY_PROOF, { from: agent });
    const job = await manager.getJobCore(jobId);
    const snapshotPct = job[8];
    assert.strictEqual(snapshotPct.toNumber(), 60);

    await agiType.transferFrom(agent, other, tokenId, { from: agent });
    const agentBalanceBefore = await token.balanceOf(agent);

    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await time.increase(2);
    await manager.finalizeJob(jobId, { from: employer });

    const agentBalanceAfter = await token.balanceOf(agent);
    const agentBond = await computeAgentBond(manager, payout, 1000);
    const expected = payout.muln(60).divn(100).add(agentBond);
    assert.equal(agentBalanceAfter.sub(agentBalanceBefore).toString(), expected.toString());
  });
});
