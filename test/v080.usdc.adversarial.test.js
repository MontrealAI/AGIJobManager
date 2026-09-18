const assert = require('assert');
const { finalizeAfterReview } = require('./helpers/settlement');
const { time, expectRevert } = require('../scripts/test-helpers.cjs');
const { buildInitConfig, deployActive } = require('./helpers/deploy');
const Manager = artifacts.require('AGIJobManager');
const USDC = artifacts.require('MockUSDCControls');
const NFT = artifacts.require('MockERC721');
const ZERO = '0x' + '00'.repeat(20);
const ROOT = '0x' + '00'.repeat(32);
const COST = 100000000n;
const RESERVES = ['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds'];

contract('adversarial bonded USDC settlement with reserved claims', ([owner, employer, agent, validator, wallet30, wallet10, moderator, validator2]) => {
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
    await manager.setVoteQuorum(1);
    await manager.setChallengePeriodAfterApproval(1);
    await manager.setCompletionReviewPeriod(1000);
    for (const account of [agent, validator, validator2]) await fund(account, 1000000000n);
  });

  it('closes a disputed agent win and reserves blocked agent payout and both bonds', async () => {
    const id = await ready(); await dispute(id);
    assert((await reserves()).every(value => BigInt(value) > 0n));
    const agentBond = BigInt((await manager.lockedAgentBonds()).toString());
    await token.setBlocked(agent, true);
    await manager.resolveDisputeWithCode(id, 1, 'agent wins', { from: moderator });
    const due = 52000000n + agentBond + 1000000n;
    assert.equal((await manager.pendingUSDC(agent)).toString(), due.toString());
    assert.deepEqual(await reserves(), ['0', '0', '0', '0']);
    await manager.pauseIntake(); await manager.setSettlementWallets(owner, moderator);
    await expectRevert.unspecified(manager.withdrawUSDC(1));
    await token.setBlocked(agent, false); const before = await balance(agent);
    await manager.claimUSDC(agent);
    assert.equal(await balance(agent) - before, due);
    assert.equal(await balance(manager.address), 0n);
    assert.equal(await balance(wallet30), 30000000n); assert.equal(await balance(wallet10), 10000000n);
    await expectRevert.unspecified(manager.resolveDisputeWithCode(id, 1, 'repeat', { from: moderator }));
  });

  it('preserves the entire buyer refund and bond compensation as a reserved claim', async () => {
    const id = await ready(); await dispute(id); await token.setBlocked(employer, true);
    await manager.resolveDisputeWithCode(id, 2, 'employer wins', { from: moderator });
    const due = BigInt((await manager.pendingUSDC(employer)).toString());
    assert(due >= COST + 1000000n);
    assert.deepEqual(await reserves(), ['0', '0', '0', '0']);
    assert.equal(await balance(manager.address), due);
    assert.equal((await manager.withdrawableUSDC()).toString(), '0');
    await token.setBlocked(employer, false); const before = await balance(employer); await manager.claimUSDC(employer);
    assert.equal(await balance(employer) - before, due);
    assert.equal(await balance(manager.address), 0n); assert.equal(await balance(wallet30), 0n); assert.equal(await balance(wallet10), 0n);
  });

  for (const restriction of ['issuer pause', 'manager blacklist']) {
    it(`preserves every entitlement through ${restriction} and permits exactly one claim`, async () => {
      const id = await ready(); const funds = await balance(manager.address);
      if (restriction === 'issuer pause') await token.setPaused(true); else await token.setBlocked(manager.address, true);
      await finalizeAfterReview(manager, id);
      assert.deepEqual(await reserves(), ['0', '0', '0', '0']);
      assert.equal((await manager.lockedClaims()).toString(), funds.toString());
      assert.equal(await balance(manager.address), funds);
      await expectRevert.unspecified(manager.claimUSDC(agent));
      assert.equal((await manager.lockedClaims()).toString(), funds.toString());
      if (restriction === 'issuer pause') await token.setPaused(false); else await token.setBlocked(manager.address, false);
      for (const who of [agent, validator, wallet30, wallet10]) await manager.claimUSDC(who);
      assert.equal(await balance(manager.address), 0n); assert.equal((await manager.lockedClaims()).toString(), '0');
      await expectRevert.unspecified(manager.claimUSDC(agent)); await expectRevert.unspecified(manager.finalizeJob(id));
    });
  }

  it('isolates a blocked validator across both recipients and other jobs', async () => {
    const blockedId = await ready(validator), unaffectedId = await ready(validator2);
    await token.setBlocked(validator, true); await finalizeAfterReview(manager, blockedId); await finalizeAfterReview(manager, unaffectedId);
    const due = BigInt((await manager.pendingUSDC(validator)).toString());
    assert.equal(due, 23000000n);
    assert.deepEqual(await reserves(), ['0', '0', '0', '0']);
    assert.equal(await balance(manager.address), due);
    assert.equal((await manager.getJobCore(blockedId)).completed, true);
    assert.equal((await manager.getJobCore(unaffectedId)).completed, true);
    assert.equal((await manager.withdrawableUSDC()).toString(), '0');
    await token.setBlocked(validator, false); await manager.claimUSDC(validator); assert.equal(await balance(manager.address), 0n);
  });
});
