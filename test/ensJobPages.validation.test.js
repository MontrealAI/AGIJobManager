const ENSJobPages = artifacts.require('ENSJobPages');
const MockENSRegistry = artifacts.require('MockENSRegistry');
const MockPublicResolver = artifacts.require('MockPublicResolver');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockERC20 = artifacts.require('MockERC20');
const AGIJobManager = artifacts.require('AGIJobManager');

const { buildInitConfig } = require('./helpers/deploy');
const { expectCustomError } = require('./helpers/errors');

contract('ENSJobPages validation', (accounts) => {
  const [owner, other] = accounts;
  const ZERO32 = '0x' + '00'.repeat(32);

  it('enforces contract addresses in constructor and setters', async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });

    for (const args of [
      [other, wrapper.address, resolver.address],
      [ens.address, wrapper.address, other],
      [ens.address, other, resolver.address]
    ]) {
      try {
        await ENSJobPages.new(args[0], args[1], args[2], ZERO32, 'jobs.agi.eth', { from: owner });
        assert.fail('expected constructor revert');
      } catch (error) {
        assert.include(String(error.message), 'could not decode');
      }
    }





    const pages = await ENSJobPages.new(ens.address, wrapper.address, resolver.address, ZERO32, 'jobs.agi.eth', { from: owner });
    await expectCustomError(pages.setENSRegistry.call(other, { from: owner }), 'InvalidParameters');
    await expectCustomError(pages.setPublicResolver.call(other, { from: owner }), 'InvalidParameters');
    await expectCustomError(pages.setNameWrapper.call(other, { from: owner }), 'InvalidParameters');
  });

  it('rejects non-contract job manager addresses', async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockPublicResolver.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const token = await MockERC20.new({ from: owner });

    const manager = await AGIJobManager.new(
      ...buildInitConfig(token.address, 'ipfs://base', ens.address, wrapper.address, ZERO32, ZERO32, ZERO32, ZERO32, ZERO32, ZERO32),
      { from: owner }
    );

    const pages = await ENSJobPages.new(ens.address, wrapper.address, resolver.address, ZERO32, 'jobs.agi.eth', { from: owner });
    await expectCustomError(pages.setJobManager.call(other, { from: owner }), 'InvalidParameters');
    await pages.setJobManager(manager.address, { from: owner });
  });
});
