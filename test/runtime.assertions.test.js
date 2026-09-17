'use strict';
const assert = require('node:assert/strict');
const { BN, expectEvent, expectRevert } = require('../scripts/test-helpers.cjs');
const { expectCustomError } = require('./helpers/errors');

const MockERC20 = artifacts.require('MockERC20');
const AGIJobPages = artifacts.require('AGIJobPages');

contract('Contract test runtime assertion canaries', ([owner, recipient, emptyAccount]) => {
  let token, otherToken, pages;

  before(async () => {
    token = await MockERC20.new({ from: owner });
    otherToken = await MockERC20.new({ from: owner });
    pages = await AGIJobPages.new('ipfs://canary/', 'https://example.invalid/', { from: owner });
  });

  it('recognizes genuine EVM reverts from both transactions and eth_call', async () => {
    await expectRevert.unspecified(token.transfer(recipient, 1, { from: emptyAccount }));
    await expectRevert.unspecified(token.transfer.call(recipient, 1, { from: emptyAccount }));
    assert.equal((await token.balanceOf(emptyAccount)).toString(), '0');
  });

  it('rejects a successfully mined transaction and a fulfilled false result as revert evidence', async () => {
    await assert.rejects(expectRevert.unspecified(token.mint(recipient, 7, { from: owner })), /execution succeeded/);
    await assert.rejects(expectRevert.unspecified(Promise.resolve(false)), /execution succeeded/);
    assert.equal((await token.balanceOf(recipient)).toString(), '7');
  });

  it('rejects transport errors, JavaScript failures and forged public revert flags', async () => {
    const errors = [
      new Error('transaction failed: transport disconnected'),
      new TypeError('execution error: invalid local argument'),
      new Error('execution reverted while parsing a local fixture'),
      Object.assign(new Error('execution reverted'), { data: '0x', code: -32000, evmRevert: true }),
    ];
    for (const error of errors) {
      await assert.rejects(expectRevert.unspecified(Promise.reject(error)), /Expected an EVM revert/);
    }
  });

  it('rejects an incorrect expected reason even when the VM really reverted', async () => {
    await assert.rejects(
      expectRevert(token.transfer(recipient, 1, { from: emptyAccount }), 'CANARY_REASON_NOT_PRESENT'),
      /Expected revert reason/,
    );
  });

  it('requires the exact custom error selector and rejects successful calls', async () => {
    await expectCustomError(pages.setDefaultImageURI.call(''), 'InvalidParameters');
    await assert.rejects(expectCustomError(pages.setDefaultImageURI.call(''), 'NotJobManager'), /Expected custom error NotJobManager/);
    await assert.rejects(expectCustomError(pages.setDefaultImageURI.call('ipfs://valid'), 'InvalidParameters'), /no revert was received/);
  });

  it('recognizes a real event with its decoded integer and indexed address arguments', async () => {
    const receipt = await token.mint(owner, 11, { from: owner });
    const event = expectEvent(receipt, 'Transfer', { from: '0x0000000000000000000000000000000000000000', to: owner, value: new BN(11) });
    assert.equal(event.address.toLowerCase(), token.address.toLowerCase());
    await expectEvent.inTransaction(receipt.tx, token, 'Transfer', { to: owner, value: new BN(11) });
  });

  it('rejects an identical event signature emitted by a different contract', async () => {
    const receipt = await token.mint(owner, 13, { from: owner });
    await assert.rejects(expectEvent.inTransaction(receipt.tx, otherToken, 'Transfer', { to: owner, value: new BN(13) }), /Missing event Transfer/);
  });

  it('rejects missing events and mismatched integer or address arguments', async () => {
    const receipt = await token.mint(owner, 17, { from: owner });
    assert.throws(() => expectEvent(receipt, 'Approval'), /Missing event Approval/);
    assert.throws(() => expectEvent(receipt, 'Transfer', { value: new BN(18) }), /No Transfer event matched/);
    assert.throws(() => expectEvent(receipt, 'Transfer', { to: recipient }), /No Transfer event matched/);
  });
});
