const { BN, time, expectRevert } = require('@openzeppelin/test-helpers');

const AGIJobManager = artifacts.require('AGIJobManager');
const ReputationHarness = artifacts.require('ReputationHarness');
const HookGasBurner = artifacts.require('HookGasBurner');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockERC721 = artifacts.require('MockERC721');
const MockENSJobPages = artifacts.require('MockENSJobPages');
const MockENSJobPagesMalformed = artifacts.require('MockENSJobPagesMalformed');

const { buildInitConfig } = require('./helpers/deploy');
const { expectCustomError } = require('./helpers/errors');

const ZERO32 = '0x' + '00'.repeat(32);

contract('mainnet governance + ops regressions', (accounts) => {
  const [owner, employer, agent, validator, user] = accounts;

  async function deployManager() {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await AGIJobManager.new(
      ...buildInitConfig(token.address, 'ipfs://base', ens.address, wrapper.address, ZERO32, ZERO32, ZERO32, ZERO32, ZERO32, ZERO32),
      { from: owner }
    );
    return { token, ens, wrapper, manager };
  }

  async function seedAssignedJob(ctx, payout = web3.utils.toWei('10')) {
    const nft = await MockERC721.new({ from: owner });
    await nft.mint(agent, { from: owner });
    await ctx.manager.addAGIType(nft.address, 90, { from: owner });
    await ctx.manager.addAdditionalAgent(agent, { from: owner });
    await ctx.manager.addAdditionalValidator(validator, { from: owner });

    await ctx.token.mint(employer, payout, { from: owner });
    await ctx.token.approve(ctx.manager.address, payout, { from: employer });
    await ctx.manager.createJob('ipfs://spec', payout, 1000, 'details', { from: employer });

    await ctx.token.mint(agent, web3.utils.toWei('3'), { from: owner });
    await ctx.token.approve(ctx.manager.address, web3.utils.toWei('3'), { from: agent });
    await ctx.manager.applyForJob(0, 'agent', [], { from: agent });
  }

  it('keeps reputation monotone and capped at 88888', async () => {
    const harness = await ReputationHarness.new({ from: owner });

    const increments = [1, 2, 7, 13, 144, 999, 5000, 20000, 70000];
    let prev = new BN('0');
    for (const points of increments) {
      await harness.grantReputation(user, points, { from: owner });
      const next = await harness.reputation(user);
      assert(next.gte(prev), 'reputation must be monotone for positive points');
      assert(next.lte(new BN('88888')), 'reputation must be capped');
      prev = next;
    }

    await harness.grantReputation(user, '999999999999', { from: owner });
    const capped = await harness.reputation(user);
    assert.equal(capped.toString(), '88888');
  });

  it('locks governance knobs while funds are in-flight but keeps merkle roots operational', async () => {
    const ctx = await deployManager();
    await seedAssignedJob(ctx);

    await expectCustomError(ctx.manager.setRequiredValidatorApprovals.call(1, { from: owner }), 'InvalidState');
    await expectCustomError(ctx.manager.setRequiredValidatorDisapprovals.call(1, { from: owner }), 'InvalidState');
    await expectCustomError(ctx.manager.setVoteQuorum.call(1, { from: owner }), 'InvalidState');
    await expectCustomError(ctx.manager.setCompletionReviewPeriod.call(1, { from: owner }), 'InvalidState');
    await expectCustomError(ctx.manager.setDisputeReviewPeriod.call(1, { from: owner }), 'InvalidState');
    await expectCustomError(ctx.manager.setValidatorBondParams.call(100, 1, 1, { from: owner }), 'InvalidState');
    await expectCustomError(ctx.manager.setAgentBondParams.call(100, 1, 1, { from: owner }), 'InvalidState');
    await expectCustomError(ctx.manager.setValidatorSlashBps.call(100, { from: owner }), 'InvalidState');
    await expectCustomError(ctx.manager.setChallengePeriodAfterApproval.call(1, { from: owner }), 'InvalidState');
    await ctx.manager.updateMerkleRoots(web3.utils.randomHex(32), web3.utils.randomHex(32), { from: owner });

    await time.increase(1001);
    await ctx.manager.expireJob(0, { from: employer });

    await ctx.manager.setRequiredValidatorApprovals(2, { from: owner });
    await ctx.manager.setRequiredValidatorDisapprovals(2, { from: owner });
    await ctx.manager.setVoteQuorum(2, { from: owner });
    await ctx.manager.setCompletionReviewPeriod(2, { from: owner });
    await ctx.manager.setDisputeReviewPeriod(2, { from: owner });
    await ctx.manager.setValidatorSlashBps(100, { from: owner });
    await ctx.manager.setChallengePeriodAfterApproval(2, { from: owner });
    await ctx.manager.updateMerkleRoots(web3.utils.randomHex(32), web3.utils.randomHex(32), { from: owner });
  });

  it('enforces MAX_JOB_DETAILS_BYTES during createJob', async () => {
    const ctx = await deployManager();
    const payout = web3.utils.toWei('1');
    await ctx.token.mint(employer, payout, { from: owner });
    await ctx.token.approve(ctx.manager.address, payout, { from: employer });

    const okDetails = 'a'.repeat(2048);
    await ctx.manager.createJob('ipfs://ok', payout, 100, okDetails, { from: employer });

    await ctx.token.mint(employer, payout, { from: owner });
    await ctx.token.approve(ctx.manager.address, payout, { from: employer });
    const tooLong = 'b'.repeat(2049);
    await expectCustomError(ctx.manager.createJob.call('ipfs://too-long', payout, 100, tooLong, { from: employer }), 'InvalidParameters');
  });

  it('separates pauseIntake from pauseAll semantics', async () => {
    const ctx = await deployManager();
    await ctx.manager.setRequiredValidatorApprovals(1, { from: owner });
    await ctx.manager.setVoteQuorum(1, { from: owner });
    await ctx.manager.setChallengePeriodAfterApproval(1, { from: owner });
    await ctx.manager.setCompletionReviewPeriod(1, { from: owner });
    await seedAssignedJob(ctx);

    await ctx.manager.pauseIntake({ from: owner });
    await ctx.token.mint(employer, web3.utils.toWei('1'), { from: owner });
    await ctx.token.approve(ctx.manager.address, web3.utils.toWei('1'), { from: employer });
    await expectRevert.unspecified(ctx.manager.createJob('ipfs://blocked', web3.utils.toWei('1'), 100, 'd', { from: employer }));

    await ctx.manager.requestJobCompletion(0, 'ipfs://done', { from: agent });

    await ctx.manager.pauseAll({ from: owner });
    await expectCustomError(ctx.manager.finalizeJob.call(0, { from: employer }), 'SettlementPaused');

    await ctx.manager.unpauseAll({ from: owner });
    await time.increase(3);
    await ctx.manager.finalizeJob(0, { from: employer });
  });

  it('emits EnsHookAttempted with success and failure states without bricking flows', async () => {
    const ctx = await deployManager();
    const happyHook = await MockENSJobPages.new({ from: owner });
    await ctx.manager.setEnsJobPages(happyHook.address, { from: owner });

    const payout = web3.utils.toWei('1');
    await ctx.token.mint(employer, payout, { from: owner });
    await ctx.token.approve(ctx.manager.address, payout, { from: employer });
    let receipt = await ctx.manager.createJob('ipfs://hook-ok', payout, 100, 'd', { from: employer });
    let hookLog = receipt.logs.find((l) => l.event === 'EnsHookAttempted');
    assert.equal(hookLog.args.success, true);
    assert.equal(await happyHook.lastHandleHookSelector(), '0x1f76f7a2', 'AGIJobManager must use handleHook(uint8,uint256) selector');
    assert.equal((await happyHook.lastHandleHookCalldataLength()).toString(), '68', 'AGIJobManager must send 0x44 bytes to handleHook');

    const revertHook = await MockENSJobPagesMalformed.new({ from: owner });
    await revertHook.setRevertOnHook(true, { from: owner });
    await ctx.manager.setEnsJobPages(revertHook.address, { from: owner });

    await ctx.token.mint(employer, payout, { from: owner });
    await ctx.token.approve(ctx.manager.address, payout, { from: employer });
    receipt = await ctx.manager.createJob('ipfs://hook-fail', payout, 100, 'd', { from: employer });
    hookLog = receipt.logs.find((l) => l.event === 'EnsHookAttempted');
    assert.equal(hookLog.args.success, false);

    const gasBurner = await HookGasBurner.new({ from: owner });
    await ctx.manager.setEnsJobPages(gasBurner.address, { from: owner });
    await ctx.token.mint(employer, payout, { from: owner });
    await ctx.token.approve(ctx.manager.address, payout, { from: employer });
    receipt = await ctx.manager.createJob('ipfs://hook-gas', payout, 100, 'd', { from: employer });
    hookLog = receipt.logs.find((l) => l.event === 'EnsHookAttempted');
    assert.equal(hookLog.args.success, false);
  });

  it('keeps merkle roots owner-updatable after identity lock', async () => {
    const ctx = await deployManager();
    await ctx.manager.lockIdentityConfiguration({ from: owner });
    await ctx.manager.updateMerkleRoots(web3.utils.randomHex(32), web3.utils.randomHex(32), { from: owner });
  });
});
