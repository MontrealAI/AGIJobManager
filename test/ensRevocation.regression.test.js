const assert = require('node:assert/strict');
const { buildInitConfig, deployActive } = require('./helpers/deploy');
const { rootNode, subnode } = require('./helpers/ens');
const { expectCustomError } = require('./helpers/errors');

const Manager = artifacts.require('AGIJobManager');
const Token = artifacts.require('MockERC20');
const Registry = artifacts.require('MockENSRegistry');
const Wrapper = artifacts.require('MockNameWrapper');
const Resolver = artifacts.require('MockResolver');
const Harness = artifacts.require('UtilsHarness');
const ZERO = '0x' + '00'.repeat(20);
const ZERO32 = '0x' + '00'.repeat(32);

contract('ENS resolver membership revocation', accounts => {
  const [owner, employer, agent, voter, controller, otherVoter] = accounts;
  const clubRoot = rootNode('revocation-club');
  const agentRoot = rootNode('revocation-agent');
  let token, ens, wrapper, resolver, manager, harness;

  beforeEach(async () => {
    token = await Token.new();
    ens = await Registry.new();
    wrapper = await Wrapper.new();
    resolver = await Resolver.new();
    harness = await Harness.new();
    manager = await deployActive(Manager, ...buildInitConfig(owner, token.address, 'ipfs://', ens.address,
      wrapper.address, clubRoot, agentRoot, ZERO32, ZERO32, ZERO32, ZERO32));
    for (const who of [employer, agent, voter, otherVoter]) {
      await token.mint(who, '1000000000');
      await token.approve(manager.address, '1000000000', { from: who });
    }
  });

  async function member(root, label, claimant, nodeOwner = controller, wrappedOwner) {
    const node = subnode(root, label);
    await ens.setOwner(node, nodeOwner);
    await ens.setResolver(node, resolver.address);
    await resolver.setAddr(node, claimant);
    if (wrappedOwner !== undefined) await wrapper.setOwner(web3.utils.toBN(node), wrappedOwner);
    return node;
  }

  async function submitted() {
    await manager.addAdditionalAgent(agent);
    await manager.createJob('ipfs://spec', '100000000', 3600, 'revocation regression', { from: employer });
    await manager.applyForJob(0, '', [], { from: agent });
    await manager.requestJobCompletion(0, 'ipfs://delivery', { from: agent });
  }

  async function assertNoCredential(claimant, label) {
    const credential = await manager.validatorCredential(claimant, label, []);
    assert.equal(credential.credential, ZERO32);
    assert.equal(credential.controller, ZERO);
  }

  it('preserves live unwrapped resolver aliases and reports their actual controller', async () => {
    const node = await member(clubRoot, 'live', voter);
    // A leftover wrapper record must not replace the live registry controller for a resolver alias.
    await wrapper.setOwner(web3.utils.toBN(node), otherVoter);
    const credential = await manager.validatorCredential(voter, 'live', []);
    assert.equal(credential.credential, node);
    assert.equal(credential.controller, controller);
    await submitted();
    await manager.validateJob(0, 'live', [], { from: voter });
  });

  it('rejects a removed unwrapped validator despite its unchanged resolver record', async () => {
    const node = await member(clubRoot, 'removed', voter);
    await ens.setOwner(node, ZERO);
    assert.equal(await resolver.addr(node), voter);
    await assertNoCredential(voter, 'removed');
    await submitted();
    await expectCustomError(manager.validateJob.call(0, 'removed', [], { from: voter }), 'NotAuthorized');
    assert.equal((await manager.lockedValidatorBonds()).toString(), '0');
    await ens.setOwner(node, controller);
    await manager.validateJob(0, 'removed', [], { from: voter });
  });

  it('rejects removed agent membership and admits it again only after live ownership is restored', async () => {
    const node = await member(agentRoot, 'removed', agent);
    await ens.setOwner(node, ZERO);
    await manager.createJob('ipfs://spec', '100000000', 3600, 'revocation regression', { from: employer });
    await expectCustomError(manager.applyForJob.call(0, 'removed', [], { from: agent }), 'NotAuthorized');
    assert.equal((await manager.lockedAgentBonds()).toString(), '0');
    await ens.setOwner(node, controller);
    await manager.applyForJob(0, 'removed', [], { from: agent });
  });

  it('rejects stale wrapper holders and approved operators after the registry removes or reassigns the node', async () => {
    const node = await member(clubRoot, 'wrapped', voter, wrapper.address, voter);
    await wrapper.setApprovalForAll(otherVoter, true, { from: voter });
    await wrapper.setApproved(web3.utils.toBN(node), controller);
    await resolver.setAddr(node, ZERO);
    for (const claimant of [voter, otherVoter, controller]) {
      const live = await manager.validatorCredential(claimant, 'wrapped', []);
      assert.equal(live.credential, node);
      assert.equal(live.controller, voter);
    }
    for (const newOwner of [ZERO, employer]) {
      await ens.setOwner(node, newOwner);
      assert.equal(await wrapper.ownerOf(web3.utils.toBN(node)), voter);
      for (const claimant of [voter, otherVoter, controller]) await assertNoCredential(claimant, 'wrapped');
    }
    await ens.setOwner(node, wrapper.address);
    const restored = await manager.validatorCredential(otherVoter, 'wrapped', []);
    assert.equal(restored.controller, voter);
  });

  it('rejects agent admission through stale wrapper ownership even without a resolver record', async () => {
    const node = await member(agentRoot, 'wrapped', agent, wrapper.address, agent);
    await ens.setResolver(node, ZERO);
    await ens.setOwner(node, controller);
    await manager.createJob('ipfs://spec', '100000000', 3600, 'revocation regression', { from: employer });
    await expectCustomError(manager.applyForJob.call(0, 'wrapped', [], { from: agent }), 'NotAuthorized');
  });

  it('rejects an expired or burned wrapped owner instead of using the wrapper as controller', async () => {
    const node = await member(clubRoot, 'expired', voter, wrapper.address, controller);
    const live = await manager.validatorCredential(voter, 'expired', []);
    assert.equal(live.controller, controller);
    // NameWrapper ownerOf returns zero for an expired emancipated or burned name.
    await wrapper.setOwner(web3.utils.toBN(node), ZERO);
    await assertNoCredential(voter, 'expired');
    await submitted();
    await expectCustomError(manager.validateJob.call(0, 'expired', [], { from: voter }), 'NotAuthorized');
  });

  it('rejects the same stale wrapped resolver on agent admission', async () => {
    await member(agentRoot, 'expired', agent, wrapper.address, ZERO);
    await manager.createJob('ipfs://spec', '100000000', 3600, 'revocation regression', { from: employer });
    await expectCustomError(manager.applyForJob.call(0, 'expired', [], { from: agent }), 'NotAuthorized');
  });

  it('preserves live wrapped resolver aliases and excludes party-controlled aliases', async () => {
    await member(clubRoot, 'live', voter, wrapper.address, controller);
    await member(clubRoot, 'conflicted', otherVoter, wrapper.address, employer);
    await submitted();
    await manager.validateJob(0, 'live', [], { from: voter });
    await expectCustomError(manager.validateJob.call(0, 'conflicted', [], { from: otherVoter }), 'NotAuthorized');
  });

  it('does not let one live resolver controller supply multiple votes', async () => {
    await member(clubRoot, 'one', voter);
    await member(clubRoot, 'two', otherVoter);
    await submitted();
    await manager.validateJob(0, 'one', [], { from: voter });
    await expectCustomError(manager.validateJob.call(0, 'two', [], { from: otherVoter }), 'InvalidState');
  });

  it('fails closed on missing, reverting and malformed registry owner reads', async () => {
    const missing = await artifacts.require('MockResolver').new();
    const reverting = await artifacts.require('RevertingENSRegistry').new();
    const malformed = await artifacts.require('MalformedENSRegistry').new();
    const node = subnode(clubRoot, 'broken');
    await resolver.setAddr(node, voter);
    await reverting.setResolverAddress(resolver.address);
    await reverting.setRevertOwner(true);
    await malformed.setResolverAddress(resolver.address);
    for (const registry of [missing, reverting, malformed]) {
      assert.equal(await harness.verifyENSOwnership(registry.address, ZERO, voter, 'broken', clubRoot), false);
    }
  });

  it('fails closed on reverting and malformed wrapped owner reads even with a matching resolver', async () => {
    const reverting = await artifacts.require('RevertingNameWrapper').new();
    const malformed = await artifacts.require('MalformedNameWrapper').new();
    await reverting.setRevertOwnerOf(true);
    for (const brokenWrapper of [reverting, malformed]) {
      await member(clubRoot, 'broken', voter, brokenWrapper.address);
      assert.equal(await harness.verifyENSOwnership(ens.address, brokenWrapper.address, voter, 'broken', clubRoot), false);
    }
  });

  it('retains explicit owner and Merkle exception routes independently of ENS revocation', async () => {
    await member(clubRoot, 'removed', voter, ZERO);
    await manager.addAdditionalValidator(voter);
    const explicit = await manager.validatorCredential(voter, 'removed', []);
    assert.equal(explicit.controller, voter);
    await manager.removeAdditionalValidator(voter);
    await manager.updateMerkleRoots(web3.utils.soliditySha3({ type: 'address', value: voter }), ZERO32);
    const merkle = await manager.validatorCredential(voter, 'removed', []);
    assert.equal(merkle.credential, explicit.credential);
    assert.equal(merkle.controller, voter);
  });
});
