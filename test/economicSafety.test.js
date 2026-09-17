const { deployActive } = require('./helpers/deploy');
const { parseUSDC: parseUSDCAmount } = require("../scripts/lib/usdc");
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
const { fundValidators, fundAgents, computeAgentBond } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN } = web3.utils;
const toWei = parseUSDCAmount;

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

  it("keeps NFT eligibility scores independent of payout headroom", async () => {
    const manager = await deployActive(AGIJobManager, ...buildInitConfig(
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

    await manager.setValidationRewardPercentage(40, { from: owner });

    const agiType = await MockERC721.new({ from: owner });
    await manager.addAGIType(agiType.address, 61, { from: owner });

    await manager.addAGIType(agiType.address, 50, { from: owner });
    await manager.addAGIType(agiType.address, 70, { from: owner });
  });

  it("rejects validator rewards above the 60% remaining budget", async () => {
    const manager = await deployActive(AGIJobManager, ...buildInitConfig(
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
    await manager.addAGIType(agiType.address, 75, { from: owner });
    await expectCustomError(manager.setValidationRewardPercentage.call(61, { from: owner }), "InvalidParameters");
  });



  it("settles successfully with safe payout configuration", async () => {
    const manager = await deployActive(AGIJobManager, ...buildInitConfig(
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

    await manager.setValidationRewardPercentage(10, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 80, { from: owner });

    await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator", validator);
    await fundValidators(token, manager, [validator], owner);
    await fundAgents(token, manager, [agent], owner);

    const payout = toBN(toWei("10"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs-job", payout, 1000, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    const agentBalanceBefore = await token.balanceOf(agent);
    const validatorBefore = await token.balanceOf(validator);
    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await time.increase(2);
    await manager.finalizeJob(jobId, { from: employer });

    const agentBalance = await token.balanceOf(agent);
    const validatorBalance = await token.balanceOf(validator);
    const contractBalance = await token.balanceOf(manager.address);
    const agentBond = await computeAgentBond(manager, payout, toBN(1000));
    const agentPayout = payout.muln(50).divn(100);
    const expectedAgentPayout = agentPayout.add(agentBond);
    const expectedValidatorPayout = payout.muln(10).divn(100);

    assert.equal(agentBalance.sub(agentBalanceBefore).toString(), expectedAgentPayout.toString());
    assert.equal(validatorBalance.sub(validatorBefore).toString(), expectedValidatorPayout.toString());
    assert.equal(contractBalance.toString(), "0");
  });

  it("reverts job completion requests when completion metadata is empty (defensive)", async () => {
    const manager = await deployActive(AGIJobManager, ...buildInitConfig(
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
    await fundAgents(token, manager, [agent], owner);

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
