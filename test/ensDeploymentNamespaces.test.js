const ENSJobPages = artifacts.require('ENSJobPages');
const MockENSRegistry = artifacts.require('MockENSRegistry');
const MockPublicResolver = artifacts.require('MockPublicResolver');
const { namehash, subnode } = require('./helpers/ens');
const { deriveJobsRootName } = require('../hardhat/scripts/deploy-ens-job-pages.cjs');

contract('Deployment-specific ENS job names', (accounts) => {
  const [owner, employer, firstManager, secondManager] = accounts;
  const zero = '0x0000000000000000000000000000000000000000';

  it('creates job zero in two deployment namespaces without modifying any historical label', async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const legacyRoot = namehash('alpha.jobs.agi.eth');
    const legacy = ['0', 'job-0', 'agijob0', 'agijob-0', 'aijob0'].map(label => subnode(legacyRoot, label));
    for (const node of legacy) {
      await ens.setOwner(node, owner, { from: owner });
      await ens.setResolver(node, resolver.address, { from: owner });
      await resolver.setText(node, 'agijobs.spec.public', 'ipfs://historical', { from: owner });
    }
    const created = [];
    for (const manager of [firstManager, secondManager]) {
      const root = deriveJobsRootName(1, manager);
      const helper = await ENSJobPages.new(ens.address, zero, resolver.address, namehash(root), root, { from: owner });
      await ens.setOwner(namehash(root), helper.address, { from: owner });
      await helper.setJobLabelPrefix('job-', { from: owner });
      await helper.createJobPage(0, employer, `ipfs://${manager.toLowerCase()}`, { from: owner });
      const node = await helper.jobEnsNode(0);
      assert.equal(await helper.jobEnsName(0), `job-0.${root}`);
      assert.equal(await helper.jobEnsURI(0), `ens://job-0.${root}`);
      assert.equal(await resolver.text(node, 'agijobs.spec.public'), `ipfs://${manager.toLowerCase()}`);
      created.push(node);
    }
    assert.notEqual(created[0], created[1]);
    for (const node of legacy) {
      assert.equal(await ens.owner(node), owner);
      assert.equal(await ens.resolver(node), resolver.address);
      assert.equal(await resolver.text(node, 'agijobs.spec.public'), 'ipfs://historical');
    }
  });
});
