const assert = require("assert");
const { BN, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const { buildInitConfig } = require("./helpers/deploy");
const {
  fundValidators,
  fundAgents,
  fundDisputeBond,
  computeValidatorBond,
  computeAgentBond,
} = require("./helpers/bonds");

const ZERO_BYTES32 = "0x" + "0".repeat(64);
const EMPTY_PROOF = [];

function makeSubnode(rootNode, label) {
  const labelHash = web3.utils.soliditySha3({ type: "string", value: label });
  return web3.utils.soliditySha3(
    { type: "bytes32", value: rootNode },
    { type: "bytes32", value: labelHash }
  );
}

async function configureEnsOwnership({
  ens,
  resolver,
  nameWrapper,
  rootNode,
  subdomain,
  claimant,
  from,
}) {
  const subnode = makeSubnode(rootNode, subdomain);
  const subnodeUint = web3.utils.toBN(subnode);
  await nameWrapper.setOwner(subnodeUint, claimant, { from });
  await ens.setResolver(subnode, resolver.address, { from });
  await resolver.setAddr(subnode, claimant, { from });
  return subnode;
}

contract("Case study replay: legacy AGI Job 12", (accounts) => {
  const [owner, employer, agent, validator1, validator2, validator3, moderator, other] = accounts;

  const mainnetIdentities = {
    validator: "0x9DbBBCc3c603903702BC323C4A4A8a597280a89B",
    agent: "0x5ff14ac26a21B3ceB4421F86fB5aaa4B9F084f2A",
    employer: "0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99",
  };

  const subdomains = {
    agent: "agent888",
    validatorPrimary: "bluebutterfli",
    validator2: "validator-two",
    validator3: "validator-three",
    validator4: "validator-four",
    validator5: "validator-five",
  };

  let token;
  let nft;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let clubRootNode;
  let agentRootNode;
  let alphaClubRootNode;
  let alphaAgentRootNode;
  let baseIpfsUrl;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    nft = await MockERC721.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    baseIpfsUrl = "https://ipfs.io/ipfs";
    clubRootNode = web3.utils.soliditySha3({ type: "string", value: "club-root" });
    agentRootNode = web3.utils.soliditySha3({ type: "string", value: "agent-root" });
    alphaClubRootNode = clubRootNode;
    alphaAgentRootNode = agentRootNode;

    manager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        baseIpfsUrl,
        ens.address,
        nameWrapper.address,
        clubRootNode,
        agentRootNode,
        alphaClubRootNode,
        alphaAgentRootNode,
        ZERO_BYTES32,
        ZERO_BYTES32,
      ),
      { from: owner }
    );
    await manager.setChallengePeriodAfterApproval(1, { from: owner });

    await manager.addAGIType(nft.address, 92, { from: owner });
    await nft.mint(agent, { from: owner });

    await token.mint(employer, web3.utils.toWei("2500"), { from: owner });

    await fundValidators(token, manager, [validator1, validator2, validator3], owner);
    await fundAgents(token, manager, [agent], owner);
  });

  it("replays the legacy Job 12 lifecycle with ENS-mocked ownership", async () => {
    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: agentRootNode,
      subdomain: subdomains.agent,
      claimant: agent,
      from: owner,
    });

    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: clubRootNode,
      subdomain: subdomains.validatorPrimary,
      claimant: validator1,
      from: owner,
    });

    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: clubRootNode,
      subdomain: subdomains.validator2,
      claimant: validator2,
      from: owner,
    });

    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: clubRootNode,
      subdomain: subdomains.validator3,
      claimant: validator3,
      from: owner,
    });

    const payout = new BN(web3.utils.toWei("1200"));
    const duration = 30 * 24 * 60 * 60;
    const ipfsHash = "bafkreibq3jcpanwlzubcvhdwstbfrwc43wrq2nqjh5kgrvflau3gxgoum4";

    const jobId = (await manager.nextJobId()).toNumber();
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob(ipfsHash, payout, duration, "legacy job 12 replay", { from: employer });

    await manager.applyForJob(jobId, subdomains.agent, EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, ipfsHash, { from: agent });

    const agentBefore = await token.balanceOf(agent);
    const validator1Before = await token.balanceOf(validator1);
    const validator2Before = await token.balanceOf(validator2);
    const validator3Before = await token.balanceOf(validator3);
    await manager.validateJob(jobId, subdomains.validatorPrimary, EMPTY_PROOF, { from: validator1 });
    await manager.validateJob(jobId, subdomains.validator2, EMPTY_PROOF, { from: validator2 });
    await manager.validateJob(jobId, subdomains.validator3, EMPTY_PROOF, { from: validator3 });
    await time.increase(2);
    const receipt = await manager.finalizeJob(jobId, { from: employer });

    expectEvent(receipt, "JobCompleted", {
      jobId: new BN(jobId),
      agent,
    });

    expectEvent(receipt, "NFTIssued", {
      tokenId: new BN(0),
      employer,
    });

    assert.equal(await manager.ownerOf(0), employer);
    assert.equal(await manager.tokenURI(0), `${baseIpfsUrl}/${ipfsHash}`);

    const totalValidatorPayout = payout.muln(8).divn(100);
    const validatorPayout = totalValidatorPayout.divn(3);
    const agentPayout = payout.muln(92).divn(100);

    const agentBond = await computeAgentBond(manager, payout, new BN(duration));
    assert.equal(
      (await token.balanceOf(agent)).sub(agentBefore).toString(),
      agentPayout.add(agentBond).toString()
    );
    assert.equal(
      (await token.balanceOf(validator1)).sub(validator1Before).toString(),
      validatorPayout.toString()
    );
    assert.equal(
      (await token.balanceOf(validator2)).sub(validator2Before).toString(),
      validatorPayout.toString()
    );
    assert.equal(
      (await token.balanceOf(validator3)).sub(validator3Before).toString(),
      validatorPayout.toString()
    );

    const job = await manager.getJobCore(jobId);
    assert.equal(job.completed, true);
    assert.equal(job.assignedAgent, agent);

    assert.ok(mainnetIdentities.validator);
    assert.ok(mainnetIdentities.agent);
    assert.ok(mainnetIdentities.employer);
  });

  it("enforces better-only protections during replay", async () => {
    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: agentRootNode,
      subdomain: subdomains.agent,
      claimant: agent,
      from: owner,
    });

    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: clubRootNode,
      subdomain: subdomains.validatorPrimary,
      claimant: validator1,
      from: owner,
    });

    await expectRevert.unspecified(
      manager.applyForJob(9999, subdomains.agent, EMPTY_PROOF, { from: agent })
    );

    const payout = new BN(web3.utils.toWei("100"));
    const jobId = (await manager.nextJobId()).toNumber();
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs-better-only", payout, 1000, "details", { from: employer });
    await manager.applyForJob(jobId, subdomains.agent, EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-better-only", { from: agent });

    await manager.validateJob(jobId, subdomains.validatorPrimary, EMPTY_PROOF, { from: validator1 });

    await expectRevert.unspecified(
      manager.validateJob(jobId, subdomains.validatorPrimary, EMPTY_PROOF, { from: validator1 })
    );

    await expectRevert.unspecified(
      manager.disapproveJob(jobId, subdomains.validatorPrimary, EMPTY_PROOF, { from: validator1 })
    );

    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: clubRootNode,
      subdomain: subdomains.validator2,
      claimant: validator2,
      from: owner,
    });

    await manager.disapproveJob(jobId, subdomains.validator2, EMPTY_PROOF, { from: validator2 });

    await expectRevert.unspecified(
      manager.validateJob(jobId, subdomains.validator2, EMPTY_PROOF, { from: validator2 })
    );

    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: clubRootNode,
      subdomain: subdomains.validator3,
      claimant: validator3,
      from: owner,
    });

    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: clubRootNode,
      subdomain: subdomains.validator4,
      claimant: other,
      from: owner,
    });

    await manager.setRequiredValidatorApprovals(3, { from: owner });
    await manager.validateJob(jobId, subdomains.validator3, EMPTY_PROOF, { from: validator3 });
    const bond = await computeValidatorBond(manager, payout);
    await token.mint(other, bond, { from: owner });
    await token.approve(manager.address, bond, { from: other });
    await manager.validateJob(jobId, subdomains.validator4, EMPTY_PROOF, { from: other });

    await expectRevert.unspecified(
      manager.validateJob(jobId, subdomains.validatorPrimary, EMPTY_PROOF, { from: validator1 })
    );

    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: clubRootNode,
      subdomain: subdomains.validator5,
      claimant: moderator,
      from: owner,
    });

    await expectRevert.unspecified(
      manager.validateJob(jobId, subdomains.validator5, EMPTY_PROOF, { from: moderator })
    );
  });

  it("completes agent-win disputes with zero validators (no div-by-zero)", async () => {
    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: agentRootNode,
      subdomain: subdomains.agent,
      claimant: agent,
      from: owner,
    });

    await manager.addModerator(moderator, { from: owner });

    const payout = new BN(web3.utils.toWei("50"));
    const jobId = (await manager.nextJobId()).toNumber();
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob("ipfs-dispute", payout, 1000, "details", { from: employer });

    await manager.applyForJob(jobId, subdomains.agent, EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId, "ipfs-complete", { from: agent });
    await fundDisputeBond(token, manager, employer, payout, owner);
    await manager.disputeJob(jobId, { from: employer });

    const beforeTokenId = await manager.nextTokenId();
    await manager.resolveDisputeWithCode(jobId, 1, "agent win", { from: moderator });
    const afterTokenId = await manager.nextTokenId();

    assert.equal(afterTokenId.toString(), new BN(beforeTokenId).addn(1).toString());
    const job = await manager.getJobCore(jobId);
    assert.equal(job.completed, true);
  });
});
