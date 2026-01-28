const assert = require("assert");

const AGIJobManager = artifacts.require("AGIJobManager");
const MockENS = artifacts.require("MockENS");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const MockERC20 = artifacts.require("MockERC20");
const MockERC721 = artifacts.require("MockERC721");

const ZERO_BYTES32 = "0x" + "0".repeat(64);
const EMPTY_PROOF = [];

const MAINNET = {
  validatorSender: "0x9DbBBC1E49dA102dC6c667a238E7EedEA9b0E290",
  agent: "0x5ff14ac26a21B3ceB4421F86fB5aaa4B9F084f2A",
  employer: "0xd76AD27E9C819c345A14825797ca8AFc0C15A491",
  validators: [
    "0x21301d901db04724597d1b6012ac49878157580d",
    "0xa9ed0539c2fbc5c6bc15a2e168bd9bcd07c01201",
    "0xecb97519efd7d9d9d279e7c284b286bbe10afaa9",
    "0x5e5f40346387874922e17b177f55a8880dd432cb",
    "0x2fdc910574113dfe6a4db5971e166e286813c79f",
    "0x88692de2a896c6534e544976defd41064904c730",
    "0xa46cea0a1871b875ee8a1798848c0089a321e588",
    "0x9DbBBC1E49dA102dC6c667a238E7EedEA9b0E290",
  ],
};

const { soliditySha3, toBN, toWei } = web3.utils;

function rootNode(label) {
  return soliditySha3({ type: "string", value: label });
}

function subnode(root, subdomain) {
  const labelHash = soliditySha3({ type: "string", value: subdomain });
  return soliditySha3({ type: "bytes32", value: root }, { type: "bytes32", value: labelHash });
}

async function expectRevert(promise) {
  try {
    await promise;
  } catch (error) {
    const message = error.message || "";
    assert(
      message.includes("revert") || message.includes("invalid opcode") || message.includes("VM Exception"),
      `Expected revert, got: ${message}`
    );
    return;
  }
  assert.fail("Expected revert not received.");
}

contract("Case study: legacy job 12 replay (new AGIJobManager)", (accounts) => {
  const owner = accounts[0];
  const local = {
    employer: accounts[1],
    agent: accounts[2],
    validators: [accounts[0], ...accounts.slice(3, 10)],
  };
  const agentSubdomain = "888.node.agi.eth";
  const validatorSubdomain = "bluebutterfli";
  const baseIpfsUrl = "https://ipfs.io/ipfs/";
  const ipfsHash = "bafkreibq3jcpanwlzubcvhdwstbfrwc43wrq2nqjh5kgrvflau3gxgoum4";

  it("replays the job lifecycle with ENS mocks and better-only checks", async () => {
    assert.equal(
      local.validators.length,
      MAINNET.validators.length,
      "role mapping should preserve validator count"
    );
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const resolver = await MockResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const nft = await MockERC721.new({ from: owner });

    const clubRootNode = rootNode("club.agi.eth");
    const agentRootNode = rootNode("agent.agi.eth");
    const manager = await AGIJobManager.new(
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
    await manager.setRequiredValidatorApprovals(local.validators.length, { from: owner });
    await manager.addModerator(owner, { from: owner });

    await nft.mint(local.agent, { from: owner });

    const payout = toBN(toWei("1000"));
    await token.mint(local.employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: local.employer });

    const agentSubnode = subnode(agentRootNode, agentSubdomain);
    await nameWrapper.setOwner(agentSubnode, local.agent, { from: owner });

    const validatorSubnode = subnode(clubRootNode, validatorSubdomain);
    await ens.setResolver(validatorSubnode, resolver.address, { from: owner });

    const jobId = (await manager.nextJobId()).toNumber();

    await expectRevert(manager.applyForJob(jobId + 999, agentSubdomain, EMPTY_PROOF, { from: local.agent }));

    await manager.createJob(ipfsHash, payout, 1000, "job-12-replay", { from: local.employer });
    await manager.applyForJob(jobId, agentSubdomain, EMPTY_PROOF, { from: local.agent });
    await manager.requestJobCompletion(jobId, ipfsHash, { from: local.agent });

    await resolver.setAddr(validatorSubnode, local.validators[0], { from: owner });
    await manager.validateJob(jobId, validatorSubdomain, EMPTY_PROOF, { from: local.validators[0] });
    await expectRevert(manager.validateJob(jobId, validatorSubdomain, EMPTY_PROOF, { from: local.validators[0] }));
    await expectRevert(manager.disapproveJob(jobId, validatorSubdomain, EMPTY_PROOF, { from: local.validators[0] }));

    let lastReceipt;
    for (let i = 1; i < local.validators.length; i++) {
      await resolver.setAddr(validatorSubnode, local.validators[i], { from: owner });
      const tx = await manager.validateJob(jobId, validatorSubdomain, EMPTY_PROOF, { from: local.validators[i] });
      lastReceipt = tx.receipt;
    }

    const issuedEvent = lastReceipt.logs.find((log) => log.event === "NFTIssued");
    assert(issuedEvent, "expected NFTIssued event");
    const tokenId = issuedEvent.args.tokenId.toNumber();
    assert.equal(issuedEvent.args.employer, local.employer, "NFT should mint to employer");
    assert.equal(
      issuedEvent.args.tokenURI,
      `${baseIpfsUrl}/${ipfsHash}`,
      "tokenURI should match baseIpfsUrl + '/' + ipfsHash"
    );

    assert.equal(await manager.ownerOf(tokenId), local.employer, "employer should own minted NFT");

    const agentPayout = payout.muln(92).divn(100);
    const totalValidatorPayout = payout.muln(8).divn(100);
    const validatorPayout = totalValidatorPayout.divn(MAINNET.validators.length);

    assert((await token.balanceOf(local.agent)).eq(agentPayout), "agent payout mismatch");
    for (const validator of local.validators) {
      assert((await token.balanceOf(validator)).eq(validatorPayout), `validator payout mismatch for ${validator}`);
    }

    await expectRevert(manager.validateJob(jobId, validatorSubdomain, EMPTY_PROOF, { from: local.validators[0] }));

    const zeroValidatorPayout = toBN(toWei("250"));
    await token.mint(local.employer, zeroValidatorPayout, { from: owner });
    await token.approve(manager.address, zeroValidatorPayout, { from: local.employer });

    const disputeJobId = (await manager.nextJobId()).toNumber();
    await manager.createJob(ipfsHash, zeroValidatorPayout, 1000, "job-12-replay-dispute", { from: local.employer });
    await manager.applyForJob(disputeJobId, agentSubdomain, EMPTY_PROOF, { from: local.agent });
    await manager.requestJobCompletion(disputeJobId, ipfsHash, { from: local.agent });
    await manager.disputeJob(disputeJobId, { from: local.employer });
    await manager.resolveDispute(disputeJobId, "agent win", { from: owner });

    const nextTokenId = (await manager.nextTokenId()).toNumber();
    assert.equal(nextTokenId, tokenId + 2, "agent-win dispute should mint without div-by-zero");
  });
});
