const assert = require("assert");
const { expectRevert, time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const AGIJobPages = artifacts.require("AGIJobPages");
const MockENSJobPagesMalformed = artifacts.require("MockENSJobPagesMalformed");
const MockERC20 = artifacts.require("MockERC20");
const MockENS = artifacts.require("MockENS");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");
const MockHookCaller = artifacts.require("MockHookCaller");

const { rootNode } = require("./helpers/ens");
const { buildInitConfig } = require("./helpers/deploy");
const { fundValidators, fundAgents } = require("./helpers/bonds");

const ZERO_ROOT = "0x" + "00".repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract("AGIJobManager metadata routing", (accounts) => {
  const [owner, employer, agent, validator] = accounts;
  let token;
  let manager;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(...buildInitConfig(
      token.address,
      "ipfs://base/",
      ens.address,
      nameWrapper.address,
      rootNode("club-root"),
      rootNode("agent-root"),
      rootNode("club-root"),
      rootNode("agent-root"),
      ZERO_ROOT,
      ZERO_ROOT,
    ), { from: owner });


    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 92, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });
    await fundValidators(token, manager, [validator], owner);
    await fundAgents(token, manager, [agent], owner);
  });

  async function completeJob(completionUri) {
    const payout = toBN(toWei("10"));
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    const tx = await manager.createJob("ipfs-job", payout, 3600, "details", { from: employer });
    const jobId = tx.logs.find((l) => l.event === "JobCreated").args.jobId.toNumber();
    await manager.applyForJob(jobId, "agent", EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, completionUri, { from: agent });
    await manager.validateJob(jobId, "validator", EMPTY_PROOF, { from: validator });
    await time.increase(2);
    const finalizeTx = await manager.finalizeJob(jobId, { from: employer });
    const tokenId = finalizeTx.logs.find((l) => l.event === "NFTIssued").args.tokenId.toNumber();
    return { jobId, tokenId };
  }

  it("uses router tokenURI when ENS routing is enabled", async () => {
    const router = await AGIJobPages.new("https://metadata.example/jobs/", "https://jobs.example", { from: owner });
    await manager.setEnsJobPages(router.address, { from: owner });
    await manager.setUseEnsJobTokenURI(true, { from: owner });

    const { tokenId } = await completeJob("ipfs-fallback-uri");
    const tokenUri = await manager.tokenURI(tokenId);
    assert.equal(tokenUri, "https://metadata.example/jobs/0.json", "router URI should be used");
  });

  it("falls back to jobCompletionURI when router returns malformed data", async () => {
    const malformed = await MockENSJobPagesMalformed.new({ from: owner });
    await malformed.setTokenURIBytes("0x1234", { from: owner });
    await manager.setEnsJobPages(malformed.address, { from: owner });
    await manager.setUseEnsJobTokenURI(true, { from: owner });

    const { tokenId } = await completeJob("ipfs-fallback-uri");
    const tokenUri = await manager.tokenURI(tokenId);
    assert.equal(tokenUri, "ipfs://base/ipfs-fallback-uri", "must fall back to completion URI");
  });

  it("router handleHook authorizes only configured job manager and preview matches selector output", async () => {
    const router = await AGIJobPages.new("ipfs://folder/", "", { from: owner });
    const preview = await router.previewTokenURI(42);
    assert.equal(preview, "ipfs://folder/42.json", "preview should resolve deterministic URI");

    const selectorCall = await web3.eth.call({
      to: router.address,
      data: "0x751809b4" + web3.eth.abi.encodeParameter("uint256", "42").slice(2),
    });
    const decoded = web3.eth.abi.decodeParameter("string", selectorCall);
    assert.equal(decoded, preview, "fallback selector result should match preview");

    await expectRevert.unspecified(router.handleHook(1, 42, { from: owner }));
    const hookCaller = await MockHookCaller.new({ from: owner });
    await router.setJobManager(hookCaller.address, { from: owner });
    await hookCaller.callHandleHook(router.address, 1, 42, { from: owner });
    await hookCaller.callHandleHook(router.address, 255, 42, { from: owner });
  });
});
