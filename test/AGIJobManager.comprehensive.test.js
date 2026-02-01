const { expectEvent, expectRevert, BN, time } = require("@openzeppelin/test-helpers");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const { expectCustomError } = require("./helpers/errors");
const { rootNode, setNameWrapperOwnership, setResolverOwnership } = require("./helpers/ens");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const FailingERC20 = artifacts.require("FailingERC20");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC721 = artifacts.require("MockERC721");

const toWei = (value) => web3.utils.toWei(value.toString());

const leafFor = (address) =>
  Buffer.from(web3.utils.soliditySha3({ type: "address", value: address }).slice(2), "hex");

const buildTree = (addresses) => {
  const leaves = addresses.map(leafFor);
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return {
    tree,
    root: tree.getHexRoot(),
    proofFor: (address) => tree.getHexProof(leafFor(address)),
  };
};

contract("AGIJobManager comprehensive suite", (accounts) => {
  const [
    owner,
    employer,
    agent,
    validatorOne,
    validatorTwo,
    validatorThree,
    validatorFour,
    buyer,
    moderator,
    outsider,
  ] = accounts;

  const baseIpfsUrl = "ipfs://base";
  const jobIpfs = "QmJobHash";
  const updatedIpfs = "QmJobHashUpdated";
  const jobDetails = "Do the thing";
  const payout = new BN(toWei("1000"));
  const duration = new BN("5000");

  let token;
  let manager;
  let ens;
  let resolver;
  let nameWrapper;
  let agiTypeNft;
  let agentTree;
  let validatorTree;
  let clubRoot;
  let agentRoot;

  const approveToken = async (holder, amount = payout) => {
    await token.approve(manager.address, amount, { from: holder });
  };

  const createJob = async (from = employer, jobPayout = payout, jobDuration = duration, hash = jobIpfs) => {
    await approveToken(from, jobPayout);
    return manager.createJob(hash, jobPayout, jobDuration, jobDetails, { from });
  };

  const assignAgentWithProof = async (jobId, selectedAgent = agent) =>
    manager.applyForJob(jobId, "agent", agentTree.proofFor(selectedAgent), { from: selectedAgent });

  const validateWithProof = async (jobId, validator) =>
    manager.validateJob(jobId, "validator", validatorTree.proofFor(validator), { from: validator });

  beforeEach(async () => {
    token = await MockERC20.new();
    ens = await MockENS.new();
    resolver = await MockResolver.new();
    nameWrapper = await MockNameWrapper.new();
    agiTypeNft = await MockERC721.new();

    agentTree = buildTree([agent, validatorFour]);
    validatorTree = buildTree([validatorOne, validatorTwo, validatorThree]);
    clubRoot = rootNode("club");
    agentRoot = rootNode("agent");

    manager = await AGIJobManager.new(
      token.address,
      baseIpfsUrl,
      ens.address,
      nameWrapper.address,
      clubRoot,
      agentRoot,
      validatorTree.root,
      agentTree.root
    );

    await token.mint(employer, payout.muln(5));
    await token.mint(agent, payout);
    await token.mint(buyer, payout);
    await token.mint(owner, payout);

    await manager.addModerator(moderator, { from: owner });
    await manager.addAGIType(agiTypeNft.address, 1, { from: owner });
    await agiTypeNft.mint(agent);
  });

  describe("deployment & initialization", () => {
    it("deploys with expected constructor configuration", async () => {
      const agiTokenAddress = await manager.agiToken();
      assert.equal(agiTokenAddress, token.address);
      assert.equal(await manager.requiredValidatorApprovals(), "3");
      assert.equal(await manager.requiredValidatorDisapprovals(), "3");
      assert.equal(await manager.validationRewardPercentage(), "8");
      assert.equal(await manager.maxJobPayout(), toWei("4888"));
      assert.equal(await manager.jobDurationLimit(), "10000000");
      assert.equal(await manager.owner(), owner);
      assert.equal(await manager.name(), "AGIJobs");
      assert.equal(await manager.symbol(), "Job");
    });

    it("pauses and unpauses owner-only", async () => {
      await expectRevert(manager.pause({ from: outsider }), "Ownable: caller is not the owner");
      await manager.pause({ from: owner });
      await expectRevert(
        manager.createJob(jobIpfs, payout, duration, jobDetails, { from: employer }),
        "Pausable: paused"
      );
      const status = await manager.getJobStatus(0);
      assert.equal(status[0], false);
      assert.equal(status[1], false);
      await manager.unpause({ from: owner });
      await approveToken(employer);
      await manager.createJob(jobIpfs, payout, duration, jobDetails, { from: employer });
    });
  });

  describe("job lifecycle (happy path)", () => {
    it("escrows payout, assigns agent, completes with validator approvals and payouts", async () => {
      await manager.addAGIType(agiTypeNft.address, 80, { from: owner });
      await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);

      const creation = await createJob();
      expectEvent(creation, "JobCreated", {
        jobId: new BN(0),
        jobSpecURI: jobIpfs,
        payout,
        duration,
        details: jobDetails,
      });
      const contractBalance = await token.balanceOf(manager.address);
      assert.equal(contractBalance.toString(), payout.toString());

      const applyReceipt = await assignAgentWithProof(0);
      expectEvent(applyReceipt, "JobApplied", { jobId: new BN(0), agent });
      const job = await manager.jobs(0);
      assert.equal(job.assignedAgent, agent);
      assert.isTrue(new BN(job.assignedAt).gt(new BN(0)));

      const completion = await manager.requestJobCompletion(0, updatedIpfs, { from: agent });
      expectEvent(completion, "JobCompletionRequested", { jobId: new BN(0), agent, jobCompletionURI: updatedIpfs });
      const status = await manager.getJobStatus(0);
      assert.equal(status[1], true);
      const completionJob = await manager.jobs(0);
      assert.equal(completionJob.jobCompletionURI, updatedIpfs);

      const validatorOneBalanceBefore = await token.balanceOf(validatorOne);
      const validatorTwoBalanceBefore = await token.balanceOf(validatorTwo);
      const validatorThreeBalanceBefore = await token.balanceOf(validatorThree);
      const agentBalanceBefore = await token.balanceOf(agent);

      await validateWithProof(0, validatorOne);
      await validateWithProof(0, validatorTwo);
      const completionReceipt = await validateWithProof(0, validatorThree);
      expectEvent(completionReceipt, "JobCompleted", { jobId: new BN(0), agent });

      const finalJob = await manager.jobs(0);
      assert.equal(finalJob.completed, true);

      const validatorPayoutTotal = payout.muln(8).divn(100);
      const validatorPayoutEach = validatorPayoutTotal.divn(3);
      const agentPayout = payout.muln(92).divn(100);

      const agentBalanceAfter = await token.balanceOf(agent);
      const validatorOneBalanceAfter = await token.balanceOf(validatorOne);
      const validatorTwoBalanceAfter = await token.balanceOf(validatorTwo);
      const validatorThreeBalanceAfter = await token.balanceOf(validatorThree);

      assert.equal(agentBalanceAfter.sub(agentBalanceBefore).toString(), agentPayout.toString());
      assert.equal(
        validatorOneBalanceAfter.sub(validatorOneBalanceBefore).toString(),
        validatorPayoutEach.toString()
      );
      assert.equal(
        validatorTwoBalanceAfter.sub(validatorTwoBalanceBefore).toString(),
        validatorPayoutEach.toString()
      );
      assert.equal(
        validatorThreeBalanceAfter.sub(validatorThreeBalanceBefore).toString(),
        validatorPayoutEach.toString()
      );

      const tokenId = await manager.nextTokenId();
      const mintedTokenId = tokenId.subn(1);
      assert.equal(await manager.ownerOf(mintedTokenId), employer);
      assert.equal(await manager.tokenURI(mintedTokenId), `${baseIpfsUrl}/${updatedIpfs}`);
      const agentReputation = await manager.reputation(agent);
      assert.isTrue(agentReputation.gt(new BN(0)));
      const validatorReputation = await manager.reputation(validatorOne);
      assert.isTrue(validatorReputation.gt(new BN(0)));
    });

    it("allows requestJobCompletion only by assigned agent within duration", async () => {
      await createJob();
      await assignAgentWithProof(0);
      await expectCustomError(
        manager.requestJobCompletion.call(0, updatedIpfs, { from: employer }),
        "NotAuthorized"
      );

      await time.increase(duration.addn(1));
      await expectCustomError(
        manager.requestJobCompletion.call(0, updatedIpfs, { from: agent }),
        "InvalidState"
      );
    });
  });

  describe("hardening protections", () => {
    it("reverts for phantom job ids", async () => {
      await expectCustomError(manager.applyForJob.call(123, "agent", [], { from: agent }), "JobNotFound");
      await expectCustomError(
        manager.validateJob.call(123, "validator", [], { from: validatorOne }),
        "JobNotFound"
      );
      await expectCustomError(
        manager.disapproveJob.call(123, "validator", [], { from: validatorOne }),
        "JobNotFound"
      );
      await expectCustomError(manager.disputeJob.call(123, { from: employer }), "JobNotFound");
      await expectCustomError(manager.cancelJob.call(123, { from: employer }), "JobNotFound");
      await expectCustomError(manager.delistJob.call(123, { from: owner }), "JobNotFound");
    });

    it("prevents double completion and late validations", async () => {
      await manager.addAdditionalAgent(agent, { from: owner });
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);

      await createJob();
      await manager.applyForJob(0, "agent", [], { from: agent });
      await manager.validateJob(0, "validator", [], { from: validatorOne });

      await expectCustomError(
        manager.validateJob.call(0, "validator", [], { from: validatorOne }),
        "InvalidState"
      );
      await expectCustomError(
        manager.disapproveJob.call(0, "validator", [], { from: validatorOne }),
        "InvalidState"
      );
      await expectCustomError(manager.disputeJob.call(0, { from: employer }), "InvalidState");
    });

    it("blocks dispute resolution after validator-driven completion", async () => {
      await manager.addAdditionalAgent(agent, { from: owner });
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);

      await createJob();
      await manager.applyForJob(0, "agent", [], { from: agent });
      await manager.validateJob(0, "validator", [], { from: validatorOne });

      const tokenIdAfterCompletion = await manager.nextTokenId();
      await expectCustomError(
        manager.resolveDispute.call(0, "agent win", { from: moderator }),
        "InvalidState"
      );
      await expectCustomError(manager.disputeJob.call(0, { from: employer }), "InvalidState");
      assert.equal((await manager.nextTokenId()).toString(), tokenIdAfterCompletion.toString());
    });

    it("marks employer-win disputes as completed to block future payouts", async () => {
      await manager.addAdditionalAgent(agent, { from: owner });
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await manager.setRequiredValidatorApprovals(1, { from: owner });

      await createJob();
      await manager.applyForJob(0, "agent", [], { from: agent });
      await manager.disputeJob(0, { from: employer });

      const employerBalanceBefore = await token.balanceOf(employer);
      await manager.resolveDispute(0, "employer win", { from: moderator });
      const employerBalanceAfter = await token.balanceOf(employer);

      assert.equal(employerBalanceAfter.sub(employerBalanceBefore).toString(), payout.toString());

      const job = await manager.jobs(0);
      assert.equal(job.completed, true);
      await expectCustomError(
        manager.validateJob.call(0, "validator", [], { from: validatorOne }),
        "InvalidState"
      );
      await expectCustomError(
        manager.resolveDispute.call(0, "agent win", { from: moderator }),
        "InvalidState"
      );
    });

    it("completes without validators (no division by zero)", async () => {
      await manager.addAdditionalAgent(agent, { from: owner });
      await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);

      await createJob();
      await manager.applyForJob(0, "agent", [], { from: agent });
      await manager.disputeJob(0, { from: agent });

      const agentBalanceBefore = await token.balanceOf(agent);
      await manager.resolveDispute(0, "agent win", { from: moderator });
      const agentBalanceAfter = await token.balanceOf(agent);

      const expectedPayout = payout.muln(92).divn(100);
      assert.equal(agentBalanceAfter.sub(agentBalanceBefore).toString(), expectedPayout.toString());
      const job = await manager.jobs(0);
      assert.equal(job.completed, true);
    });
  });

  describe("vote rules & blacklists", () => {
    beforeEach(async () => {
      await manager.addAdditionalAgent(agent, { from: owner });
      await createJob();
      await manager.applyForJob(0, "agent", [], { from: agent });
    });

    it("blocks double voting and mixed approve/disapprove", async () => {
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await manager.validateJob(0, "validator", [], { from: validatorOne });
      await expectCustomError(
        manager.validateJob.call(0, "validator", [], { from: validatorOne }),
        "InvalidState"
      );
      await expectCustomError(
        manager.disapproveJob.call(0, "validator", [], { from: validatorOne }),
        "InvalidState"
      );

      await manager.addAdditionalValidator(validatorTwo, { from: owner });
      await manager.disapproveJob(0, "validator", [], { from: validatorTwo });
      await expectCustomError(
        manager.disapproveJob.call(0, "validator", [], { from: validatorTwo }),
        "InvalidState"
      );
      await expectCustomError(
        manager.validateJob.call(0, "validator", [], { from: validatorTwo }),
        "InvalidState"
      );
    });

    it("requires validator authorization", async () => {
      await expectCustomError(
        manager.validateJob.call(0, "validator", [], { from: validatorOne }),
        "NotAuthorized"
      );
    });

    it("requires assignment and non-completion for votes", async () => {
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);

      await manager.validateJob(0, "validator", [], { from: validatorOne });
      await expectCustomError(
        manager.validateJob.call(0, "validator", [], { from: validatorOne }),
        "InvalidState"
      );

      await createJob(employer, payout, duration, "QmNewJob");
      await expectCustomError(
        manager.validateJob.call(1, "validator", [], { from: validatorOne }),
        "InvalidState"
      );
    });

    it("rejects disapprovals when unassigned or already completed", async () => {
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await createJob(employer, payout, duration, "QmUnassigned");
      await expectCustomError(
        manager.disapproveJob.call(1, "validator", [], { from: validatorOne }),
        "InvalidState"
      );

      await manager.setRequiredValidatorApprovals(1, { from: owner });
      await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);
      await manager.validateJob(0, "validator", [], { from: validatorOne });

      await expectCustomError(
        manager.disapproveJob.call(0, "validator", [], { from: validatorOne }),
        "InvalidState"
      );
    });

    it("blocks blacklisted agents and validators", async () => {
      await manager.blacklistAgent(agent, true, { from: owner });
      await createJob(employer, payout, duration, "QmBlocked");
      await expectCustomError(
        manager.applyForJob.call(1, "agent", [], { from: agent }),
        "Blacklisted"
      );

      await manager.blacklistValidator(validatorOne, true, { from: owner });
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await expectCustomError(
        manager.validateJob.call(0, "validator", [], { from: validatorOne }),
        "Blacklisted"
      );
    });
  });

  describe("dispute resolution behavior", () => {
    beforeEach(async () => {
      await manager.addAdditionalAgent(agent, { from: owner });
      await createJob();
    });

    it("allows only employer or agent to dispute", async () => {
      await manager.applyForJob(0, "agent", [], { from: agent });
      await expectCustomError(manager.disputeJob.call(0, { from: outsider }), "NotAuthorized");
      await manager.disputeJob(0, { from: agent });
      await expectCustomError(manager.disputeJob.call(0, { from: agent }), "InvalidState");
    });

    it("marks job disputed once disapproval threshold reached", async () => {
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await manager.addAdditionalValidator(validatorTwo, { from: owner });
      await manager.setRequiredValidatorDisapprovals(2, { from: owner });

      await manager.applyForJob(0, "agent", [], { from: agent });
      await manager.disapproveJob(0, "validator", [], { from: validatorOne });
      const receipt = await manager.disapproveJob(0, "validator", [], { from: validatorTwo });
      expectEvent(receipt, "JobDisputed", { jobId: new BN(0), disputant: validatorTwo });
      const job = await manager.jobs(0);
      assert.equal(job.disputed, true);
    });

    it("resolves disputes with agent win, employer win, and neutral outcomes", async () => {
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);

      await manager.applyForJob(0, "agent", [], { from: agent });
      await manager.disputeJob(0, { from: employer });
      await expectCustomError(
        manager.resolveDisputeWithCode.call(0, 1, "agent win", { from: outsider }),
        "NotModerator"
      );

      const agentBalanceBefore = await token.balanceOf(agent);
      const resolutionReceipt = await manager.resolveDisputeWithCode(0, 1, "agent win", { from: moderator });
      expectEvent(resolutionReceipt, "DisputeResolvedWithCode", { jobId: new BN(0), resolver: moderator });
      const agentBalanceAfter = await token.balanceOf(agent);
      const expectedPayout = payout.muln(92).divn(100);
      assert.equal(agentBalanceAfter.sub(agentBalanceBefore).toString(), expectedPayout.toString());

      const newJobId = await manager.nextJobId();
      await createJob();
      await manager.applyForJob(newJobId, "agent", [], { from: agent });
      await manager.disputeJob(newJobId, { from: employer });
      const neutralReceipt = await manager.resolveDisputeWithCode(newJobId, 0, "needs more info", { from: moderator });
      expectEvent(neutralReceipt, "DisputeResolvedWithCode", { jobId: newJobId, resolver: moderator });
      const neutralJob = await manager.jobs(newJobId);
      assert.equal(neutralJob.completed, false);
      assert.equal(neutralJob.disputed, true);
    });

    it("prevents disputes after completion", async () => {
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);

      await manager.applyForJob(0, "agent", [], { from: agent });
      await manager.validateJob(0, "validator", [], { from: validatorOne });
      await expectCustomError(manager.disputeJob.call(0, { from: employer }), "InvalidState");
    });
  });

  describe("checked ERC20 transfers", () => {
    it("reverts createJob if transferFrom fails", async () => {
      const failingToken = await FailingERC20.new();
      await failingToken.mint(employer, payout);
      await failingToken.setFailTransferFroms(true);

      const altManager = await AGIJobManager.new(
        failingToken.address,
        baseIpfsUrl,
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        validatorTree.root,
        agentTree.root
      );

      await failingToken.approve(altManager.address, payout, { from: employer });
      await expectCustomError(
        altManager.createJob.call(jobIpfs, payout, duration, jobDetails, { from: employer }),
        "TransferFailed"
      );
    });

    it("reverts payouts when transfer returns false", async () => {
      const failingToken = await FailingERC20.new();
      await failingToken.mint(employer, payout);
      await failingToken.mint(owner, payout);

      const altManager = await AGIJobManager.new(
        failingToken.address,
        baseIpfsUrl,
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        validatorTree.root,
        agentTree.root
      );
      await altManager.addAdditionalAgent(agent, { from: owner });
      await altManager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);

      await failingToken.approve(altManager.address, payout, { from: employer });
      await altManager.createJob(jobIpfs, payout, duration, jobDetails, { from: employer });
      await altManager.applyForJob(0, "agent", [], { from: agent });

      await failingToken.setFailTransfers(true);
      await altManager.addModerator(moderator, { from: owner });
      await altManager.disputeJob(0, { from: agent });
      await expectCustomError(
        altManager.resolveDispute.call(0, "agent win", { from: moderator }),
        "TransferFailed"
      );
    });

    it("reverts validator-driven completion when transfer returns false", async () => {
      const failingToken = await FailingERC20.new();
      await failingToken.mint(employer, payout);
      await failingToken.mint(owner, payout);

      const altManager = await AGIJobManager.new(
        failingToken.address,
        baseIpfsUrl,
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        validatorTree.root,
        agentTree.root
      );
      await altManager.addAdditionalAgent(agent, { from: owner });
      await altManager.addAdditionalValidator(validatorOne, { from: owner });
      await altManager.setRequiredValidatorApprovals(1, { from: owner });
      await altManager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);

      await failingToken.approve(altManager.address, payout, { from: employer });
      await altManager.createJob(jobIpfs, payout, duration, jobDetails, { from: employer });
      await altManager.applyForJob(0, "agent", [], { from: agent });

      await failingToken.setFailTransfers(true);
      await expectCustomError(
        altManager.validateJob.call(0, "validator", [], { from: validatorOne }),
        "TransferFailed"
      );
      const job = await altManager.jobs(0);
      assert.equal(job.completed, false);
    });

    it("reverts NFT purchases when transferFrom fails", async () => {
      const failingToken = await FailingERC20.new();
      await failingToken.mint(employer, payout);
      await failingToken.mint(buyer, payout);

      const altManager = await AGIJobManager.new(
        failingToken.address,
        baseIpfsUrl,
        ens.address,
        nameWrapper.address,
        clubRoot,
        agentRoot,
        validatorTree.root,
        agentTree.root
      );
      await altManager.addAdditionalAgent(agent, { from: owner });
      await altManager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);

      await failingToken.approve(altManager.address, payout, { from: employer });
      await altManager.createJob(jobIpfs, payout, duration, jobDetails, { from: employer });
      await altManager.applyForJob(0, "agent", [], { from: agent });
      await altManager.addAdditionalValidator(validatorOne, { from: owner });
      await altManager.setRequiredValidatorApprovals(1, { from: owner });
      await altManager.validateJob(0, "validator", [], { from: validatorOne });

      const tokenId = (await altManager.nextTokenId()).subn(1);
      await altManager.listNFT(tokenId, payout, { from: employer });
      await failingToken.setFailTransferFroms(true);
      await failingToken.approve(altManager.address, payout, { from: buyer });

      await expectCustomError(altManager.purchaseNFT.call(tokenId, { from: buyer }), "TransferFailed");
    });
  });

  describe("admin & configuration", () => {
    it("restricts owner-only controls and updates config", async () => {
      await expectRevert(manager.setBaseIpfsUrl("ipfs://new", { from: outsider }), "Ownable: caller is not the owner");
      await expectRevert(
        manager.updateAGITokenAddress(token.address, { from: outsider }),
        "Ownable: caller is not the owner"
      );
      await expectRevert(manager.setMaxJobPayout(payout, { from: outsider }), "Ownable: caller is not the owner");
      await expectRevert(manager.setJobDurationLimit(1, { from: outsider }), "Ownable: caller is not the owner");
      await expectRevert(manager.addModerator(outsider, { from: outsider }), "Ownable: caller is not the owner");
      await expectRevert(manager.blacklistAgent(agent, true, { from: outsider }), "Ownable: caller is not the owner");
      await expectRevert(manager.addAdditionalAgent(agent, { from: outsider }), "Ownable: caller is not the owner");

      await manager.setBaseIpfsUrl("ipfs://new", { from: owner });
      await manager.updateAGITokenAddress(token.address, { from: owner });
      await manager.setMaxJobPayout(payout.muln(10), { from: owner });
      await manager.setJobDurationLimit(9000, { from: owner });
      await manager.addModerator(validatorFour, { from: owner });
      await manager.removeModerator(validatorFour, { from: owner });
      await manager.blacklistAgent(agent, true, { from: owner });
      await manager.blacklistAgent(agent, false, { from: owner });
      await manager.addAdditionalAgent(agent, { from: owner });
      await manager.removeAdditionalAgent(agent, { from: owner });
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await manager.removeAdditionalValidator(validatorOne, { from: owner });

      assert.equal(await manager.maxJobPayout(), payout.muln(10).toString());
      assert.equal(await manager.jobDurationLimit(), "9000");
    });

    it("withdraws AGI with bounds checks", async () => {
      await token.mint(manager.address, payout);
      await expectRevert(manager.withdrawAGI(payout, { from: owner }), "Pausable: not paused");
      await manager.pause({ from: owner });
      await expectCustomError(manager.withdrawAGI.call(0, { from: owner }), "InvalidParameters");
      await expectCustomError(
        manager.withdrawAGI.call(payout.muln(2), { from: owner }),
        "InsufficientWithdrawableBalance"
      );

      const ownerBalanceBefore = await token.balanceOf(owner);
      await manager.withdrawAGI(payout, { from: owner });
      const ownerBalanceAfter = await token.balanceOf(owner);
      assert.equal(ownerBalanceAfter.sub(ownerBalanceBefore).toString(), payout.toString());
    });

    it("enforces validator thresholds and validation reward bounds", async () => {
      await expectCustomError(manager.setRequiredValidatorApprovals.call(60, { from: owner }), "InvalidValidatorThresholds");
      await expectCustomError(
        manager.setRequiredValidatorDisapprovals.call(60, { from: owner }),
        "InvalidValidatorThresholds"
      );
      await expectCustomError(manager.setRequiredValidatorApprovals.call(49, { from: owner }), "InvalidValidatorThresholds");

      await expectCustomError(manager.setValidationRewardPercentage.call(0, { from: owner }), "InvalidParameters");
      await expectCustomError(manager.setValidationRewardPercentage.call(101, { from: owner }), "InvalidParameters");
    });

    it("handles reward pool contributions and pause protections", async () => {
      await token.mint(employer, payout);
      await token.approve(manager.address, payout, { from: employer });
      const receipt = await manager.contributeToRewardPool(payout, { from: employer });
      expectEvent(receipt, "RewardPoolContribution", { contributor: employer, amount: payout });

      await expectCustomError(manager.contributeToRewardPool.call(0, { from: employer }), "InvalidParameters");

      await manager.pause({ from: owner });
      await expectRevert(
        manager.contributeToRewardPool(payout, { from: employer }),
        "Pausable: paused"
      );
    });

    it("blocks state-changing job actions while paused", async () => {
      await createJob();
      await manager.pause({ from: owner });
      await expectRevert(manager.applyForJob(0, "agent", [], { from: agent }), "Pausable: paused");
      await expectRevert(
        manager.requestJobCompletion(0, updatedIpfs, { from: agent }),
        "Pausable: paused"
      );
      await expectRevert(
        manager.validateJob(0, "validator", [], { from: validatorOne }),
        "Pausable: paused"
      );
      await expectRevert(
        manager.disapproveJob(0, "validator", [], { from: validatorOne }),
        "Pausable: paused"
      );
      await expectRevert(manager.disputeJob(0, { from: employer }), "Pausable: paused");
    });
  });

  describe("NFT marketplace", () => {
    beforeEach(async () => {
      await manager.addAdditionalAgent(agent, { from: owner });
      await manager.addAdditionalValidator(validatorOne, { from: owner });
      await manager.setRequiredValidatorApprovals(1, { from: owner });
      await manager.addAGIType(agiTypeNft.address, 92, { from: owner });
      await agiTypeNft.mint(agent);

      await createJob();
      await manager.applyForJob(0, "agent", [], { from: agent });
      await manager.validateJob(0, "validator", [], { from: validatorOne });
    });

    it("lists, purchases, and delists NFTs with proper access control", async () => {
      const tokenId = (await manager.nextTokenId()).subn(1);
      await expectCustomError(manager.listNFT.call(tokenId, 0, { from: employer }), "InvalidParameters");
      await expectCustomError(manager.listNFT.call(tokenId, payout, { from: outsider }), "NotAuthorized");

      const listReceipt = await manager.listNFT(tokenId, payout, { from: employer });
      expectEvent(listReceipt, "NFTListed", { tokenId, seller: employer, price: payout });

      await token.approve(manager.address, payout, { from: buyer });
      const purchaseReceipt = await manager.purchaseNFT(tokenId, { from: buyer });
      expectEvent(purchaseReceipt, "NFTPurchased", { tokenId, buyer, price: payout });

      assert.equal(await manager.ownerOf(tokenId), buyer);
      const listing = await manager.listings(tokenId);
      assert.equal(listing.isActive, false);
      await expectCustomError(manager.delistNFT.call(tokenId, { from: employer }), "NotAuthorized");
    });

    it("allows seller to delist active listing", async () => {
      const tokenId = (await manager.nextTokenId()).subn(1);
      await manager.listNFT(tokenId, payout, { from: employer });
      const delistReceipt = await manager.delistNFT(tokenId, { from: employer });
      expectEvent(delistReceipt, "NFTDelisted", { tokenId });

      const listing = await manager.listings(tokenId);
      assert.equal(listing.isActive, false);
    });

    it("rejects delisting inactive listings", async () => {
      const tokenId = (await manager.nextTokenId()).subn(1);
      await manager.listNFT(tokenId, payout, { from: employer });
      await manager.delistNFT(tokenId, { from: employer });
      await expectCustomError(manager.delistNFT.call(tokenId, { from: employer }), "NotAuthorized");
    });
  });

  describe("job cancellation and delisting", () => {
    it("allows employer to cancel unassigned jobs and refunds escrow", async () => {
      await createJob();
      const balanceBefore = await token.balanceOf(employer);
      const receipt = await manager.cancelJob(0, { from: employer });
      expectEvent(receipt, "JobCancelled", { jobId: new BN(0) });

      const balanceAfter = await token.balanceOf(employer);
      assert.equal(balanceAfter.sub(balanceBefore).toString(), payout.toString());

      const job = await manager.jobs(0);
      assert.equal(job.employer, "0x0000000000000000000000000000000000000000");
    });

    it("prevents cancel/delist after assignment and restricts delist to owner", async () => {
      await createJob();
      await assignAgentWithProof(0);

      await expectCustomError(manager.cancelJob.call(0, { from: employer }), "InvalidState");
      await expectRevert(manager.delistJob(0, { from: outsider }), "Ownable: caller is not the owner");
      await expectCustomError(manager.delistJob.call(0, { from: owner }), "InvalidState");
    });
  });

  describe("ownership gating (ENS & Merkle)", () => {
    it("accepts valid Merkle proofs and rejects invalid ones", async () => {
      await createJob();
      await assignAgentWithProof(0, agent);

      await createJob(employer, payout, duration, "QmSecond");
      await expectCustomError(
        manager.applyForJob.call(1, "agent", [], { from: agent }),
        "NotAuthorized"
      );

      await manager.addAdditionalAgent(agent, { from: owner });
      await manager.applyForJob(1, "agent", [], { from: agent });
    });

    it("accepts NameWrapper ownership and resolver address matches", async () => {
      await createJob();
      const subdomain = "agent";
      await setNameWrapperOwnership(nameWrapper, agentRoot, subdomain, agent);
      await manager.applyForJob(0, subdomain, [], { from: agent });

      await createJob(employer, payout, duration, "QmResolver");
      await setResolverOwnership(ens, resolver, clubRoot, "validator", validatorOne);
      await manager.applyForJob(1, "agent", agentTree.proofFor(agent), { from: agent });
      await manager.validateJob(1, "validator", [], { from: validatorOne });
    });
  });
});
