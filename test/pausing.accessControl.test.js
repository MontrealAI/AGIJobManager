const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockERC721 = artifacts.require('MockERC721');
const { buildInitConfig } = require('./helpers/deploy');
const { rootNode } = require('./helpers/ens');

const leafFor = (address) => Buffer.from(web3.utils.soliditySha3({ type: 'address', value: address }).slice(2), 'hex');
const mkTree = (list) => { const t = new MerkleTree(list.map(leafFor), keccak256, { sortPairs: true }); return { root: t.getHexRoot(), proofFor: (a) => t.getHexProof(leafFor(a)) }; };

contract('pausing.accessControl', (accounts) => {
  const [owner, employer, agent] = accounts;

  it('gates create/apply with pause and gates settlement with settlementPaused', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new(); const nft = await MockERC721.new();
    const agentTree = mkTree([agent]);
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), '0x' + '00'.repeat(32), agentTree.root), { from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner }); await nft.mint(agent);
    const payout = new BN(web3.utils.toWei('1000'));
    await token.mint(employer, payout);
    await token.mint(agent, payout);
    await token.approve(manager.address, payout, { from: agent });

    await manager.pause({ from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await expectRevert.unspecified(manager.createJob('Qm', payout, 5000, 'd', { from: employer }));
    await manager.unpause({ from: owner });

    await manager.createJob('Qm', payout, 5000, 'd', { from: employer });
    await manager.pause({ from: owner });
    await expectRevert.unspecified(manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent }));

    await manager.unpause({ from: owner });
    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    await manager.requestJobCompletion(0, 'QmDone', { from: agent });
    await time.increase((await manager.completionReviewPeriod()).toNumber() + 1);

    await manager.setSettlementPaused(true, { from: owner });
    await expectRevert.unspecified(manager.finalizeJob(0, { from: owner }));

    await manager.setSettlementPaused(false, { from: owner });
    await manager.finalizeJob(0, { from: owner });
  });
});
