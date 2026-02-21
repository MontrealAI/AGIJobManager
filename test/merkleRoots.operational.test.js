const assert = require('assert');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockNameWrapper = artifacts.require('MockNameWrapper');

const { buildInitConfig } = require('./helpers/deploy');
const { rootNode } = require('./helpers/ens');
const { expectCustomError } = require('./helpers/errors');

const ZERO_ROOT = '0x' + '00'.repeat(32);

contract('merkleRoots.operational', (accounts) => {
  const [owner, employer] = accounts;
  const payout = web3.utils.toWei('1');

  let manager;
  let token;

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    const ens = await MockENS.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(
      ...buildInitConfig(
        token.address,
        'ipfs://base',
        ens.address,
        nameWrapper.address,
        rootNode('club'),
        rootNode('agent'),
        rootNode('club'),
        rootNode('agent'),
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner },
    );

    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
  });

  it('updates merkle roots even while escrow is active', async () => {
    await manager.createJob('ipfs-job', payout, 3600, 'details', { from: employer });
    assert.equal((await manager.lockedEscrow()).toString(), payout);

    const newValidatorRoot = web3.utils.soliditySha3('validator-root-v2');
    const newAgentRoot = web3.utils.soliditySha3('agent-root-v2');
    const receipt = await manager.updateMerkleRoots(newValidatorRoot, newAgentRoot, { from: owner });

    assert.equal(receipt.logs[0].event, 'MerkleRootsUpdated');
    assert.equal(receipt.logs[0].args.validatorMerkleRoot, newValidatorRoot);
    assert.equal(receipt.logs[0].args.agentMerkleRoot, newAgentRoot);
    assert.equal(await manager.validatorMerkleRoot(), newValidatorRoot);
    assert.equal(await manager.agentMerkleRoot(), newAgentRoot);
  });

  it('updates merkle roots after identity lock', async () => {
    await manager.lockIdentityConfiguration({ from: owner });

    const newValidatorRoot = web3.utils.soliditySha3('validator-root-v3');
    const newAgentRoot = web3.utils.soliditySha3('agent-root-v3');
    await manager.updateMerkleRoots(newValidatorRoot, newAgentRoot, { from: owner });

    assert.equal(await manager.validatorMerkleRoot(), newValidatorRoot);
    assert.equal(await manager.agentMerkleRoot(), newAgentRoot);
  });

  it('keeps other identity-locked updates blocked after lock', async () => {
    await manager.lockIdentityConfiguration({ from: owner });

    await expectCustomError(
      manager.updateRootNodes.call(rootNode('club2'), rootNode('agent2'), rootNode('club3'), rootNode('agent3'), { from: owner }),
      'ConfigLocked',
    );
  });
});
