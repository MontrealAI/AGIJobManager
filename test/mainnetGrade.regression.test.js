const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockERC721 = artifacts.require('MockERC721');
const MockENSJobPages = artifacts.require('MockENSJobPages');
const { buildInitConfig } = require('./helpers/deploy');
const { rootNode } = require('./helpers/ens');
const { expectCustomError } = require('./helpers/errors');

contract('mainnet-grade regressions', (accounts) => {
  const [owner, employer, agent, validator] = accounts;

  async function deploy() {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nw = await MockNameWrapper.new({ from: owner });
    const manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        'ipfs://',
        ens.address,
        nw.address,
        rootNode('club'),
        rootNode('agent'),
        rootNode('club'),
        rootNode('agent'),
        '0x' + '00'.repeat(32),
        '0x' + '00'.repeat(32)
      ),
      { from: owner }
    );
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setVoteQuorum(1, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });
    await manager.setDisputeReviewPeriod(1, { from: owner });
    return { token, manager };
  }

  it('enforces details byte cap in createJob', async () => {
    const { token, manager } = await deploy();
    const payout = web3.utils.toWei('1');
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    await manager.createJob('ipfs://ok', payout, 5, 'a'.repeat(2048), { from: employer });

    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await expectCustomError(
      manager.createJob.call('ipfs://too-big', payout, 5, 'b'.repeat(2049), { from: employer }),
      'InvalidParameters'
    );
  });

  it('keeps reputation monotone and capped', async () => {
    const { token, manager } = await deploy();
    const payout = web3.utils.toWei('1000');
    await token.mint(agent, web3.utils.toWei('50000'), { from: owner });
    await token.mint(validator, web3.utils.toWei('50000'), { from: owner });
    await token.approve(manager.address, web3.utils.toWei('50000'), { from: agent });
    await token.approve(manager.address, web3.utils.toWei('50000'), { from: validator });

    let lastRep = new BN(0);
    for (let i = 0; i < 12; i++) {
      await token.mint(employer, payout, { from: owner });
      await token.approve(manager.address, payout, { from: employer });
      await manager.createJob(`ipfs://spec-${i}`, payout, 5, 'd', { from: employer });
      await manager.applyForJob(i, 'agent', [], { from: agent });
      await manager.requestJobCompletion(i, `ipfs://done-${i}`, { from: agent });
      await manager.validateJob(i, 'validator', [], { from: validator });
      await time.increase(3);
      await manager.finalizeJob(i, { from: employer });
      const currentRep = new BN(await manager.reputation(agent));
      assert(currentRep.gte(lastRep), 'reputation should be monotone non-decreasing');
      assert(currentRep.lte(new BN('88888')), 'reputation should stay capped');
      lastRep = currentRep;
    }
  });

  it('locks merkle root rewrites while escrow is active', async () => {
    const { token, manager } = await deploy();
    const payout = web3.utils.toWei('10');
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await token.mint(agent, web3.utils.toWei('10'), { from: owner });
    await token.approve(manager.address, web3.utils.toWei('10'), { from: agent });

    await manager.createJob('ipfs://spec', payout, 1000, 'd', { from: employer });
    await expectCustomError(manager.updateMerkleRoots.call('0x' + '11'.repeat(32), '0x' + '22'.repeat(32), { from: owner }), 'InvalidState');

    await manager.applyForJob(0, 'agent', [], { from: agent });
    await expectCustomError(manager.updateMerkleRoots.call('0x' + '33'.repeat(32), '0x' + '44'.repeat(32), { from: owner }), 'InvalidState');
  });

  it('keeps intake pause separate from settlement pause semantics', async () => {
    const { token, manager } = await deploy();
    const payout = web3.utils.toWei('2');
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await token.mint(agent, web3.utils.toWei('5'), { from: owner });
    await token.approve(manager.address, web3.utils.toWei('5'), { from: agent });
    await token.mint(validator, web3.utils.toWei('5'), { from: owner });
    await token.approve(manager.address, web3.utils.toWei('5'), { from: validator });

    await manager.createJob('ipfs://spec', payout, 100, 'd', { from: employer });
    await manager.pause({ from: owner });
    await expectRevert.unspecified(manager.createJob('ipfs://spec2', payout, 100, 'd', { from: employer }));
    await expectRevert.unspecified(manager.applyForJob(0, 'agent', [], { from: agent }));

    await manager.unpause({ from: owner });
    await manager.applyForJob(0, 'agent', [], { from: agent });
    await manager.requestJobCompletion(0, 'ipfs://done', { from: agent });
    await manager.validateJob(0, 'validator', [], { from: validator });

    await manager.pause({ from: owner });
    await manager.setSettlementPaused(true, { from: owner });
    await expectCustomError(manager.requestJobCompletion.call(0, 'ipfs://done2', { from: agent }), 'SettlementPaused');
    await expectCustomError(manager.finalizeJob.call(0, { from: employer }), 'SettlementPaused');

    await manager.unpause({ from: owner });
    await manager.setSettlementPaused(false, { from: owner });
    await time.increase(3);
    await manager.finalizeJob(0, { from: employer });
    const core = await manager.getJobCore(0);
    assert.equal(core.completed, true);
  });

  it('emits EnsHookAttempted and does not revert on hook failures', async () => {
    const { token, manager } = await deploy();
    const pages = await MockENSJobPages.new({ from: owner });
    await manager.setEnsJobPages(pages.address, { from: owner });
    const payout = web3.utils.toWei('1');
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });

    let receipt = await manager.createJob('ipfs://spec', payout, 100, 'd', { from: employer });
    expectEvent(receipt, 'EnsHookAttempted', { hook: '1', jobId: '0', target: pages.address, success: true });

    await pages.setRevertHook(1, true, { from: owner });
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    receipt = await manager.createJob('ipfs://spec-2', payout, 100, 'd', { from: employer });
    expectEvent(receipt, 'EnsHookAttempted', { hook: '1', jobId: '1', target: pages.address, success: false });
  });
});
