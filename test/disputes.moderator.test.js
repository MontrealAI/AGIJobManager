const { BN, time } = require('@openzeppelin/test-helpers');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockERC721 = artifacts.require('MockERC721');

const { buildInitConfig } = require('./helpers/deploy');
const { rootNode } = require('./helpers/ens');
const { fundValidators, fundAgents, fundDisputeBond, computeDisputeBond } = require('./helpers/bonds');

const leafFor = (address) => Buffer.from(web3.utils.soliditySha3({ type: 'address', value: address }).slice(2), 'hex');
const mkTree = (list) => { const t = new MerkleTree(list.map(leafFor), keccak256, { sortPairs: true }); return { root: t.getHexRoot(), proofFor: (a) => t.getHexProof(leafFor(a)) }; };

contract('disputes.moderator', (accounts) => {
  const [owner, employer, agent, v1, moderator] = accounts;
  const payout = new BN(web3.utils.toWei('1000'));

  it('enforces moderator/owner permissions and stale dispute flow', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new(); const nft = await MockERC721.new();
    const agentTree = mkTree([agent]); const validatorTree = mkTree([v1]);
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), validatorTree.root, agentTree.root), { from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner }); await nft.mint(agent); await manager.addModerator(moderator, { from: owner });
    await token.mint(employer, payout); await token.approve(manager.address, payout, { from: employer });
    await fundValidators(token, manager, [v1], owner); await fundAgents(token, manager, [agent], owner);

    await manager.createJob('QmSpec', payout, 5000, 'd', { from: employer });
    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    await manager.requestJobCompletion(0, 'QmDone', { from: agent });
    const disputeBond = await fundDisputeBond(token, manager, employer, payout, owner);
    assert.equal(disputeBond.toString(), (await computeDisputeBond(manager, payout)).toString());
    await manager.disputeJob(0, { from: employer });

    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.resolveDisputeWithCode(0, 1, 'x', { from: employer }));
    await manager.resolveDisputeWithCode(0, 0, 'no action', { from: moderator });
    assert.equal((await manager.getJobCore(0)).disputed, true);

    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.resolveStaleDispute(0, true, { from: owner }));
    await time.increase((await manager.disputeReviewPeriod()).toNumber() + 1);
    await manager.resolveStaleDispute(0, true, { from: owner });
    assert.equal((await manager.getJobCore(0)).completed, true);
  });
});
