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
const { expectCustomError } = require('./helpers/errors');

const leafFor = (address) => Buffer.from(web3.utils.soliditySha3({ type: 'address', value: address }).slice(2), 'hex');
const mkTree = (list) => { const t = new MerkleTree(list.map(leafFor), keccak256, { sortPairs: true }); return { root: t.getHexRoot(), proofFor: (a) => t.getHexProof(leafFor(a)) }; };

contract('pausing.accessControl', (accounts) => {
  const [owner, employer, agent, validator, moderator] = accounts;

  it('pause stops intake but does not change adjudication outcomes when settlement is active', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new(); const nft = await MockERC721.new();
    const agentTree = mkTree([agent]);
    const validatorTree = mkTree([validator]);
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), validatorTree.root, agentTree.root), { from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner }); await nft.mint(agent);
    await manager.addModerator(moderator, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    const payout = new BN(web3.utils.toWei('1000'));
    await token.mint(employer, payout.muln(2));
    await token.mint(agent, payout);
    await token.mint(validator, payout);
    await token.approve(manager.address, payout.muln(2), { from: employer });
    await token.approve(manager.address, payout, { from: agent });
    await token.approve(manager.address, payout, { from: validator });

    await manager.createJob('Qm', payout, 5000, 'd', { from: employer });
    await manager.pause({ from: owner });

    await expectRevert.unspecified(manager.createJob('Qm2', payout, 5000, 'd', { from: employer }));
    await expectRevert.unspecified(manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent }));

    await manager.unpause({ from: owner });
    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    await manager.requestJobCompletion(0, 'QmDone', { from: agent });

    await manager.pause({ from: owner });
    await manager.validateJob(0, 'validator', validatorTree.proofFor(validator), { from: validator });
    await manager.disputeJob(0, { from: employer });
    await manager.resolveDisputeWithCode(0, 1, 'agent wins', { from: moderator });

    const core = await manager.getJobCore(0);
    assert.equal(core.completed, true);
  });

  it('settlementPaused freezes settlement and dispute progression', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new(); const nft = await MockERC721.new();
    const agentTree = mkTree([agent]);
    const validatorTree = mkTree([validator]);
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), validatorTree.root, agentTree.root), { from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner }); await nft.mint(agent);
    await manager.addModerator(moderator, { from: owner });
    const payout = new BN(web3.utils.toWei('1000'));
    await token.mint(employer, payout.muln(2));
    await token.mint(agent, payout);
    await token.mint(validator, payout);
    await token.approve(manager.address, payout.muln(2), { from: employer });
    await token.approve(manager.address, payout, { from: agent });
    await token.approve(manager.address, payout, { from: validator });

    await manager.createJob('Qm', payout, 1, 'd', { from: employer });
    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    await manager.requestJobCompletion(0, 'QmDone', { from: agent });

    await manager.createJob('Qm2', payout, 1, 'd', { from: employer });
    await manager.applyForJob(1, 'agent', agentTree.proofFor(agent), { from: agent });

    await manager.setSettlementPaused(true, { from: owner });
    await expectCustomError(manager.validateJob.call(0, 'validator', validatorTree.proofFor(validator), { from: validator }), 'SettlementPaused');
    await expectCustomError(manager.disapproveJob.call(0, 'validator', validatorTree.proofFor(validator), { from: validator }), 'SettlementPaused');
    await expectCustomError(manager.disputeJob.call(0, { from: employer }), 'SettlementPaused');
    await expectCustomError(manager.finalizeJob.call(0, { from: employer }), 'SettlementPaused');
    await expectCustomError(manager.resolveDisputeWithCode.call(0, 1, 'x', { from: moderator }), 'SettlementPaused');
    await expectCustomError(manager.expireJob.call(1, { from: employer }), 'SettlementPaused');
    await expectCustomError(manager.cancelJob.call(1, { from: employer }), 'SettlementPaused');
  });

  it('allows treasury withdrawals only while paused and when settlement is active', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new();
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), '0x' + '00'.repeat(32), '0x' + '00'.repeat(32)), { from: owner });
    const treasury = new BN(web3.utils.toWei('5'));

    await token.mint(manager.address, treasury, { from: owner });

    await expectRevert.unspecified(manager.withdrawAGI(1, { from: owner }));
    await manager.pause({ from: owner });
    await manager.setSettlementPaused(true, { from: owner });
    await expectRevert.unspecified(manager.withdrawAGI(1, { from: owner }));

    await manager.setSettlementPaused(false, { from: owner });
    await expectRevert.unspecified(manager.withdrawAGI(treasury.addn(1), { from: owner }));

    await manager.withdrawAGI(treasury, { from: owner });
    assert.equal((await token.balanceOf(owner)).toString(), treasury.toString());
  });
});
