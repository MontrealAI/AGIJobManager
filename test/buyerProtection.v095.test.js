const assert = require('node:assert/strict');
const { buildInitConfig } = require('./helpers/deploy');
const { rootNode, setNameWrapperOwnership } = require('./helpers/ens');
const { expectCustomError } = require('./helpers/errors');

contract('v0.9.5 buyer protection and payment isolation', accounts => {
  const [owner, buyer, agent, alice, bob, carol, operator, outsider, wallet30, wallet10] = accounts;
  const Manager = artifacts.require('AGIJobManager');
  const club = rootNode('club'), agents = rootNode('agents'), zero = '0x' + '00'.repeat(32);
  const cost = 100000000n;
  let manager, token, wrapper, bond;
  const rpc = (method, params = []) => web3.currentProvider.request({ method, params });
  const advance = async seconds => { await rpc('evm_increaseTime', [seconds]); await rpc('evm_mine'); };
  const balance = async account => BigInt((await token.balanceOf(account)).toString());
  const number = async getter => BigInt((await manager[getter]()).toString());
  const submit = () => manager.requestJobCompletion(0, 'ipfs://submission-evidence', { from: agent });
  const vote = (who, label, approve = true) => manager[approve ? 'validateJob' : 'disapproveJob'](0, label, [], { from: who });
  const voteThree = async approve => {
    for (const [who, label] of [[alice, 'alice'], [bob, 'bob'], [carol, 'carol']]) await vote(who, label, approve);
  };
  const clean = async () => {
    for (const getter of ['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds']) assert.equal(await number(getter), 0n, getter);
    assert.equal(await balance(manager.address), await number('lockedClaims'));
    assert.equal(await number('withdrawableUSDC'), 0n);
  };
  async function fixture(tokenName = 'MockUSDCControls') {
    token = await artifacts.require(tokenName).new();
    const ens = await artifacts.require('MockENSRegistry').new();
    wrapper = await artifacts.require('MockNameWrapper').new();
    manager = await Manager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, wrapper.address, club, agents, zero, zero, zero, zero, [wallet30, wallet10]));
    const nft = await artifacts.require('MockERC721').new();
    await nft.mint(agent); await manager.addAGIType(nft.address, 1);
    await setNameWrapperOwnership(wrapper, agents, 'worker', agent);
    for (const [who, label] of [[alice, 'alice'], [bob, 'bob'], [carol, 'carol'], [agent, 'agent'], [buyer, 'buyer']]) {
      await setNameWrapperOwnership(wrapper, club, label, who);
    }
    for (const who of [buyer, agent, alice, bob, carol, operator, outsider]) {
      await token.mint(who, '1000000000'); await token.approve(manager.address, '1000000000', { from: who });
    }
    await manager.setCompletionReviewPeriod(100); await manager.setChallengePeriodAfterApproval(20); await manager.setDisputeReviewPeriod(40);
    await manager.addModerator(owner); await manager.unpauseIntake();
    await manager.createJob('ipfs://acceptance-criteria', cost.toString(), 3600, 'Measured acceptance criteria', { from: buyer });
    await manager.applyForJob(0, 'worker', [], { from: agent });
    bond = await number('lockedAgentBonds');
  }
  beforeEach(async () => { await fixture(); });

  it('escalates an unsupported submission instead of automatically paying the agent', async () => {
    await submit(); const before = await balance(agent); await advance(101); await manager.finalizeJob(0, { from: outsider });
    assert.equal((await manager.getJobCore(0)).disputed, true);
    assert.equal(await balance(agent), before); assert.equal(await number('lockedEscrow'), cost);
    assert.equal(await balance(wallet30), 0n); assert.equal(await balance(wallet10), 0n);
  });
  it('lets the buyer explicitly accept submitted work without granting unverified reputation', async () => {
    await submit(); const before = await balance(agent); await manager.acceptJob(0, { from: buyer });
    assert.equal(await balance(agent) - before, cost * 60n / 100n + bond);
    assert.equal((await manager.reputation(agent)).toString(), '0'); await clean();
  });
  it('rejects acceptance by outsiders, before submission, and after a dispute', async () => {
    await expectCustomError(manager.acceptJob(0, { from: buyer }), 'InvalidState'); await submit();
    await expectCustomError(manager.acceptJob(0, { from: agent }), 'NotAuthorized');
    await manager.disputeJob(0, { from: buyer });
    await expectCustomError(manager.acceptJob(0, { from: buyer }), 'InvalidState');
  });
  it('guarantees the full review period despite an early approval threshold', async () => {
    await submit(); await voteThree(true); await advance(21);
    await expectCustomError(manager.finalizeJob(0), 'InvalidState');
    await advance(81); await manager.finalizeJob(0); await clean();
  });
  it('extends the dispute opportunity when approvals arrive near the review deadline', async () => {
    await submit(); await advance(90); await voteThree(true);
    const deadlines = await manager.getJobDeadlines(0);
    assert(BigInt(deadlines.settlementAfter.toString()) > BigInt(deadlines.reviewEnd.toString()));
    await advance(11); await manager.disputeJob(0, { from: buyer });
    assert.equal((await manager.getJobCore(0)).disputed, true);
  });
  it('enforces strict settlement and inclusive dispute boundaries', async () => {
    await submit(); const end = Number((await manager.getJobDeadlines(0)).settlementAfter.toString());
    await rpc('evm_setNextBlockTimestamp', [end]); await rpc('evm_mine');
    await expectCustomError(manager.finalizeJob.call(0), 'InvalidState');
    await manager.disputeJob(0, { from: buyer }); assert.equal((await manager.getJobCore(0)).disputed, true);
  });
  it('does not let buyer acceptance slash a dissenting reviewer', async () => {
    await submit(); const before = await balance(alice);
    await vote(alice, 'alice', false);
    await manager.acceptJob(0, { from: buyer });
    assert.equal(await balance(alice), before, 'dissenting reviewer receives the full bond back');
    assert.equal((await manager.reputation(alice)).toString(), '0');
    assert.equal((await manager.reputation(agent)).toString(), '0');
    await clean();
  });
  it('returns at least the full escrow on a buyer win and funds rewards from the forfeited agent bond', async () => {
    await submit(); await voteThree(false); const before = await balance(buyer);
    await manager.resolveDisputeWithCode(0, 2, 'Acceptance criteria failed');
    const refund = await balance(buyer) - before;
    assert(refund >= cost && refund < cost + 3n);
    assert.equal(await balance(wallet30), 0n); assert.equal(await balance(wallet10), 0n); await clean();
  });
  it('returns the full escrow plus agent bond when a buyer wins with no validator votes', async () => {
    await submit(); await manager.disputeJob(0, { from: agent }); const before = await balance(buyer);
    await manager.resolveDisputeWithCode(0, 2, 'No usable delivery');
    assert.equal(await balance(buyer) - before, cost + bond + 1000000n); await clean();
  });
  it('preserves no-submission expiry compensation', async () => {
    const before = await balance(buyer); await advance(3601); await manager.expireJob(0, { from: outsider });
    assert.equal(await balance(buyer) - before, cost + bond); await clean();
  });
  it('rejects both job parties as validators', async () => {
    await submit(); await expectCustomError(vote(agent, 'agent'), 'NotAuthorized');
    await expectCustomError(vote(buyer, 'buyer'), 'NotAuthorized');
  });
  it('rejects a party-controlled credential even through an approved operator', async () => {
    await wrapper.setApprovalForAll(operator, true, { from: agent }); await submit();
    await expectCustomError(vote(operator, 'agent'), 'NotAuthorized');
  });
  it('prevents one Club subname from voting through multiple operators', async () => {
    await wrapper.setApprovalForAll(operator, true, { from: alice }); await submit(); await vote(alice, 'alice');
    await expectCustomError(vote(operator, 'alice'), 'InvalidState');
    assert.equal((await manager.getJobValidation(0)).validatorApprovals.toString(), '1');
  });
  it('prevents credential transfers from creating an additional vote', async () => {
    await submit(); await vote(alice, 'alice'); await setNameWrapperOwnership(wrapper, club, 'alice', operator);
    await expectCustomError(vote(operator, 'alice'), 'InvalidState');
  });
  it('prevents one controller from using multiple Club names in the same job', async () => {
    await setNameWrapperOwnership(wrapper, club, 'another', alice); await wrapper.setApprovalForAll(operator, true, { from: alice });
    await submit(); await vote(alice, 'alice'); await expectCustomError(vote(operator, 'another'), 'InvalidState');
  });
  it('allows distinct ENS credentials without requiring an owner exception', async () => {
    await submit(); await voteThree(true);
    assert.equal((await manager.getJobValidation(0)).validatorApprovals.toString(), '3');
    for (const voter of [alice, bob, carol]) assert.equal(await manager.additionalValidators(voter), false);
  });
  it('keeps owner-issued exception credentials explicit and rejects party exceptions', async () => {
    await manager.addAdditionalValidator(outsider); await manager.addAdditionalValidator(agent); await submit();
    await vote(outsider, ''); await expectCustomError(vote(agent, ''), 'NotAuthorized');
    const credential = await manager.validatorCredential(outsider, '', []);
    assert.equal(credential.controller, outsider);
  });
  it('rejects a voter or either party acting as moderator', async () => {
    await manager.addModerator(alice); await manager.addModerator(buyer); await manager.addModerator(agent);
    await submit(); await vote(alice, 'alice'); await manager.disputeJob(0, { from: buyer });
    for (const who of [alice, buyer, agent]) await expectCustomError(manager.resolveDisputeWithCode(0, 1, 'Conflict', { from: who }), 'NotAuthorized');
    await manager.resolveDisputeWithCode(0, 2, 'Independent decision'); await clean();
  });
  it('stops review time during a settlement pause and preserves the buyer dispute opportunity', async () => {
    await submit(); await advance(30); const before = await manager.getJobDeadlines(0);
    await manager.setSettlementPaused(true); await advance(200); await manager.setSettlementPaused(true);
    await manager.setSettlementPaused(false); const after = await manager.getJobDeadlines(0);
    assert(Number(after.settlementAfter.toString()) >= Number(before.settlementAfter.toString()) + 200);
    await manager.disputeJob(0, { from: buyer }); assert.equal((await manager.getJobCore(0)).disputed, true);
  });
  it('stops assignment time so a pause cannot force an otherwise timely agent to miss delivery', async () => {
    await manager.pauseAll(); await advance(4000); await manager.unpauseAll(); await submit();
    assert.equal((await manager.getJobValidation(0)).completionRequested, true);
  });
  it('stops arbitration time across repeated pause cycles', async () => {
    await submit(); await manager.disputeJob(0, { from: buyer });
    for (let i = 0; i < 2; i++) { await manager.pauseAll(); await advance(100); await manager.unpauseAll(); }
    await expectCustomError(manager.resolveStaleDispute(0, true), 'InvalidState');
    await expectCustomError(manager.refundUnresolvedDispute(0), 'InvalidState');
    await advance(41); await manager.resolveStaleDispute(0, true); await clean();
  });
  it('provides a permissionless neutral refund after unanswered arbitration with no votes', async () => {
    await submit(); await advance(101); await manager.finalizeJob(0); const buyerBefore = await balance(buyer), agentBefore = await balance(agent);
    await expectCustomError(manager.refundUnresolvedDispute(0), 'InvalidState'); await advance(81);
    await manager.refundUnresolvedDispute(0, { from: outsider });
    assert.equal(await balance(buyer) - buyerBefore, cost); assert.equal(await balance(agent) - agentBefore, bond);
    assert.equal((await manager.getJobCore(0)).expired, true); assert.equal((await manager.nextTokenId()).toString(), '0'); await clean();
  });
  it('neutral timeout returns voter and initiator bonds without outcome slashing or reputation', async () => {
    await submit(); await vote(alice, 'alice'); await manager.disputeJob(0, { from: buyer });
    const beforeBuyer = await balance(buyer), beforeAlice = await balance(alice), validatorBond = await number('lockedValidatorBonds');
    await advance(81); await manager.refundUnresolvedDispute(0);
    assert.equal(await balance(buyer) - beforeBuyer, cost + 1000000n); assert.equal(await balance(alice) - beforeAlice, validatorBond);
    assert.equal((await manager.reputation(alice)).toString(), '0'); await clean();
  });
  it('isolates a blocked settlement wallet and reserves its payment', async () => {
    await submit(); await token.setBlocked(wallet30, true); const before = await balance(agent);
    await manager.acceptJob(0, { from: buyer });
    assert.equal(await balance(agent) - before, 60000000n + bond); assert.equal(await balance(wallet10), 10000000n);
    assert.equal((await manager.pendingUSDC(wallet30)).toString(), '30000000'); await clean();
  });
  it('preserves a failed claim and permits anyone to retry only to the beneficiary', async () => {
    await submit(); await token.setBlocked(wallet30, true); await manager.acceptJob(0, { from: buyer });
    await expectCustomError(manager.claimUSDC(wallet30, { from: outsider }), 'TransferFailed');
    assert.equal((await manager.pendingUSDC(wallet30)).toString(), '30000000');
    await token.setBlocked(wallet30, false); await manager.claimUSDC(wallet30, { from: outsider });
    assert.equal(await balance(wallet30), 30000000n); await expectCustomError(manager.claimUSDC(wallet30), 'InvalidState'); await clean();
  });
  it('does not let the owner withdraw or rescue deferred payments', async () => {
    await submit(); await token.setBlocked(wallet30, true); await manager.acceptJob(0, { from: buyer }); await manager.pauseIntake();
    await expectCustomError(manager.withdrawUSDC(1), 'InsufficientWithdrawableBalance');
    await expectCustomError(manager.rescueERC20(token.address, owner, 1), 'InsufficientWithdrawableBalance');
    await manager.setSettlementWallets(outsider, operator);
    assert.equal((await manager.pendingUSDC(wallet30)).toString(), '30000000'); await clean();
  });
  it('isolates a blocked validator so other recipients can settle', async () => {
    await submit(); await voteThree(true); await token.setBlocked(alice, true); await advance(101); await manager.finalizeJob(0);
    assert(BigInt((await manager.pendingUSDC(alice)).toString()) > 0n);
    assert.equal(await balance(wallet30), 30000000n); await clean();
  });
  it('reserves every entitlement while USDC is issuer-paused and pays after restoration', async () => {
    await submit(); await token.setPaused(true); await manager.acceptJob(0, { from: buyer });
    assert.equal(await number('lockedClaims'), cost + bond); await clean(); await token.setPaused(false);
    for (const who of [agent, wallet30, wallet10]) await manager.claimUSDC(who, { from: outsider }); await clean();
  });
  it('keeps an issuer-blocked buyer refund reserved without blocking job closure', async () => {
    await submit(); await manager.disputeJob(0, { from: buyer }); await token.setBlocked(buyer, true);
    await manager.resolveDisputeWithCode(0, 2, 'Buyer wins');
    assert(BigInt((await manager.pendingUSDC(buyer)).toString()) >= cost); await clean();
  });
  it('rejects direct access to the isolated token-transfer entry point', async () => {
    for (const who of [owner, buyer, outsider]) await expectCustomError(manager.executeUSDCTransfer(who, cost.toString(), { from: who }), 'NotAuthorized');
    assert.equal(await balance(manager.address), cost + bond);
  });
  it('rolls back a token that transfers then returns false before recording a deferred entitlement', async () => {
    await fixture('FalseAfterTransferUSDC'); await submit(); await token.setReturnFalse(true);
    await manager.acceptJob(0, { from: buyer }); assert.equal(await balance(wallet30), 0n);
    assert.equal(await number('lockedClaims'), cost + bond); await clean();
    await token.setReturnFalse(false); for (const who of [agent, wallet30, wallet10]) await manager.claimUSDC(who); await clean();
  });
});
