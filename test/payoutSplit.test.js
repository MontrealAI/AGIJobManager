const { deployActive } = require('./helpers/deploy');
const assert = require('assert');
const { time, expectRevert } = require('../scripts/test-helpers.cjs');
const { buildInitConfig } = require('./helpers/deploy');
const { parseUSDC } = require('../scripts/lib/usdc');
const Manager = artifacts.require('AGIJobManager');
const USDC = artifacts.require('MockUSDCControls');
const NFT = artifacts.require('MockERC721');
const Z = '0x' + '00'.repeat(32);
const A0 = '0x' + '00'.repeat(20);

contract('v0.8.0 USDC distribution', ([owner, employer, agent, validator, wallet30, wallet10, other]) => {
  let token, manager;
  const init = wallets => buildInitConfig(token.address, '', A0, A0, Z, Z, Z, Z, Z, Z, wallets);
  beforeEach(async () => {
    token = await USDC.new();
    manager = await deployActive(Manager, ...init([wallet30, wallet10]));
    const nft = await NFT.new();
    await nft.mint(agent);
    await manager.addAGIType(nft.address, 1);
    await manager.addAdditionalAgent(agent);
    await manager.addAdditionalValidator(validator);
    await manager.setAgentBondParams(0, 0, 0);
    await manager.setValidatorBondParams(0, 0, 0);
    await manager.setCompletionReviewPeriod(1);
    await manager.setChallengePeriodAfterApproval(1);
    await manager.setRequiredValidatorApprovals(1);
    await manager.setVoteQuorum(1);
  });
  async function post(amount) {
    await token.mint(employer, amount);
    await token.approve(manager.address, amount, { from: employer });
    const tx = await manager.createJob('ipfs://job', amount, 1000, 'job', { from: employer });
    return tx.logs.find(x => x.event === 'JobCreated').args.jobId;
  }
  async function ready(id, vote = true) {
    await manager.applyForJob(id, '', [], { from: agent });
    await manager.requestJobCompletion(id, 'ipfs://done', { from: agent });
    if (vote) await manager.validateJob(id, '', [], { from: validator });
    await time.increase(2);
  }
  async function balance(address) { return BigInt((await token.balanceOf(address)).toString()); }
  it('uses rotated wallets for future jobs and never redirects an outstanding job', async () => {
    const oldJob = await post(parseUSDC('100'));
    await ready(oldJob);
    await manager.pauseIntake();
    await expectRevert.unspecified(manager.setSettlementWallets(other, owner));
    await manager.finalizeJob(oldJob);
    assert.equal(await balance(wallet30), BigInt(parseUSDC('30')));
    assert.equal(await balance(wallet10), BigInt(parseUSDC('10')));
    await manager.setSettlementWallets(other, owner);
    await manager.unpauseIntake();
    const nextJob = await post(parseUSDC('100'));
    await ready(nextJob); await manager.finalizeJob(nextJob);
    assert.equal(await balance(other), BigInt(parseUSDC('30')));
    assert.equal(await balance(owner), BigInt(parseUSDC('10')));
    assert.equal(await balance(wallet30), BigInt(parseUSDC('30')));
    assert.equal(await balance(agent), BigInt(parseUSDC('104')));
  });
  it('blocks owner wallet rotation reentrancy during completion even after reserves reach zero', async () => {
    const Receiver = artifacts.require('OwnerRotationReceiver');
    const receiver = await Receiver.new(manager.address, other, owner);
    const send = (target, method) => receiver.execute(target.address, method.encodeABI());
    await token.mint(receiver.address, parseUSDC('100'));
    await send(token, token.contract.methods.approve(manager.address, parseUSDC('100')));
    await send(manager, manager.contract.methods.createJob('ipfs://job', parseUSDC('100'), 1000, ''));
    await ready(0);
    await manager.transferOwnership(receiver.address);
    await send(manager, manager.contract.methods.acceptOwnership());
    await send(manager, manager.contract.methods.pauseIntake());
    await manager.finalizeJob(0);
    assert.equal(await receiver.attempted(), true);
    assert.equal(await receiver.succeeded(), false);
    assert.equal(await manager.wallet30(), wallet30);
    assert.equal((await manager.lockedEscrow()).toString(), '0');
    assert.equal(await balance(wallet30), BigInt(parseUSDC('30')));
    assert.equal(await balance(wallet10), BigInt(parseUSDC('10')));
  });
  it('pays validators, 30%, 10%, then the agent, atomically in that order', async () => {
    const id = await post(parseUSDC('100'));
    await ready(id);
    const tx = await manager.finalizeJob(id);
    for (const [address, amount] of [[validator, 8], [wallet30, 30], [wallet10, 10], [agent, 52]]) {
      assert.equal(await balance(address), BigInt(parseUSDC(String(amount))));
    }
    const transfers = await token.getPastEvents('Transfer', { fromBlock: tx.receipt.blockNumber, toBlock: tx.receipt.blockNumber });
    const outgoing = transfers.filter(x => x.returnValues.from.toLowerCase() === manager.address.toLowerCase());
    assert.deepEqual(outgoing.map(x => x.returnValues.to.toLowerCase()), [validator, wallet30, wallet10, agent].map(x => x.toLowerCase()));
    const event = tx.logs.find(x => x.event === 'JobPayoutDistributed');
    assert.equal(event.args.agentAmount.toString(), parseUSDC('52'));
    assert.equal(await balance(manager.address), 0n);
    assert.equal((await manager.lockedEscrow()).toString(), '0');
    assert.equal((await manager.withdrawableUSDC()).toString(), '0');
    await expectRevert.unspecified(manager.finalizeJob(id));
  });
  it('locks the validator rate at posting, before assignment and later owner changes', async () => {
    const first = await post(parseUSDC('100'));
    await manager.setValidationRewardPercentage(12);
    const second = await post(parseUSDC('100'));
    assert.equal((await manager.getJobCore(first)).agentPayoutPct.toString(), '52');
    assert.equal((await manager.getJobCore(second)).agentPayoutPct.toString(), '48');
    await ready(first); await manager.finalizeJob(first);
    await ready(second); await manager.finalizeJob(second);
    assert.equal(await balance(validator), BigInt(parseUSDC('20')));
    assert.equal(await balance(agent), BigInt(parseUSDC('100')));
    assert.equal(await balance(wallet30), BigInt(parseUSDC('60')));
    assert.equal(await balance(wallet10), BigInt(parseUSDC('20')));
  });
  it('requires distinct nonzero settlement wallets and bounds the validator budget', async () => {
    for (const wallets of [[A0, wallet10], [wallet30, A0], [wallet30, wallet30], [token.address, wallet10], [wallet30, token.address]]) {
      await assert.rejects(deployActive(Manager, ...init(wallets)), /revert|Custom error|code couldn.t be stored/);
    }
    assert.equal(await manager.wallet30(), wallet30);
    assert.equal(await manager.wallet10(), wallet10);
    for (const rate of [0, 61, 100]) await expectRevert.unspecified(manager.setValidationRewardPercentage(rate));
    await manager.setValidationRewardPercentage(60);
    const id = await post(parseUSDC('100')); await ready(id); await manager.finalizeJob(id);
    assert.equal(await balance(agent), 0n);
    assert.equal(await balance(manager.address), 0n);
  });
  it('assigns rounding and unused validator budget to the agent without retaining micro-USDC', async () => {
    for (const [amount, vote] of [['1', true], ['101', true], ['999999', true], [parseUSDC('100'), false]]) {
      const before = [await balance(validator), await balance(wallet30), await balance(wallet10), await balance(agent)];
      const id = await post(amount); await ready(id, vote);
      if (vote) await manager.finalizeJob(id); else await manager.acceptJob(id, { from: employer });
      const p = BigInt(amount), v = vote ? p * 8n / 100n : 0n, a = p * 30n / 100n, b = p * 10n / 100n;
      const after = [await balance(validator), await balance(wallet30), await balance(wallet10), await balance(agent)];
      assert.deepEqual(after.map((x, i) => x - before[i]), [v, a, b, p - v - a - b]);
      assert.equal(await balance(manager.address), 0n);
    }
  });
  for (const recipient of ['validator', 'wallet30', 'wallet10', 'agent']) {
    it(`reserves only the blocked ${recipient} payment and settles other beneficiaries`, async () => {
      const id = await post(parseUSDC('100')); await ready(id);
      const address = { validator, wallet30, wallet10, agent }[recipient];
      await token.setBlocked(address, true);
      await manager.finalizeJob(id);
      assert.equal((await manager.getJobCore(id)).completed, true);
      assert.equal((await manager.lockedEscrow()).toString(), '0');
      const entitlements = {validator:8n, wallet30:30n, wallet10:10n, agent:52n};
      const deferred = entitlements[recipient] * 1000000n;
      assert.equal((await manager.pendingUSDC(address)).toString(), deferred.toString());
      for (const [role,to] of Object.entries({validator,wallet30,wallet10,agent})) assert.equal(await balance(to), role === recipient ? 0n : entitlements[role] * 1000000n);
      await token.setBlocked(address, false); await manager.claimUSDC(address);
      assert.equal(await balance(manager.address), 0n);
    });
  }
  it('does not take wallet shares from cancellations or employer-win dispute refunds', async () => {
    const canceled = await post(parseUSDC('100'));
    await manager.cancelJob(canceled, { from: employer });
    await manager.setCompletionReviewPeriod(1000);
    const id = await post(parseUSDC('100')); await ready(id, false);
    await manager.addModerator(other);
    await token.mint(employer, parseUSDC('1'));
    await token.approve(manager.address, parseUSDC('1'), { from: employer });
    await manager.disputeJob(id, { from: employer });
    await manager.resolveDisputeWithCode(id, 2, 'refund', { from: other });
    for (const to of [wallet30, wallet10, agent]) assert.equal(await balance(to), 0n);
    assert.equal(await balance(manager.address), 0n);
  });
});
