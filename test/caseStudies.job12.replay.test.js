const assert = require("assert");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");

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
    validator: "0x9DbBBC1E49dA102dC6c667a238E7EedEA9b0E290",
    agent: "0x5ff14ac26a21B3ceB4421F86fB5aaa4B9F084f2A",
    employer: "0xd76AD27E9C819c345A14825797ca8AFc0C15A491",
  };

  const subdomains = {
    agent: "888.node.agi.eth",
    validatorPrimary: "bluebutterfli",
    validator2: "validator-two",
    validator3: "validator-three",
  };

  let token;
  let nft;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;
  let clubRootNode;
  let agentRootNode;
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

    manager = await AGIJobManager.new(
      token.address,
      baseIpfsUrl,
      ens.address,
      nameWrapper.address,
      clubRootNode,
      agentRootNode,
      ZERO_BYTES32,
      ZERO_BYTES32,
      { from: owner }
    );

    await manager.addAGIType(nft.address, 92, { from: owner });
    await nft.mint(agent, { from: owner });

    await token.mint(employer, web3.utils.toWei("2500"), { from: owner });
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

    await manager.validateJob(jobId, subdomains.validatorPrimary, EMPTY_PROOF, { from: validator1 });
    await manager.validateJob(jobId, subdomains.validator2, EMPTY_PROOF, { from: validator2 });
    const receipt = await manager.validateJob(jobId, subdomains.validator3, EMPTY_PROOF, { from: validator3 });

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

    assert.equal((await token.balanceOf(agent)).toString(), agentPayout.toString());
    assert.equal((await token.balanceOf(validator1)).toString(), validatorPayout.toString());
    assert.equal((await token.balanceOf(validator2)).toString(), validatorPayout.toString());
    assert.equal((await token.balanceOf(validator3)).toString(), validatorPayout.toString());

    const job = await manager.jobs(jobId);
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

    await configureEnsOwnership({
      ens,
      resolver,
      nameWrapper,
      rootNode: clubRootNode,
      subdomain: subdomains.validator3,
      claimant: validator3,
      from: owner,
    });

    await manager.setRequiredValidatorApprovals(3, { from: owner });
    await manager.validateJob(jobId, subdomains.validator2, EMPTY_PROOF, { from: validator2 });
    await manager.validateJob(jobId, subdomains.validator3, EMPTY_PROOF, { from: validator3 });

    await expectRevert.unspecified(
      manager.validateJob(jobId, subdomains.validatorPrimary, EMPTY_PROOF, { from: validator1 })
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
    await manager.disputeJob(jobId, { from: employer });

    const beforeTokenId = await manager.nextTokenId();
    await manager.resolveDispute(jobId, "agent win", { from: moderator });
    const afterTokenId = await manager.nextTokenId();

    assert.equal(afterTokenId.toString(), new BN(beforeTokenId).addn(1).toString());
    const job = await manager.jobs(jobId);
    assert.equal(job.completed, true);
  });
});
