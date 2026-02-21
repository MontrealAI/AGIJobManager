const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockERC721 = artifacts.require('MockERC721');
const MockNoSupportsInterface = artifacts.require('MockNoSupportsInterface');
const MockERC165Only = artifacts.require('MockERC165Only');
const MockBrokenERC721 = artifacts.require('MockBrokenERC721');


const { buildInitConfig } = require('./helpers/deploy');
const { rootNode } = require('./helpers/ens');

const mkTree = (list) => { const t = new MerkleTree(list.map((a) => Buffer.from(web3.utils.soliditySha3({ type: 'address', value: a }).slice(2), 'hex')), keccak256, { sortPairs: true }); return { root: t.getHexRoot(), proofFor: (a) => t.getHexProof(Buffer.from(web3.utils.soliditySha3({ type: 'address', value: a }).slice(2), 'hex')) }; };

contract('agiTypes.safety', (accounts) => {
  const [owner, agent] = accounts;

  it('rejects invalid AGI types and ignores broken/disabled types in payout checks', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new();
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), '0x' + '00'.repeat(32), mkTree([agent]).root), { from: owner });

    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.addAGIType('0x0000000000000000000000000000000000000000', 10, { from: owner }));
    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.addAGIType(owner, 10, { from: owner }));
    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.addAGIType((await MockERC165Only.new()).address, 10, { from: owner }));
    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.addAGIType((await MockNoSupportsInterface.new()).address, 10, { from: owner }));

    const working = await MockERC721.new();
    await manager.addAGIType(working.address, 40, { from: owner });
    const broken = await MockBrokenERC721.new();
    await manager.addAGIType(broken.address, 55, { from: owner });

    await manager.disableAGIType(broken.address, { from: owner });
    await working.mint(agent);

    const pct = await manager.getHighestPayoutPercentage(agent);
    assert.equal(pct.toString(), '40');
  });


  it('emits disable events and reverts when disabling unknown AGI type', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new();
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), '0x' + '00'.repeat(32), mkTree([agent]).root), { from: owner });

    const working = await MockERC721.new();
    await manager.addAGIType(working.address, 40, { from: owner });
    const receipt = await manager.disableAGIType(working.address, { from: owner });
    const log = receipt.logs.find((l) => l.event === 'AGITypeUpdated');
    assert.equal(log.args.nftAddress, working.address);
    assert.equal(log.args.payoutPercentage.toString(), '0');

    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.disableAGIType(agent, { from: owner }));
  });

  it('reuses disabled AGI type slots when max capacity is reached', async () => {
    const token = await MockERC20.new(); const ens = await MockENS.new(); const nw = await MockNameWrapper.new();
    const manager = await AGIJobManager.new(...buildInitConfig(token.address, 'ipfs://', ens.address, nw.address, rootNode('club'), rootNode('agent'), rootNode('club'), rootNode('agent'), '0x' + '00'.repeat(32), mkTree([agent]).root), { from: owner });

    const maxTypes = (await manager.MAX_AGI_TYPES()).toNumber();
    const agiTypes = [];
    for (let i = 0; i < maxTypes; i += 1) {
      const agiType = await MockERC721.new();
      agiTypes.push(agiType);
      await manager.addAGIType(agiType.address, 1, { from: owner });
    }

    const reusableIndex = 7;
    await manager.disableAGIType(agiTypes[reusableIndex].address, { from: owner });

    const replacement = await MockERC721.new();
    await manager.addAGIType(replacement.address, 2, { from: owner });

    const slot = await manager.agiTypes(reusableIndex);
    assert.equal(slot.nftAddress, replacement.address);
    assert.equal(slot.payoutPercentage.toString(), '2');

    const overflow = await MockERC721.new();
    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.addAGIType(overflow.address, 1, { from: owner }));
    await require('@openzeppelin/test-helpers').expectRevert.unspecified(manager.addAGIType(overflow.address, 93, { from: owner }));
  });
});
