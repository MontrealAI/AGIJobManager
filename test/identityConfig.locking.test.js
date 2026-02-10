const { BN, time } = require('@openzeppelin/test-helpers');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockERC721 = artifacts.require('MockERC721');
const { buildInitConfig } = require('./helpers/deploy');
const { rootNode } = require('./helpers/ens');
const { expectCustomError } = require('./helpers/errors');
const { fundValidators, fundAgents } = require('./helpers/bonds');

const leafFor = (address) => Buffer.from(web3.utils.soliditySha3({ type: 'address', value: address }).slice(2), 'hex');
const mkTree = (list) => { const t = new MerkleTree(list.map(leafFor), keccak256, { sortPairs: true }); return { root: t.getHexRoot(), proofFor: (a) => t.getHexProof(leafFor(a)) }; };

contract('identityConfig.locking', (accounts) => {
  const [owner, employer, agent, validator] = accounts;

  it('blocks identity updates while funds are locked, then permits and permanently locks', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new(); const nft = await MockERC721.new();
    const validatorTree = mkTree([validator]); const agentTree = mkTree([agent]);
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), validatorTree.root, agentTree.root), { from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner }); await nft.mint(agent);
    await token.mint(employer, new BN(web3.utils.toWei('1000'))); await token.approve(manager.address, web3.utils.toWei('1000'), { from: employer });
    await fundValidators(token, manager, [validator], owner); await fundAgents(token, manager, [agent], owner);

    await manager.createJob('Qm', web3.utils.toWei('1000'), 5000, 'd', { from: employer });
    await manager.applyForJob(0, 'agent', agentTree.proofFor(agent), { from: agent });
    const altToken = await MockERC20.new();
    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.updateAGITokenAddress(altToken.address, { from: owner }));

    await time.increase(6001);
    await manager.expireJob(0, { from: employer });
    await manager.updateAGITokenAddress(altToken.address, { from: owner });
    await manager.lockIdentityConfiguration({ from: owner });
    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.updateAGITokenAddress(token.address, { from: owner }));
  });
});
