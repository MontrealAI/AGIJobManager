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
const { fundValidators, fundAgents } = require('./helpers/bonds');

const leafFor = (address) => Buffer.from(web3.utils.soliditySha3({ type: 'address', value: address }).slice(2), 'hex');
const mkTree = (list) => { const t = new MerkleTree(list.map(leafFor), keccak256, { sortPairs: true }); return { root: t.getHexRoot(), proofFor: (a) => t.getHexProof(leafFor(a)) }; };

contract('escrowAccounting.invariants', (accounts) => {
  const [owner, employer, agent, v1, v2, v3] = accounts;
  const payout = new BN(web3.utils.toWei('1000'));

  it('keeps solvency invariants through bounded mixed outcomes', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new(); const nft = await MockERC721.new();
    const agentTree = mkTree([agent]); const validatorTree = mkTree([v1, v2, v3]);
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), validatorTree.root, agentTree.root), { from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner }); await nft.mint(agent); await manager.addModerator(owner, { from: owner });
    await token.mint(employer, payout.muln(10)); await token.approve(manager.address, payout.muln(10), { from: employer });
    await fundValidators(token, manager, [v1, v2, v3], owner); await fundAgents(token, manager, [agent], owner);
    await manager.setChallengePeriodAfterApproval(1, { from: owner });

    for (let i = 0; i < 6; i += 1) {
      await manager.createJob(`QmSpec-${i}`, payout, 5000, 'd', { from: employer });
      await manager.applyForJob(i, 'agent', agentTree.proofFor(agent), { from: agent });
      if (i % 3 === 0) {
        await manager.requestJobCompletion(i, `QmDone-${i}`, { from: agent });
        await manager.validateJob(i, 'validator', validatorTree.proofFor(v1), { from: v1 });
        await manager.validateJob(i, 'validator', validatorTree.proofFor(v2), { from: v2 });
        await manager.validateJob(i, 'validator', validatorTree.proofFor(v3), { from: v3 });
        await time.increase(2);
        await manager.finalizeJob(i, { from: employer });
      } else if (i % 3 === 1) {
        await time.increase(6001);
        await manager.expireJob(i, { from: employer });
      } else {
        await manager.requestJobCompletion(i, `QmDone-${i}`, { from: agent });
        await manager.disputeJob(i, { from: employer });
        await manager.resolveDisputeWithCode(i, 2, 'employer win', { from: owner });
      }

      const [lockedEscrow, lockedAgent, lockedValidator, lockedDispute] = await Promise.all([
        manager.lockedEscrow(), manager.lockedAgentBonds(), manager.lockedValidatorBonds(), manager.lockedDisputeBonds(),
      ]);
      const balance = await token.balanceOf(manager.address);
      const locked = lockedEscrow.add(lockedAgent).add(lockedValidator).add(lockedDispute);
      assert(balance.gte(locked), `insolvent after scenario ${i}`);
      assert((await manager.withdrawableAGI()).eq(balance.sub(locked)));
    }
  });
});
