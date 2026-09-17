const assert = require('assert');
const { time, expectRevert } = require('../scripts/test-helpers.cjs');
const { buildInitConfig, deployActive } = require('./helpers/deploy');
const Manager = artifacts.require('AGIJobManager');
const USDC = artifacts.require('MockUSDCControls');
const NFT = artifacts.require('MockERC721');
const ZERO = '0x' + '00'.repeat(20);
const ROOT = '0x' + '00'.repeat(32);
const COST = 100000000n;
const RESERVES = ['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds'];

contract('v0.8.0 adversarial bonded USDC settlement', ([owner, employer, agent, validator, wallet30, wallet10, moderator, validator2]) => {
  let token, manager;
  const balance = async address => BigInt((await token.balanceOf(address)).toString());
  const reserves = async () => Promise.all(RESERVES.map(async getter => (await manager[getter]()).toString()));
  const balances = async () => Promise.all([employer, agent, validator, validator2, wallet30, wallet10, manager.address].map(balance));
  async function fund(address, amount) {
    await token.mint(address, amount.toString());
    await token.approve(manager.address, amount.toString(), { from: address });
  }
  async function ready(voter = validator) {
    await fund(employer, COST);
    const receipt = await manager.createJob('ipfs://adversarial', COST.toString(), 1000, '', { from: employer });
    const id = receipt.logs.find(x => x.event === 'JobCreated').args.jobId;
    await manager.applyForJob(id, '', [], { from: agent });
    await manager.requestJobCompletion(id, 'ipfs://completed', { from: agent });
    await manager.validateJob(id, '', [], { from: voter });
    return id;
  }
  async function dispute(id) {
    await fund(employer, 1000000n);
    await manager.disputeJob(id, { from: employer });
  }
  async function unchangedAfterFailure(operation, id) {
    const before = { reserves: await reserves(), balances: await balances(), core: await manager.getJobCore(id), validation: await manager.getJobValidation(id), nextTokenId: (await manager.nextTokenId()).toString(), rep: (await manager.reputation(agent)).toString() };
    await expectRevert.unspecified(operation());
    assert.deepEqual(await reserves(), before.reserves, 'every reserve must remain backed');
    assert.deepEqual(await balances(), before.balances, 'no recipient may retain an earlier transfer');
    const core = await manager.getJobCore(id), validation = await manager.getJobValidation(id);
    for (const flag of ['completed', 'disputed', 'expired']) assert.equal(core[flag], before.core[flag], flag);
    assert.equal(validation.disputedAt.toString(), before.validation.disputedAt.toString());
    assert.equal((await manager.nextTokenId()).toString(), before.nextTokenId, 'no NFT may survive rollback');
    assert.equal((await manager.reputation(agent)).toString(), before.rep, 'reputation must roll back');
    assert.equal((await manager.withdrawableUSDC()).toString(), '0', 'failed settlement creates no owner surplus');
  }
  beforeEach(async () => {
    token = await USDC.new();
    manager = await deployActive(Manager, ...buildInitConfig(token.address, '', ZERO, ZERO, ROOT, ROOT, ROOT, ROOT, ROOT, ROOT, [wallet30, wallet10]));
    const nft = await NFT.new();
    await nft.mint(agent);
    await manager.addAGIType(nft.address, 1);
    await manager.addAdditionalAgent(agent);
    await manager.addAdditionalValidator(validator);
    await manager.addAdditionalValidator(validator2);
    await manager.addModerator(moderator);
    await manager.setRequiredValidatorApprovals(1);
    await manager.setChallengePeriodAfterApproval(1);
    await manager.setCompletionReviewPeriod(1000);
    for (const account of [agent, validator, validator2]) await fund(account, 1000000000n);
  });

  it('rolls back all four reserve categories and earlier recipients when a disputed winning agent is blocked', async () => {
    const id = await ready();
    await dispute(id);
    assert((await reserves()).every(value => BigInt(value) > 0n));
    await token.setBlocked(agent, true);
    await unchangedAfterFailure(() => manager.resolveDisputeWithCode(id, 1, 'agent wins', { from: moderator }), id);
    await manager.pauseIntake();
    await expectRevert.unspecified(manager.setSettlementWallets(owner, moderator));
    await expectRevert.unspecified(manager.withdrawUSDC(1));
    await token.setBlocked(agent, false);
    const before = await balance(agent);
    const agentBond = BigInt((await manager.lockedAgentBonds()).toString());
    await manager.resolveDisputeWithCode(id, 1, 'agent wins', { from: moderator });
    assert.equal(await balance(agent) - before, 52000000n + agentBond + 1000000n);
    assert.deepEqual(await reserves(), ['0', '0', '0', '0']);
    assert.equal(await balance(manager.address), 0n);
    assert.equal(await balance(wallet30), 30000000n);
    assert.equal(await balance(wallet10), 10000000n);
    await expectRevert.unspecified(manager.resolveDisputeWithCode(id, 1, 'repeat', { from: moderator }));
  });

  it('preserves a disputed refund and every bond when the employer cannot receive USDC', async () => {
    const id = await ready();
    await dispute(id);
    await token.setBlocked(employer, true);
    await unchangedAfterFailure(() => manager.resolveDisputeWithCode(id, 2, 'employer wins', { from: moderator }), id);
    await token.setBlocked(employer, false);
    await manager.resolveDisputeWithCode(id, 2, 'employer wins', { from: moderator });
    assert.deepEqual(await reserves(), ['0', '0', '0', '0']);
    assert.equal(await balance(manager.address), 0n);
    assert.equal(await balance(wallet30), 0n);
    assert.equal(await balance(wallet10), 0n);
  });

  for (const restriction of ['issuer pause', 'manager blacklist']) {
    it(`preserves bonded jobs during ${restriction} and permits exactly one successful retry`, async () => {
      const id = await ready();
      await time.increase(2);
      if (restriction === 'issuer pause') await token.setPaused(true);
      else await token.setBlocked(manager.address, true);
      await unchangedAfterFailure(() => manager.finalizeJob(id), id);
      if (restriction === 'issuer pause') await token.setPaused(false);
      else await token.setBlocked(manager.address, false);
      await manager.finalizeJob(id);
      assert.deepEqual(await reserves(), ['0', '0', '0', '0']);
      assert.equal(await balance(manager.address), 0n);
      await expectRevert.unspecified(manager.finalizeJob(id));
    });
  }

  it('isolates a blocked validator to their job while preserving its reserves through another settlement', async () => {
    const blockedId = await ready(validator);
    const blockedReserves = await reserves();
    const unaffectedId = await ready(validator2);
    await time.increase(2);
    await token.setBlocked(validator, true);
    await unchangedAfterFailure(() => manager.finalizeJob(blockedId), blockedId);
    await manager.finalizeJob(unaffectedId);
    assert.deepEqual(await reserves(), blockedReserves);
    assert.equal(await balance(manager.address), blockedReserves.reduce((sum, value) => sum + BigInt(value), 0n));
    assert.equal((await manager.getJobCore(blockedId)).completed, false);
    assert.equal((await manager.getJobCore(unaffectedId)).completed, true);
    assert.equal((await manager.withdrawableUSDC()).toString(), '0');
    await token.setBlocked(validator, false);
    await manager.finalizeJob(blockedId);
    assert.deepEqual(await reserves(), ['0', '0', '0', '0']);
    assert.equal(await balance(manager.address), 0n);
  });
});
