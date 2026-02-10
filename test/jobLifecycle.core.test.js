const { BN, expectEvent, time } = require('@openzeppelin/test-helpers');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const { buildInitConfig } = require('./helpers/deploy');
const { expectCustomError } = require('./helpers/errors');
const { computeAgentBond, computeValidatorBond, fundValidators, fundAgents } = require('./helpers/bonds');
const { rootNode } = require('./helpers/ens');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockERC721 = artifacts.require('MockERC721');

const toWei = (v) => web3.utils.toWei(v.toString());
const leafFor = (address) => Buffer.from(web3.utils.soliditySha3({ type: 'address', value: address }).slice(2), 'hex');
const mkTree = (list) => {
  const t = new MerkleTree(list.map(leafFor), keccak256, { sortPairs: true });
  return { root: t.getHexRoot(), proofFor: (a) => t.getHexProof(leafFor(a)) };
};

contract('jobLifecycle.core', (accounts) => {
  const [owner, employer, agent, v1, v2, v3, outsider] = accounts;
  const payout = new BN(toWei('1000'));
  const duration = new BN('5000');

  let token; let manager; let agentTree; let validatorTree;

  beforeEach(async () => {
    token = await MockERC20.new();
    const ens = await MockENS.new();
    const nameWrapper = await MockNameWrapper.new();
    const agiType = await MockERC721.new();

    agentTree = mkTree([agent]);
    validatorTree = mkTree([v1, v2, v3]);

    manager = await AGIJobManager.new(...buildInitConfig(
      token.address,
      'ipfs://base',
      ens.address,
      nameWrapper.address,
      rootNode('club'),
      rootNode('agent'),
      rootNode('club'),
      rootNode('agent'),
      validatorTree.root,
      agentTree.root,
    ), { from: owner });

    await manager.addAGIType(agiType.address, 90, { from: owner });
    await agiType.mint(agent);
    await token.mint(employer, payout.muln(5));
    await fundValidators(token, manager, [v1, v2, v3], owner);
    await fundAgents(token, manager, [agent], owner);
    await manager.setChallengePeriodAfterApproval(1, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });
  });

  it('handles happy lifecycle and updates locked escrow', async () => {
    await token.approve(manager.address, payout, { from: employer });
    const createReceipt = await manager.createJob('QmSpec', payout, duration, 'details', { from: employer });
    expectEvent(createReceipt, 'JobCreated', { jobId: new BN(0), payout });
    assert.equal((await manager.lockedEscrow()).toString(), payout.toString());

    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    await manager.requestJobCompletion(0, 'QmCompletion', { from: agent });

    await manager.validateJob(0, 'validator', validatorTree.proofFor(v1), { from: v1 });
    await manager.validateJob(0, 'validator', validatorTree.proofFor(v2), { from: v2 });
    await manager.validateJob(0, 'validator', validatorTree.proofFor(v3), { from: v3 });

    await time.increase(2);
    await manager.finalizeJob(0, { from: outsider });

    const core = await manager.getJobCore(0);
    assert.equal(core.completed, true);
    assert.equal((await manager.lockedEscrow()).toString(), '0');
  });

  it('forces dispute on tie under quorum and supports no-vote liveness path', async () => {
    await token.approve(manager.address, payout.muln(2), { from: employer });
    await manager.createJob('QmA', payout, duration, 'A', { from: employer });
    await manager.createJob('QmB', payout, duration, 'B', { from: employer });

    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    await manager.applyForJob(1, 'agent', agentTree.proofFor(agent), { from: agent });

    await manager.requestJobCompletion(0, 'QmDone0', { from: agent });
    await manager.requestJobCompletion(1, 'QmDone1', { from: agent });

    await manager.validateJob(0, 'validator', validatorTree.proofFor(v1), { from: v1 });
    await manager.disapproveJob(0, 'validator', validatorTree.proofFor(v2), { from: v2 });

    await time.increase((await manager.completionReviewPeriod()).toNumber() + 1);
    await manager.finalizeJob(1, { from: outsider });

    const noVoteJob = await manager.getJobCore(1);
    assert.equal(noVoteJob.completed, true);

    await manager.finalizeJob(0, { from: outsider });
    const settledJob = await manager.getJobCore(0);
    assert.equal(settledJob.completed || settledJob.disputed, true);
    const tiedJob = await manager.getJobCore(0);
    assert.equal(tiedJob.disputed, true);
  });

  it('enforces bounds and challenge-window settlement gates', async () => {
    await token.approve(manager.address, payout, { from: employer });
    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.createJob('', payout, duration, 'x', { from: employer }));
    await manager.createJob('QmSpec', payout, duration, 'x', { from: employer });

    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    await manager.requestJobCompletion(0, 'QmDone', { from: agent });
    await manager.validateJob(0, 'validator', validatorTree.proofFor(v1), { from: v1 });
    await manager.validateJob(0, 'validator', validatorTree.proofFor(v2), { from: v2 });
    await manager.validateJob(0, 'validator', validatorTree.proofFor(v3), { from: v3 });

    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.finalizeJob(0, { from: outsider }));
    const expectedValidatorBond = await computeValidatorBond(manager, payout);
    const expectedAgentBond = await computeAgentBond(manager, payout, duration);
    assert(expectedValidatorBond.gte(new BN(0)) && expectedAgentBond.gte(new BN(0)));
  });

});
