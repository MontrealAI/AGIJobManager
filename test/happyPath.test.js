const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const { rootNode, setNameWrapperOwnership } = require("./helpers/ens");
const { buildInitConfig } = require("./helpers/deploy");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager happy path", (accounts) => {
  const [owner, employer, agent, validatorA, validatorB] = accounts;
  let token;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let agiType;
  let clubRoot;
  let agentRoot;

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

    agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 92, { from: owner });

    await setNameWrapperOwnership(nameWrapper, agentRoot, "agent", agent);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator-a", validatorA);
    await setNameWrapperOwnership(nameWrapper, clubRoot, "validator-b", validatorB);

    await manager.setRequiredValidatorApprovals(2, { from: owner });
  });

  it("runs a full job lifecycle with payouts and NFT issuance", async () => {
    const payout = toBN(toWei("100"));
    await token.mint(employer, payout, { from: owner });

    await token.approve(manager.address, payout, { from: employer });
    const createTx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    const jobId = createTx.logs[0].args.jobId.toNumber();

    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-completed", { from: agent });

    await manager.validateJob(jobId, "validator-a", EMPTY_PROOF, { from: validatorA });
    const finalTx = await manager.validateJob(jobId, "validator-b", EMPTY_PROOF, { from: validatorB });

    const tokenId = 0;
    const tokenUri = await manager.tokenURI(tokenId);
    assert.equal(tokenUri, "ipfs://base/ipfs-completed", "token URI should match base + job hash");

    const ownerOfToken = await manager.ownerOf(tokenId);
    assert.equal(ownerOfToken, employer, "employer should own the NFT");

    const agentBalance = await token.balanceOf(agent);
    const agentExpected = payout.muln(92).divn(100);
    assert.equal(agentBalance.toString(), agentExpected.toString(), "agent payout should match AGIType percentage");

    const validatorReward = payout.muln(8).divn(100).divn(2);
    const validatorABalance = await token.balanceOf(validatorA);
    const validatorBBalance = await token.balanceOf(validatorB);
    assert.equal(validatorABalance.toString(), validatorReward.toString(), "validator A reward mismatch");
    assert.equal(validatorBBalance.toString(), validatorReward.toString(), "validator B reward mismatch");

    const agentReputation = await manager.reputation(agent);
    assert.ok(agentReputation.gt(toBN(0)), "agent reputation should increase");

    const jobCompletedEvent = finalTx.logs.find((log) => log.event === "JobCompleted");
    const nftIssuedEvent = finalTx.logs.find((log) => log.event === "NFTIssued");
    assert.ok(jobCompletedEvent, "JobCompleted event should be emitted");
    assert.ok(nftIssuedEvent, "NFTIssued event should be emitted");
  });
});
