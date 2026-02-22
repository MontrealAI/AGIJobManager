const { BN } = require('@openzeppelin/test-helpers');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockERC721 = artifacts.require('MockERC721');

const { buildInitConfig } = require('./helpers/deploy');
const { expectCustomError } = require('./helpers/errors');

const ZERO32 = '0x' + '00'.repeat(32);
const EMPTY_PROOF = [];

contract('operational durability', (accounts) => {
  const [owner, employer, agent] = accounts;

  async function deployManager() {
    const token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const manager = await AGIJobManager.new(
      ...buildInitConfig(token.address, 'ipfs://base', ens.address, wrapper.address, ZERO32, ZERO32, ZERO32, ZERO32, ZERO32, ZERO32),
      { from: owner }
    );
    await manager.addAdditionalAgent(agent, { from: owner });
    return { token, manager };
  }

  it('makes max active jobs per agent owner-configurable with validation', async () => {
    const { token, manager } = await deployManager();
    const payout = web3.utils.toWei('1');
    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 1, { from: owner });

    assert.equal((await manager.maxActiveJobsPerAgent()).toString(), '3');

    await expectCustomError(manager.setMaxActiveJobsPerAgent.call(0, { from: owner }), 'InvalidParameters');
    await expectCustomError(manager.setMaxActiveJobsPerAgent.call(10001, { from: owner }), 'InvalidParameters');

    await token.mint(employer, web3.utils.toWei('10'), { from: owner });
    await token.approve(manager.address, web3.utils.toWei('10'), { from: employer });

    for (let i = 0; i < 4; i += 1) {
      await manager.createJob(`ipfs://spec-${i}`, payout, 1000, 'details', { from: employer });
    }

    await manager.setAgentBondParams(0, 0, 0, { from: owner });
    await manager.applyForJob(0, 'agent', EMPTY_PROOF, { from: agent });
    await manager.applyForJob(1, 'agent', EMPTY_PROOF, { from: agent });
    await manager.applyForJob(2, 'agent', EMPTY_PROOF, { from: agent });
    await expectCustomError(manager.applyForJob.call(3, 'agent', EMPTY_PROOF, { from: agent }), 'InvalidState');

    await manager.setMaxActiveJobsPerAgent(4, { from: owner });
    assert.equal((await manager.maxActiveJobsPerAgent()).toString(), '4');

    await manager.applyForJob(3, 'agent', EMPTY_PROOF, { from: agent });
  });

  it('allows bond parameter updates while escrow is locked for in-flight jobs', async () => {
    const { token, manager } = await deployManager();
    const payout = web3.utils.toWei('2');

    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    await manager.createJob('ipfs://spec', payout, 1000, 'details', { from: employer });

    assert((await manager.lockedEscrow()).gt(new BN('0')), 'precondition: escrow should be locked');

    // Pre-change these owner operations reverted with InvalidState due to _requireEmptyEscrow().
    await manager.setAgentBondParams(600, web3.utils.toWei('2'), web3.utils.toWei('20'), { from: owner });
    await manager.setAgentBond(web3.utils.toWei('3'), { from: owner });
    await manager.setValidatorBondParams(1700, web3.utils.toWei('2'), web3.utils.toWei('30'), { from: owner });

    assert.equal((await manager.agentBondBps()).toString(), '600');
    assert.equal((await manager.agentBond()).toString(), web3.utils.toWei('3'));
    assert.equal((await manager.agentBondMax()).toString(), web3.utils.toWei('20'));
    assert.equal((await manager.validatorBondBps()).toString(), '1700');
    assert.equal((await manager.validatorBondMin()).toString(), web3.utils.toWei('2'));
    assert.equal((await manager.validatorBondMax()).toString(), web3.utils.toWei('30'));
  });

});
