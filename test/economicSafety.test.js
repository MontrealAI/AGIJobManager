const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { time } = require("@openzeppelin/test-helpers");
const { rootNode, setNameWrapperOwnership } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");
const { buildInitConfig } = require("./helpers/deploy");
const { fundValidators } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

async function configureManager(manager, owner) {
  await manager.setAgentBondParams(0, 0, 0, { from: owner });
  await manager.setMaxActiveJobsPerAgent(50, { from: owner });
}

contract("AGIJobManager economic safety", (accounts) => {
  const [owner, employer, agent, validator] = accounts;
  let token;
  let ens;
  let nameWrapper;
  let clubRoot;
  let agentRoot;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    clubRoot = rootNode("club-root");
    agentRoot = rootNode("agent-root");
  });

  it("prevents adding or updating AGI types that exceed payout headroom", async () => {
    const manager = await AGIJobManager.new(...buildInitConfig(
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
    await configureManager(manager, owner);
    await configureManager(manager, owner);

    await manager.setValidationRewardPercentage(40, { from: owner });

    const agiType = await MockERC721.new({ from: owner });
    await expectCustomError(manager.addAGIType.call(agiType.address, 61, { from: owner }), "InvalidParameters");

    await manager.addAGIType(agiType.address, 50, { from: owner });
    await expectCustomError(manager.addAGIType.call(agiType.address, 70, { from: owner }), "InvalidParameters");
  });

  it("prevents validation reward updates that exceed configured max agent payout", async () => {
    const manager = await AGIJobManager.new(...buildInitConfig(
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
    await configureManager(manager, owner);

    const agiType = await MockERC721.new({ from: owner });
    await manager.addAGIType(agiType.address, 75, { from: owner });
    await expectCustomError(manager.setValidationRewardPercentage.call(30, { from: owner }), "InvalidParameters");
  });

  it("ignores additional agent payout settings when validating reward headroom", async () => {
    const manager = await AGIJobManager.new(...buildInitConfig(
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
    await configureManager(manager, owner);

    await manager.setAdditionalAgentPayoutPercentage(90, { from: owner });
    await manager.setValidationRewardPercentage(90, { from: owner });
    assert.equal((await manager.validationRewardPercentage()).toString(), "90");
  });

  it("settles successfully with safe payout configuration", async () => {
    const manager = await AGIJobManager.new(...buildInitConfig(
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
    await configureManager(manager, owner);

    await manager.setValidationRewardPercentage(10, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 80, { from: owner });

    await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator", validator);
    await fundValidators(token, manager, [validator], owner);

    const payout = toBN(toWei("10"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs-job", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });
    const validatorBefore = await token.balanceOf(validator);
    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await time.increase(2);
    await manager.finalizeJob(jobId, { from: employer });

    const agentBalance = await token.balanceOf(agent);
    const validatorBalance = await token.balanceOf(validator);
    const contractBalance = await token.balanceOf(manager.address);
    const expectedAgentPayout = payout.muln(80).divn(100);
    const expectedValidatorPayout = payout.muln(10).divn(100);

    assert.equal(agentBalance.toString(), expectedAgentPayout.toString());
    assert.equal(validatorBalance.sub(validatorBefore).toString(), expectedValidatorPayout.toString());
    assert.equal(contractBalance.toString(), payout.sub(expectedAgentPayout).sub(expectedValidatorPayout).toString());
  });

  it("reverts job completion requests when completion metadata is empty (defensive)", async () => {
    const manager = await AGIJobManager.new(...buildInitConfig(
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

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 80, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });

    const payout = toBN(toWei("1"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs-job", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });

    await expectCustomError(
      manager.requestJobCompletion.call(jobId, "", { from: agent }),
      "InvalidParameters"
    );
  });
});
