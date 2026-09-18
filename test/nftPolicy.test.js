const { deployActive, buildInitConfig } = require('./helpers/deploy');
const { expectRevert, expectEvent, time } = require('../scripts/test-helpers.cjs');
const { parseUSDC } = require('../scripts/lib/usdc');
const Manager = artifacts.require('AGIJobManager');
const Token = artifacts.require('MockUSDCControls');
const NFT = artifacts.require('MockERC721');
const Z = '0x' + '00'.repeat(32);
const A0 = '0x' + '00'.repeat(20);

contract('v1.0.3 posting-time NFT policy', ([owner, employer, agent, validator, wallet30, wallet10, outsider, nextOwner]) => {
  let manager, token, nft;
  beforeEach(async () => {
    token = await Token.new();
    manager = await deployActive(Manager, ...buildInitConfig(token.address, '', A0, A0, Z, Z, Z, Z, Z, Z, [wallet30, wallet10]));
    nft = await NFT.new();
    await manager.addAdditionalAgent(agent);
    await manager.addAdditionalValidator(validator);
    await manager.setAgentBondParams(0, 0, 0);
    await manager.setValidatorBondParams(0, 0, 0);
    await manager.setCompletionReviewPeriod(1);
    await manager.setChallengePeriodAfterApproval(1);
    await manager.setRequiredValidatorApprovals(1);
    await manager.setVoteQuorum(1, { from: owner });
  });
  async function post() {
    const amount = parseUSDC('100');
    await token.mint(employer, amount);
    await token.approve(manager.address, amount, { from: employer });
    const tx = await manager.createJob('ipfs://job', amount, 1000, '', { from: employer });
    return tx.logs.find(log => log.event === 'JobCreated').args.jobId;
  }
  const apply = id => manager.applyForJob(id, '', [], { from: agent });
  async function finish(id) {
    await manager.requestJobCompletion(id, 'ipfs://done', { from: agent });
    await manager.validateJob(id, '', [], { from: validator });
    await time.increase(2);
    return manager.finalizeJob(id);
  }

  it('starts disabled with no collections and completes a job without an eligibility NFT', async () => {
    assert.equal(await manager.agentNftRequired(), false);
    await expectRevert.unspecified(manager.agiTypes(0));
    const id = await post();
    assert.equal(await manager.jobAgentNftRequired(id), false);
    await apply(id);
    await finish(id);
    assert.equal((await token.balanceOf(agent)).toString(), parseUSDC('52'));
    assert.equal((await manager.balanceOf(employer)).toString(), '1', 'completion NFT remains enabled');
  });

  it('an allowlist exception never bypasses an owner-enabled NFT requirement', async () => {
    await manager.addAGIType(nft.address, 1);
    await manager.setAgentNftRequired(true);
    assert.equal(await manager.agentNftRequired(), true);
    const id = await post();
    assert.equal(await manager.jobAgentNftRequired(id), true);
    await expectRevert(apply(id), 'IneligibleAgentPayout');
    await nft.mint(agent);
    await apply(id);
  });

  it('preserves both required and optional jobs across repeated default changes', async () => {
    await manager.addAGIType(nft.address, 1);
    const initialOptional = await post();
    expectEvent(await manager.setAgentNftRequired(true), 'AgentNftRequirementUpdated', { required: true });
    const required = await post();
    expectEvent(await manager.setAgentNftRequired(false), 'AgentNftRequirementUpdated', { required: false });
    const optional = await post();
    expectEvent(await manager.setAgentNftRequired(true), 'AgentNftRequirementUpdated', { required: true });
    const requiredAgain = await post();
    assert.equal(await manager.jobAgentNftRequired(initialOptional), false);
    assert.equal(await manager.jobAgentNftRequired(required), true);
    assert.equal(await manager.jobAgentNftRequired(optional), false);
    assert.equal(await manager.jobAgentNftRequired(requiredAgain), true);
    await expectRevert(apply(required), 'IneligibleAgentPayout');
    await expectRevert(apply(requiredAgain), 'IneligibleAgentPayout');
    await apply(initialOptional);
    await manager.setMaxActiveJobsPerAgent(4);
    await apply(optional);
    await nft.mint(agent);
    await apply(required);
    await apply(requiredAgain);
  });

  it('enforces accepted ownership; identity locking does not freeze the operational default', async () => {
    await expectRevert.unspecified(manager.setAgentNftRequired(true, { from: outsider }));
    await manager.transferOwnership(nextOwner);
    await expectRevert.unspecified(manager.setAgentNftRequired(true, { from: nextOwner }));
    await manager.acceptOwnership({ from: nextOwner });
    await expectRevert.unspecified(manager.setAgentNftRequired(true, { from: owner }));
    await manager.lockIdentityConfiguration({ from: nextOwner });
    await manager.setAgentNftRequired(true, { from: nextOwner });
    assert.equal(await manager.agentNftRequired(), true);
  });

  it('keeps membership, blacklists, intake pauses and agent limits enforced when NFTs are optional', async () => {
    const id = await post();
    await expectRevert(manager.applyForJob(id, 'unregistered', [], { from: outsider }), 'NotAuthorized');
    await manager.blacklistAgent(agent, true);
    await expectRevert(apply(id), 'Blacklisted');
    await manager.blacklistAgent(agent, false);
    await manager.pauseIntake();
    await expectRevert.unspecified(apply(id));
    await manager.unpauseIntake();
    await manager.setMaxActiveJobsPerAgent(1);
    await apply(id);
    await expectRevert(apply(await post()), 'InvalidState');
  });

  it('still requires and returns the agent bond without an NFT', async () => {
    await manager.setAgentBondParams(0, parseUSDC('3'), parseUSDC('3'));
    const id = await post();
    await expectRevert.unspecified(apply(id));
    await token.mint(agent, parseUSDC('3'));
    await token.approve(manager.address, parseUSDC('3'), { from: agent });
    await apply(id);
    assert.equal((await manager.lockedAgentBonds()).toString(), parseUSDC('3'));
    await finish(id);
    assert.equal((await token.balanceOf(agent)).toString(), parseUSDC('55'));
    assert.equal((await manager.lockedAgentBonds()).toString(), '0');
  });

  it('pays identical USDC shares in both modes and never rechecks NFT holdings at settlement', async () => {
    await manager.addAGIType(nft.address, 1);
    await manager.setAgentNftRequired(true);
    await nft.mint(agent);
    const required = await post();
    await apply(required);
    await nft.transferFrom(agent, outsider, 1, { from: agent });
    assert.equal((await manager.getHighestPayoutPercentage(agent)).toString(), '0');
    await manager.setAgentNftRequired(false);
    const optional = await post();
    await apply(optional);
    await manager.setAgentNftRequired(true);
    for (const id of [required, optional]) {
      const tx = await finish(id);
      expectEvent(tx, 'JobPayoutDistributed', { validatorBudget: parseUSDC('8'), wallet30Amount: parseUSDC('30'), wallet10Amount: parseUSDC('10'), agentAmount: parseUSDC('52') });
    }
    for (const [recipient, amount] of [[validator, '16'], [wallet30, '60'], [wallet10, '20'], [agent, '104']]) {
      assert.equal((await token.balanceOf(recipient)).toString(), parseUSDC(amount));
    }
    assert.equal(await manager.jobAgentNftRequired(required), true);
    assert.equal(await manager.jobAgentNftRequired(optional), false);
    assert.equal((await manager.lockedEscrow()).toString(), '0');
  });

  it('blocks adding, changing or disabling credentials while any job is funded, even in optional mode', async () => {
    await manager.addAGIType(nft.address, 1);
    await manager.setAgentNftRequired(true);
    const replacement = await NFT.new();
    const required = await post();
    await manager.setAgentNftRequired(false);
    const optional = await post();
    for (const action of [() => manager.addAGIType(replacement.address, 1), () => manager.addAGIType(nft.address, 100), () => manager.disableAGIType(nft.address)]) {
      await expectRevert(action(), 'InvalidState');
    }
    await manager.cancelJob(required, { from: employer });
    await apply(optional);
    await expectRevert(manager.disableAGIType(nft.address), 'InvalidState');
    await finish(optional);
    await manager.disableAGIType(nft.address);
    await manager.addAGIType(replacement.address, 100);
    await replacement.mint(agent);
    assert.equal((await manager.getHighestPayoutPercentage(agent)).toString(), '100');
  });

  it('fails closed with no enabled collections only for required jobs', async () => {
    await manager.addAGIType(nft.address, 1);
    await manager.disableAGIType(nft.address);
    await manager.setAgentNftRequired(true);
    const required = await post();
    await expectRevert(apply(required), 'IneligibleAgentPayout');
    await manager.setAgentNftRequired(false);
    await apply(await post());
    await expectRevert(apply(required), 'IneligibleAgentPayout');
    await manager.cancelJob(required, { from: employer });
  });

  it('rejects missing and deleted job policy reads', async () => {
    await expectRevert(manager.jobAgentNftRequired(0), 'JobNotFound');
    await manager.setAgentNftRequired(false);
    const id = await post();
    await manager.cancelJob(id, { from: employer });
    await expectRevert(manager.jobAgentNftRequired(id), 'JobNotFound');
    const next = await post();
    assert.equal(await manager.jobAgentNftRequired(next), false);
  });
});
