const assert = require('assert');
const { expectRevert } = require('../scripts/test-helpers.cjs');
const { buildInitConfig, deployActive } = require('./helpers/deploy');
const Manager = artifacts.require('AGIJobManager');
const USDC = artifacts.require('MockUSDCControls');
const A0 = '0x' + '00'.repeat(20);
const Z = '0x' + '00'.repeat(32);

contract('v0.8.0 atomic paused launch', ([owner, employer, nextOwner, outsider, wallet30, wallet10]) => {
  it('rejects self-directed generic rescue calls without changing completion NFT state', async () => {
    const token = await USDC.new();
    const manager = await deployActive(Manager, ...buildInitConfig(token.address, '', A0, A0, Z, Z, Z, Z, Z, Z, [wallet30, wallet10]));
    const tokenId = await manager.nextTokenId();
    const data = manager.contract.methods.safeMintCompletionNFT(owner, tokenId.toString()).encodeABI();
    await expectRevert.unspecified(manager.rescueToken(manager.address, data));
    assert.equal((await manager.nextTokenId()).toString(), tokenId.toString());
    assert.equal((await manager.balanceOf(owner)).toString(), '0');
  });
  it('rejects unsafe duration limits and admits the maximum supported duration', async () => {
    const token = await USDC.new();
    const manager = await deployActive(Manager, ...buildInitConfig(token.address, '', A0, A0, Z, Z, Z, Z, Z, Z, [wallet30, wallet10]));
    for (const value of ['0', '31536001', ((1n << 256n) - 1n).toString()]) {
      await expectRevert.unspecified(manager.setJobDurationLimit(value));
      assert.equal((await manager.jobDurationLimit()).toString(), '10000000');
    }
    await manager.setJobDurationLimit(31536000);
    await token.mint(employer, 2);
    await token.approve(manager.address, 2, { from: employer });
    await expectRevert.unspecified(manager.createJob('ipfs://too-long', 1, 31536001, '', { from: employer }));
    await manager.createJob('ipfs://maximum', 1, 31536000, '', { from: employer });
    assert.equal((await manager.getJobCore(0)).duration.toString(), '31536000');
  });
  it('blocks admission from deployment until the accepted owner explicitly opens intake', async () => {
    const token = await USDC.new();
    const manager = await Manager.new(...buildInitConfig(token.address, '', A0, A0, Z, Z, Z, Z, Z, Z, [wallet30, wallet10]), { from: owner });
    assert.equal(await manager.paused(), true);
    assert.equal(await manager.settlementPaused(), false);
    await token.mint(employer, 100000000);
    await token.approve(manager.address, 100000000, { from: employer });
    await expectRevert.unspecified(manager.createJob('ipfs://launch', 100000000, 1000, '', { from: employer }));
    assert.equal((await manager.nextJobId()).toString(), '0');
    assert.equal((await token.balanceOf(manager.address)).toString(), '0');
    await expectRevert.unspecified(manager.unpauseIntake({ from: outsider }));
    await manager.transferOwnership(nextOwner, { from: owner });
    await expectRevert.unspecified(manager.unpauseIntake({ from: nextOwner }));
    await manager.acceptOwnership({ from: nextOwner });
    assert.equal(await manager.paused(), true);
    await expectRevert.unspecified(manager.unpauseIntake({ from: owner }));
    await manager.unpauseIntake({ from: nextOwner });
    await manager.createJob('ipfs://launch', 100000000, 1000, '', { from: employer });
    assert.equal((await manager.lockedEscrow()).toString(), '100000000');
  });
});
