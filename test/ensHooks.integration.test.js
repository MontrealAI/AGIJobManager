const { BN, time } = require('@openzeppelin/test-helpers');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const AGIJobManager = artifacts.require('AGIJobManager');
const ENSJobPages = artifacts.require('ENSJobPages');
const MockERC20 = artifacts.require('MockERC20');
const MockENSRegistry = artifacts.require('MockENSRegistry');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockPublicResolver = artifacts.require('MockPublicResolver');
const MockERC721 = artifacts.require('MockERC721');

const { buildInitConfig } = require('./helpers/deploy');
const { namehash, rootNode } = require('./helpers/ens');

const leafFor = (address) => Buffer.from(web3.utils.soliditySha3({ type: 'address', value: address }).slice(2), 'hex');
const mkTree = (list) => { const t = new MerkleTree(list.map(leafFor), keccak256, { sortPairs: true }); return { root: t.getHexRoot(), proofFor: (a) => t.getHexProof(leafFor(a)) }; };

contract('ensHooks.integration', (accounts) => {
  const [owner, employer, agent, validator] = accounts;

  it('invokes ENS hooks best-effort and lockJobENS fuse burn path', async () => {
    const token = await MockERC20.new();
    const ens = await MockENSRegistry.new();
    const wrapper = await MockNameWrapper.new();
    const resolver = await MockPublicResolver.new();
    const nft = await MockERC721.new();

    const rootName = 'jobs.alpha.agi.eth';
    const rootNodeHash = namehash(rootName);
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, wrapper.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), mkTree([validator]).root, mkTree([agent]).root), { from: owner });
    const pages = await ENSJobPages.new(ens.address, wrapper.address, resolver.address, rootNodeHash, rootName, { from: owner });
    await pages.setJobManager(manager.address, { from: owner });
    await manager.setEnsJobPages(pages.address, { from: owner });

    await manager.addAGIType(nft.address, 90, { from: owner }); await nft.mint(agent);
    const payout = new BN(web3.utils.toWei('1000'));
    await token.mint(employer, payout); await token.approve(manager.address, payout, { from: employer });
    await token.mint(validator, payout); await token.approve(manager.address, payout, { from: validator });
    await token.mint(agent, payout); await token.approve(manager.address, payout, { from: agent });

    await manager.createJob('QmSpec', payout, 5000, 'd', { from: employer });
    await manager.applyForJob(0, 'agent', mkTree([agent]).proofFor(agent), { from: agent });
    await manager.requestJobCompletion(0, 'QmDone', { from: agent });
    await manager.validateJob(0, 'validator', mkTree([validator]).proofFor(validator), { from: validator });
    await time.increase((await manager.completionReviewPeriod()).toNumber() + 1);
    await manager.finalizeJob(0, { from: employer });

    const lockReceipt = await manager.lockJobENS(0, true, { from: owner });
    assert.equal(lockReceipt.receipt.status, true);
  });
});
