const { deployActive } = require('./helpers/deploy');
const assert = require('assert');
const { expectRevert } = require('../scripts/test-helpers.cjs');
const { parseUSDC, formatUSDC, requireCanonicalUSDC, USDC_ADDRESSES } = require('../scripts/lib/usdc');
const { buildInitConfig } = require('./helpers/deploy');
const Manager = artifacts.require('AGIJobManager');
const USDC = artifacts.require('MockUSDCControls');
const Wrong = artifacts.require('MockWrongDecimals');
const ENS = artifacts.require('MockENS');
const Wrapper = artifacts.require('MockNameWrapper');
const zero = '0x' + '00'.repeat(32);

contract('USDC-only settlement', ([owner, employer]) => {
  let usdc, ens, wrapper, manager;
  const args = token => buildInitConfig(token, 'ipfs://', ens.address, wrapper.address, zero, zero, zero, zero, zero, zero);
  beforeEach(async () => {
    usdc = await USDC.new(); ens = await ENS.new(); wrapper = await Wrapper.new();
    manager = await deployActive(Manager, ...args(usdc.address));
  });
  it('rejects 18-decimal contracts and non-contract token addresses', async () => {
    const wrong = await Wrong.new();
    await assert.rejects(deployActive(Manager, ...args(wrong.address)), /revert|Custom error|code couldn.t be stored/);
    await assert.rejects(deployActive(Manager, ...args(employer)), /revert|Custom error|code couldn.t be stored/);
    assert.equal(await manager.usdcToken(), usdc.address);
    assert(!Manager.abi.some(x => /update.*TokenAddress/.test(x.name || '')));
  });
  it('escrows and refunds exactly one micro-USDC', async () => {
    await usdc.mint(employer, '1');
    await usdc.approve(manager.address, '1', {from: employer});
    await manager.createJob('ipfs://micro', '1', 60, 'micro', {from: employer});
    assert.equal((await manager.lockedEscrow()).toString(), '1');
    assert.equal((await usdc.balanceOf(manager.address)).toString(), '1');
    await manager.cancelJob(0, {from: employer});
    assert.equal((await usdc.balanceOf(employer)).toString(), '1');
    assert.equal((await manager.lockedEscrow()).toString(), '0');
  });
  it('rolls back failed intake and reserves a blocked buyer refund', async () => {
    const amount = parseUSDC('123.456789');
    await usdc.mint(employer, amount);
    await usdc.approve(manager.address, amount, {from: employer});
    await usdc.setPaused(true);
    await expectRevert.unspecified(manager.createJob('ipfs://fractional', amount, 60, 'fractional', {from: employer}));
    assert.equal((await manager.nextJobId()).toString(), '0');
    assert.equal((await manager.lockedEscrow()).toString(), '0');
    await usdc.setPaused(false);
    await manager.createJob('ipfs://fractional', amount, 60, 'fractional', {from: employer});
    await usdc.setBlocked(employer, true);
    await manager.cancelJob(0, {from: employer});
    assert.equal((await manager.lockedEscrow()).toString(), '0');
    assert.equal((await manager.pendingUSDC(employer)).toString(), amount);
    assert.equal((await usdc.balanceOf(manager.address)).toString(), amount);
    await usdc.setBlocked(employer, false);
    await manager.claimUSDC(employer);
    assert.equal((await usdc.balanceOf(employer)).toString(), amount);
  });
  it('scales every economic default to six decimals', async () => {
    for (const [getter, amount] of [['maxJobPayout','88888888'], ['agentBond','1'], ['agentBondMax','88888888'], ['validatorBondMin','10'], ['validatorBondMax','88888888']]) {
      assert.equal((await manager[getter]()).toString(), parseUSDC(amount), getter);
    }
  });
});

describe('USDC amount and chain configuration', () => {
  it('preserves six decimals and integers above Number.MAX_SAFE_INTEGER', () => {
    for (const amount of ['0.000001','1.234567','9007199254740993.123456']) assert.equal(formatUSDC(parseUSDC(amount)), amount);
    for (const amount of ['-1','1e6','0.0000001','1.2345678','NaN']) assert.throws(() => parseUSDC(amount));
    assert.throws(() => parseUSDC((2n ** 256n).toString()));
  });
  it('rejects noncanonical and unsupported deployment tokens', () => {
    for (const chain of [1,11155111]) requireCanonicalUSDC(chain, USDC_ADDRESSES[chain]);
    assert.throws(() => requireCanonicalUSDC(1, USDC_ADDRESSES[11155111]));
    assert.throws(() => requireCanonicalUSDC(137, USDC_ADDRESSES[1]));
  });
});
