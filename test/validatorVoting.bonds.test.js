const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockERC721 = artifacts.require('MockERC721');

const { buildInitConfig } = require('./helpers/deploy');
const { rootNode } = require('./helpers/ens');
const { fundValidators, fundAgents, computeValidatorBond } = require('./helpers/bonds');

const leafFor = (address) => Buffer.from(web3.utils.soliditySha3({ type: 'address', value: address }).slice(2), 'hex');
const mkTree = (list) => { const t = new MerkleTree(list.map(leafFor), keccak256, { sortPairs: true }); return { root: t.getHexRoot(), proofFor: (a) => t.getHexProof(leafFor(a)) }; };

contract('validatorVoting.bonds', (accounts) => {
  const [owner, employer, agent, v1, v2, v3] = accounts;
  const payout = new BN(web3.utils.toWei('1000'));
  const duration = new BN('5000');

  it('prevents double voting and settles with slashing/reward accounting', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new(); const nft = await MockERC721.new();
    const agentTree = mkTree([agent]); const validatorTree = mkTree([v1, v2, v3]);
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), validatorTree.root, agentTree.root), { from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner }); await nft.mint(agent);
    await token.mint(employer, payout); await token.approve(manager.address, payout, { from: employer });
    await fundValidators(token, manager, [v1, v2, v3], owner); await fundAgents(token, manager, [agent], owner);
    await manager.createJob('QmSpec', payout, duration, 'd', { from: employer });
    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    await manager.requestJobCompletion(0, 'QmDone', { from: agent });
    await manager.setRequiredValidatorDisapprovals(2, { from: owner });

    await manager.validateJob(0, 'validator', validatorTree.proofFor(v1), { from: v1 });
    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.validateJob(0, 'validator', validatorTree.proofFor(v1), { from: v1 }));

    await manager.disapproveJob(0, 'validator', validatorTree.proofFor(v2), { from: v2 });
    await manager.disapproveJob(0, 'validator', validatorTree.proofFor(v3), { from: v3 });

    const core = await manager.getJobCore(0);
    assert.equal(core.disputed, true);
    await manager.addModerator(owner, { from: owner });
    await manager.resolveDisputeWithCode(0, 2, 'employer win', { from: owner });
    assert.equal((await manager.lockedValidatorBonds()).toString(), '0');
  });

  it('keeps per-vote bond sizing consistent and enforces validator cap', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new(); const nft = await MockERC721.new();
    const agentTree = mkTree([agent]); const validatorTree = mkTree([v1, v2, v3]);
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), validatorTree.root, agentTree.root), { from: owner });

    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent);
    await manager.setRequiredValidatorApprovals(3, { from: owner });
    await manager.setRequiredValidatorDisapprovals(3, { from: owner });

    await token.mint(employer, payout);
    await token.approve(manager.address, payout, { from: employer });
    await fundValidators(token, manager, [v1, v2, v3], owner);
    await fundAgents(token, manager, [agent], owner);

    await manager.createJob('QmSpec', payout, duration, 'd', { from: employer });
    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    await manager.requestJobCompletion(0, 'QmDone', { from: agent });

    const expectedBond = await computeValidatorBond(manager, payout);
    await manager.validateJob(0, 'validator', validatorTree.proofFor(v1), { from: v1 });
    assert.equal((await manager.lockedValidatorBonds()).toString(), expectedBond.toString());

    await manager.validateJob(0, 'validator', validatorTree.proofFor(v2), { from: v2 });
    assert.equal((await manager.lockedValidatorBonds()).toString(), expectedBond.muln(2).toString());

    await manager.validateJob(0, 'validator', validatorTree.proofFor(v3), { from: v3 });
    assert.equal((await manager.lockedValidatorBonds()).toString(), expectedBond.muln(3).toString());

    await expectRevert.unspecified(manager.disapproveJob(0, 'validator', validatorTree.proofFor(v1), { from: v1 }));
  });
});
