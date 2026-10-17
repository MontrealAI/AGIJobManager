const { deployActive } = require('./helpers/deploy');
const { parseUSDC: parseUSDCAmount } = require("../scripts/lib/usdc");
const { BN, time, expectEvent } = require('../scripts/test-helpers.cjs');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const AGIJobManager = artifacts.require('AGIJobManager');
const ENSJobPages = artifacts.require('ENSJobPages');
const MockERC20 = artifacts.require('MockERC20');
const MockENSRegistry = artifacts.require('MockENSRegistry');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockPublicResolver = artifacts.require('MockPublicResolver');
const MockERC721 = artifacts.require('MockERC721');

const { buildInitConfig } = require('./helpers/deploy');
const { namehash, rootNode, subnode } = require('./helpers/ens');

const leafFor = (address) => Buffer.from(web3.utils.soliditySha3({ type: 'address', value: address }).slice(2), 'hex');
const mkTree = (list) => { const t = new MerkleTree(list.map(leafFor), keccak256, { sortPairs: true }); return { root: t.getHexRoot(), proofFor: (a) => t.getHexProof(leafFor(a)) }; };

contract('ensHooks.integration', (accounts) => {
  const [owner, employer, agent, validator] = accounts;

  async function seedSettledJob({ manager, token, payout, proof }) {
    await manager.setCompletionReviewPeriod(1, { from: owner });
    await manager.createJob('QmSpec', payout, 5000, 'd', { from: employer });
    await manager.applyForJob(0, 'agent', proof, { from: agent });
    await manager.requestJobCompletion(0, 'QmDone', { from: agent });
    await time.increase(2);
    await manager.acceptJob(0, { from: employer });
  }

  it('invokes ENS hooks best-effort and lockJobENS fuse burn path', async () => {
    const token = await MockERC20.new();
    const ens = await MockENSRegistry.new();
    const wrapper = await MockNameWrapper.new();
    const resolver = await MockPublicResolver.new();
    const nft = await MockERC721.new();

    const rootName = 'jobs.alpha.agi.eth';
    const rootNodeHash = namehash(rootName);
    const manager = await deployActive(AGIJobManager, ...buildInitConfig(owner, token.address, 'ipfs://', ens.address, wrapper.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), mkTree([validator]).root, mkTree([agent]).root), { from: owner });
    const pages = await ENSJobPages.new(ens.address, wrapper.address, resolver.address, rootNodeHash, rootName, owner, { from: owner });
    await pages.setJobManager(manager.address, { from: owner });
    await manager.setEnsJobPages(pages.address, { from: owner });
    await ens.setOwner(rootNodeHash, wrapper.address);
    await wrapper.setOwner(web3.utils.toBN(rootNodeHash), pages.address);

    await manager.addAGIType(nft.address, 90, { from: owner }); await nft.mint(agent);
    const payout = new BN(parseUSDCAmount('1000'));
    await token.mint(employer, payout); await token.approve(manager.address, payout, { from: employer });
    await token.mint(validator, payout); await token.approve(manager.address, payout, { from: validator });
    await token.mint(agent, payout); await token.approve(manager.address, payout, { from: agent });

    await wrapper.setENSRegistry(ens.address);
    await seedSettledJob({ manager, token, payout, proof: mkTree([agent]).proofFor(agent) });

    const wrappedNode = subnode(rootNodeHash, 'agijob0');
    assert.equal((await wrapper.setResolverCalls()).toString(), '1', 'wrapped CREATE hook should set resolver via NameWrapper');
    assert.equal(await wrapper.lastResolverNode(), wrappedNode, 'wrapper resolver target should be wrapped subnode');

    const lockReceipt = await manager.lockJobENS(0, true, { from: owner });
    await expectEvent.inTransaction(lockReceipt.tx, pages, 'JobENSLocked', {
      jobId: new BN(0),
      fusesBurned: true,
    });
    assert.equal((await wrapper.setChildFusesCalls()).toString(), '1');
    assert.equal((await wrapper.lastParentNode()), rootNodeHash);
    assert.equal((await wrapper.lastLabelhash()), web3.utils.keccak256('agijob0'));
  });

  it('supports unwrapped-root mode across CREATE/ASSIGN/COMPLETION/REVOKE/LOCK hooks', async () => {
    const token = await MockERC20.new();
    const ens = await MockENSRegistry.new();
    const wrapper = await MockNameWrapper.new();
    const resolver = await MockPublicResolver.new();
    const nft = await MockERC721.new();

    const rootName = 'jobs.alpha.agi.eth';
    const rootNodeHash = namehash(rootName);
    const manager = await deployActive(AGIJobManager, ...buildInitConfig(owner, token.address, 'ipfs://', ens.address, wrapper.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), mkTree([validator]).root, mkTree([agent]).root), { from: owner });
    const pages = await ENSJobPages.new(ens.address, wrapper.address, resolver.address, rootNodeHash, rootName, owner, { from: owner });
    await pages.setJobManager(manager.address, { from: owner });
    await manager.setEnsJobPages(pages.address, { from: owner });
    await ens.setOwner(rootNodeHash, pages.address);

    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent);
    const payout = new BN(parseUSDCAmount('1000'));
    await token.mint(employer, payout);
    await token.approve(manager.address, payout, { from: employer });
    await token.mint(validator, payout);
    await token.approve(manager.address, payout, { from: validator });
    await token.mint(agent, payout);
    await token.approve(manager.address, payout, { from: agent });

    const proof = mkTree([agent]).proofFor(agent);
    await manager.setCompletionReviewPeriod(1, { from: owner });
    await manager.createJob('QmSpec', payout, 5000, 'd', { from: employer });

    const node = subnode(rootNodeHash, 'agijob0');
    const employerAuthAfterCreate = await resolver.isAuthorised(node, employer);
    const agentAuthAfterCreate = await resolver.isAuthorised(node, agent);
    assert.equal(employerAuthAfterCreate, true, 'CREATE hook must authorise employer');
    assert.equal(agentAuthAfterCreate, false, 'agent should not be authorised before ASSIGN');

    await manager.applyForJob(0, 'agent', proof, { from: agent });
    const agentAuthAfterAssign = await resolver.isAuthorised(node, agent);
    assert.equal(agentAuthAfterAssign, true, 'ASSIGN hook must authorise agent');

    await manager.requestJobCompletion(0, 'QmDone', { from: agent });
    await time.increase(2);
    await manager.acceptJob(0, { from: employer });

    const employerAuthAfterRevoke = await resolver.isAuthorised(node, employer);
    const agentAuthAfterRevoke = await resolver.isAuthorised(node, agent);
    assert.equal(employerAuthAfterRevoke, false, 'REVOKE hook must de-authorise employer');
    assert.equal(agentAuthAfterRevoke, false, 'REVOKE hook must de-authorise agent');

    const lockReceipt = await manager.lockJobENS(0, false, { from: owner });
    const employerAuthAfterLock = await resolver.isAuthorised(node, employer);
    const agentAuthAfterLock = await resolver.isAuthorised(node, agent);
    assert.equal(employerAuthAfterLock, false, 'LOCK hook must keep employer de-authorised');
    assert.equal(agentAuthAfterLock, false, 'LOCK hook must keep agent de-authorised');
    await expectEvent.inTransaction(lockReceipt.tx, pages, 'JobENSLocked', {
      jobId: new BN(0),
      fusesBurned: false,
    });
  });

  it('keeps AGIJobManager flows live when resolver writes revert (best-effort degradation)', async () => {
    const token = await MockERC20.new();
    const ens = await MockENSRegistry.new();
    const wrapper = await MockNameWrapper.new();
    const resolver = await MockPublicResolver.new();
    const nft = await MockERC721.new();

    const rootName = 'jobs.alpha.agi.eth';
    const rootNodeHash = namehash(rootName);
    const manager = await deployActive(AGIJobManager, ...buildInitConfig(owner, token.address, 'ipfs://', ens.address, wrapper.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), mkTree([validator]).root, mkTree([agent]).root), { from: owner });
    const pages = await ENSJobPages.new(ens.address, wrapper.address, resolver.address, rootNodeHash, rootName, owner, { from: owner });
    await pages.setJobManager(manager.address, { from: owner });
    await manager.setEnsJobPages(pages.address, { from: owner });
    await ens.setOwner(rootNodeHash, pages.address);
    await resolver.setRevertSetAuthorisation(true);
    await resolver.setRevertSetText(true);

    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent);
    const payout = new BN(parseUSDCAmount('1000'));
    await token.mint(employer, payout);
    await token.approve(manager.address, payout, { from: employer });
    await token.mint(agent, payout);
    await token.approve(manager.address, payout, { from: agent });

    const createTx = await manager.createJob('QmSpec', payout, 5000, 'd', { from: employer });
    const applyTx = await manager.applyForJob(0, 'agent', mkTree([agent]).proofFor(agent), { from: agent });
    const completionTx = await manager.requestJobCompletion(0, 'QmDone', { from: agent });

    await expectEvent.inTransaction(createTx.tx, pages, 'ENSHookBestEffortFailure', { hook: new BN(1) });
    await expectEvent.inTransaction(applyTx.tx, pages, 'ENSHookBestEffortFailure', { hook: new BN(2) });
    await expectEvent.inTransaction(completionTx.tx, pages, 'ENSHookBestEffortFailure', { hook: new BN(3) });
  });

  it('bounds maximum-length URI gas and exposes ENS degradation without losing escrow recovery', async () => {
    const token = await MockERC20.new();
    const ens = await MockENSRegistry.new();
    const wrapper = await MockNameWrapper.new();
    const resolver = await MockPublicResolver.new();
    const rootName = 'jobs.alpha.agi.eth', node = namehash(rootName);
    const manager = await deployActive(AGIJobManager, ...buildInitConfig(owner, token.address, 'ipfs://', ens.address, wrapper.address,
      rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), mkTree([validator]).root, mkTree([agent]).root), { from: owner });
    const pages = await ENSJobPages.new(ens.address, wrapper.address, resolver.address, node, rootName, owner, { from: owner });
    await pages.setJobManager(manager.address, { from: owner });
    await manager.setEnsJobPages(pages.address, { from: owner });
    await ens.setOwner(node, pages.address);
    const nft = await MockERC721.new();
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent);
    const funds = new BN(parseUSDCAmount('1000')), payout = new BN(parseUSDCAmount('100'));
    for (const person of [employer, agent]) {
      await token.mint(person, funds);
      await token.approve(manager.address, funds, { from: person });
    }
    const failedHook = async receipt => {
      assert.equal(receipt.logs.find(log => log.event === 'EnsHookAttempted').args.success, true,
        'successful outer call can conceal a failed best-effort resolver write');
      await expectEvent.inTransaction(receipt.tx, pages, 'ENSHookBestEffortFailure');
      assert(Number(receipt.receipt.gasUsed) < 3000000, 'URI fixture must fit the declared 3M transaction bound');
    };
    const initialBalance = await token.balanceOf(employer);
    const longSpec = 'ipfs://' + 's'.repeat(2041);
    await failedHook(await manager.createJob(longSpec, payout, 5000, 'bounded URI fixture', { from: employer, gas: 3000000 }));
    assert.equal(await resolver.text(subnode(node, 'agijob0'), 'agijobs.spec.public'), '', 'failed hook leaves no mirrored long record');
    await manager.cancelJob(0, { from: employer });
    assert.equal((await token.balanceOf(employer)).toString(), initialBalance.toString(), 'cancel returns escrow despite failed ENS hook');

    await manager.createJob('ipfs://short', payout, 5000, 'completion fixture', { from: employer });
    await manager.applyForJob(1, 'agent', mkTree([agent]).proofFor(agent), { from: agent });
    const longCompletion = 'ipfs://' + 'c'.repeat(1017);
    await failedHook(await manager.requestJobCompletion(1, longCompletion, { from: agent, gas: 3000000 }));
    assert.equal(await resolver.text(subnode(node, 'agijob1'), 'agijobs.completion.public'), '', 'failed hook is not a mirrored completion');
    await manager.acceptJob(1, { from: employer, gas: 3000000 });
    assert.equal(await manager.ownerOf(0), employer, 'completion NFT remains recoverable');
    for (const reserve of ['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds', 'lockedClaims']) {
      assert.equal((await manager[reserve]()).toString(), '0', reserve);
    }
    assert.equal(await ens.owner(node), pages.address, 'shared root custody is unchanged');
  });
});
