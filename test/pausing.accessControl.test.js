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
  const [owner, employer, agent, validator] = accounts;

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
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setVoteQuorum(1, { from: owner });
    await token.mint(validator, payout);
    await token.approve(manager.address, payout, { from: validator });

    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    await manager.requestJobCompletion(0, 'QmDone', { from: agent });

    await manager.pause({ from: owner });
    await manager.validateJob(0, 'validator', [], { from: validator });
    await token.mint(employer, payout);
    await token.approve(manager.address, payout, { from: employer });
    await manager.disputeJob(0, { from: employer });

    await manager.setSettlementPaused(true, { from: owner });
    await expectRevert.unspecified(manager.requestJobCompletion(0, 'QmRetry', { from: agent }));
    await expectRevert.unspecified(manager.validateJob(0, 'validator', [], { from: owner }));
    await expectRevert.unspecified(manager.disputeJob(0, { from: owner }));
    await expectRevert.unspecified(manager.finalizeJob(0, { from: employer }));
    await expectRevert.unspecified(manager.resolveDisputeWithCode(0, 1, 'x', { from: owner }));
    await expectRevert.unspecified(manager.resolveStaleDispute(0, true, { from: owner }));
    await expectRevert.unspecified(manager.cancelJob(0, { from: employer }));
    await expectRevert.unspecified(manager.expireJob(0, { from: employer }));
    await expectRevert.unspecified(manager.delistJob(0, { from: owner }));

    await manager.addModerator(owner, { from: owner });
    await manager.setSettlementPaused(false, { from: owner });
    await manager.resolveDisputeWithCode(0, 1, 'x', { from: owner });
  });

  it('keeps adjudication outcomes consistent while paused when settlement is active', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new(); const nft = await MockERC721.new();
    const agentTree = mkTree([agent]);
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), '0x' + '00'.repeat(32), agentTree.root), { from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setVoteQuorum(1, { from: owner });
    await nft.mint(agent);

    const payout = new BN(web3.utils.toWei('1000'));
    const budget = payout.muln(2);
    await token.mint(employer, budget);
    await token.mint(agent, budget);
    await token.mint(validator, budget);
    await token.approve(manager.address, budget, { from: employer });
    await token.approve(manager.address, budget, { from: agent });
    await token.approve(manager.address, budget, { from: validator });

    await manager.createJob('Qm0', payout, 200000, 'd0', { from: employer });
    await manager.createJob('Qm1', payout, 200000, 'd1', { from: employer });

    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    await manager.applyForJob(1, 'agent', agentTree.proofFor(agent), { from: agent });

    await manager.requestJobCompletion(0, 'QmDone0', { from: agent });
    await manager.validateJob(0, 'validator', [], { from: validator });
    await time.increase((await manager.challengePeriodAfterApproval()).toNumber() + 1);
    await manager.finalizeJob(0, { from: employer });

    await manager.requestJobCompletion(1, 'QmDone1', { from: agent });
    await manager.pause({ from: owner });
    await manager.validateJob(1, 'validator', [], { from: validator });
    await time.increase((await manager.challengePeriodAfterApproval()).toNumber() + 1);
    await manager.finalizeJob(1, { from: employer });

    const core0 = await manager.getJobCore(0);
    const core1 = await manager.getJobCore(1);
    assert.equal(core0.completed, true);
    assert.equal(core1.completed, true);
    assert.equal(core0.disputed, false);
    assert.equal(core1.disputed, false);
    assert.equal(core0.expired, false);
    assert.equal(core1.expired, false);
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
