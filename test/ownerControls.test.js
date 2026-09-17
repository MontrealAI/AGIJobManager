const { deployActive } = require('./helpers/deploy');
const assert = require('assert');
const { expectRevert } = require('@openzeppelin/test-helpers');
const { buildInitConfig } = require('./helpers/deploy');
const Manager = artifacts.require('AGIJobManager');
const USDC = artifacts.require('MockUSDCControls');
const A0 = '0x' + '00'.repeat(20);
const Z = '0x' + '00'.repeat(32);

contract('v0.8.0 owner controls', ([owner, employer, nextOwner, outsider, wallet30, wallet10, replacement30, replacement10]) => {
  let token, manager;
  beforeEach(async () => {
    token = await USDC.new();
    manager = await deployActive(Manager, ...buildInitConfig(token.address, '', A0, A0, Z, Z, Z, Z, Z, Z, [wallet30, wallet10]));
  });
  it('requires owner authorization, paused intake and zero outstanding job reserves for rotation', async () => {
    await expectRevert.unspecified(manager.setSettlementWallets(replacement30, replacement10));
    await token.mint(employer, 100000000);
    await token.approve(manager.address, 100000000, { from: employer });
    await manager.createJob('ipfs://job', 100000000, 1000, '', { from: employer });
    await manager.pauseIntake();
    await expectRevert.unspecified(manager.setSettlementWallets(replacement30, replacement10));
    assert.equal(await manager.wallet30(), wallet30);
    await manager.cancelJob(0, { from: employer });
    await expectRevert.unspecified(manager.setSettlementWallets(replacement30, replacement10, { from: outsider }));
    const tx = await manager.setSettlementWallets(replacement30, replacement10);
    assert.equal(await manager.wallet30(), replacement30);
    assert.equal(await manager.wallet10(), replacement10);
    assert.equal(tx.logs.find(x => x.event === 'SettlementWalletsUpdated').args.wallet30, replacement30);
    assert.equal(await manager.usdcToken(), token.address);
  });
  it('rejects zero, duplicate, manager and token recipients atomically', async () => {
    await manager.pauseIntake();
    for (const pair of [[A0, wallet10], [wallet30, A0], [wallet30, wallet30], [manager.address, wallet10], [wallet30, manager.address], [token.address, wallet10], [wallet30, token.address]]) {
      await expectRevert.unspecified(manager.setSettlementWallets(...pair));
      assert.equal(await manager.wallet30(), wallet30);
      assert.equal(await manager.wallet10(), wallet10);
    }
  });
  it('allows harmless donations to remain during rotation without exposing locked funds', async () => {
    await token.mint(manager.address, 7);
    await manager.pauseIntake();
    await manager.setSettlementWallets(replacement30, replacement10);
    assert.equal((await manager.withdrawableUSDC()).toString(), '7');
  });
  it('transfers authority only after the proposed owner accepts', async () => {
    await expectRevert.unspecified(manager.transferOwnership(nextOwner, { from: outsider }));
    await manager.transferOwnership(nextOwner);
    assert.equal(await manager.owner(), owner);
    assert.equal(await manager.pendingOwner(), nextOwner);
    await expectRevert.unspecified(manager.pauseIntake({ from: nextOwner }));
    await expectRevert.unspecified(manager.acceptOwnership({ from: outsider }));
    await expectRevert.unspecified(manager.acceptOwnership({ from: owner }));
    await manager.acceptOwnership({ from: nextOwner });
    assert.equal(await manager.owner(), nextOwner);
    assert.equal(await manager.pendingOwner(), A0);
    await expectRevert.unspecified(manager.pauseIntake({ from: owner }));
    await manager.pauseIntake({ from: nextOwner });
    await manager.setSettlementWallets(replacement30, replacement10, { from: nextOwner });
  });
  it('permits replacing and cancelling an ownership proposal without losing the current owner', async () => {
    await manager.transferOwnership(nextOwner);
    await manager.transferOwnership(outsider);
    await expectRevert.unspecified(manager.acceptOwnership({ from: nextOwner }));
    await manager.transferOwnership(A0);
    await expectRevert.unspecified(manager.acceptOwnership({ from: outsider }));
    assert.equal(await manager.owner(), owner);
    assert.equal(await manager.pendingOwner(), A0);
    await manager.pauseIntake();
    await manager.unpauseIntake();
  });
  it('prevents ownership renunciation from disabling maintenance or pause recovery', async () => {
    await expectRevert.unspecified(manager.renounceOwnership());
    await manager.pauseAll();
    await expectRevert.unspecified(manager.renounceOwnership());
    assert.equal(await manager.owner(), owner);
    await manager.unpauseAll();
    assert.equal(await manager.paused(), false);
    assert.equal(await manager.settlementPaused(), false);
  });
});
