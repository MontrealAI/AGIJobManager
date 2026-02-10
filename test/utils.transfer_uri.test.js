const assert = require("assert");

const UtilsHarness = artifacts.require("UtilsHarness");
const BondMath = artifacts.require("BondMath");
const ENSOwnership = artifacts.require("ENSOwnership");
const ReputationMath = artifacts.require("ReputationMath");
const TransferUtils = artifacts.require("TransferUtils");
const UriUtils = artifacts.require("UriUtils");
const MockERC20 = artifacts.require("MockERC20");
const FailingERC20 = artifacts.require("FailingERC20");
const ERC20NoReturn = artifacts.require("ERC20NoReturn");

contract("TransferUtils and UriUtils", (accounts) => {
  const [owner, alice, bob] = accounts;
  const { toBN, toWei } = web3.utils;
  let harness;

  beforeEach(async () => {
    const bondMath = await BondMath.new({ from: owner });
    const ensOwnership = await ENSOwnership.new({ from: owner });
    const reputationMath = await ReputationMath.new({ from: owner });
    const transferUtils = await TransferUtils.new({ from: owner });
    const uriUtils = await UriUtils.new({ from: owner });
    await UtilsHarness.link(BondMath, bondMath.address);
    await UtilsHarness.link(ENSOwnership, ensOwnership.address);
    await UtilsHarness.link(ReputationMath, reputationMath.address);
    await UtilsHarness.link(TransferUtils, transferUtils.address);
    await UtilsHarness.link(UriUtils, uriUtils.address);
    harness = await UtilsHarness.new({ from: owner });
  });

  it("accepts valid URIs and rejects whitespace-delimited URIs", async () => {
    await harness.requireValidUri("ipfs://QmHash", { from: owner });
    await harness.requireValidUri("ens://job-1.alpha.jobs.agi.eth", { from: owner });

    try {
      await harness.requireValidUri("ipfs://bad hash", { from: owner });
      assert.fail("expected invalid URI rejection");
    } catch (error) {
      assert.ok(error.message.includes("revert") || error.message.includes("VM Exception"), error.message);
    }
  });

  it("applies IPFS base only for schemeless URIs", async () => {
    const based = await harness.applyBaseIpfs.call("QmHash", "ipfs://base", { from: owner });
    assert.equal(based, "ipfs://base/QmHash");

    const keepsEns = await harness.applyBaseIpfs.call("ens://job-1.alpha.jobs.agi.eth", "ipfs://base", { from: owner });
    assert.equal(keepsEns, "ens://job-1.alpha.jobs.agi.eth");

    const keepsHttp = await harness.applyBaseIpfs.call("https://example.com/path", "ipfs://base", { from: owner });
    assert.equal(keepsHttp, "https://example.com/path");
  });

  it("supports ERC20 tokens with no return data in safeTransfer", async () => {
    const token = await ERC20NoReturn.new({ from: owner });
    const amount = toBN(toWei("3"));
    await token.mint(harness.address, amount, { from: owner });

    await harness.safeTransfer(token.address, alice, amount, { from: owner });

    assert.equal((await token.balanceOf(alice)).toString(), amount.toString());
    assert.equal((await token.balanceOf(harness.address)).toString(), "0");
  });

  it("reverts safeTransfer when token returns false", async () => {
    const token = await FailingERC20.new({ from: owner });
    const amount = toBN(toWei("1"));
    await token.mint(harness.address, amount, { from: owner });
    await token.setFailTransfers(true, { from: owner });

    try {
      await harness.safeTransfer(token.address, alice, amount, { from: owner });
      assert.fail("expected transfer failure");
    } catch (error) {
      assert.ok(error.message.includes("Custom error") || error.message.includes("revert") || error.message.includes("VM Exception"), error.message);
    }
  });

  it("enforces exact transferFrom amount accounting", async () => {
    const token = await MockERC20.new({ from: owner });
    const amount = toBN(toWei("2"));
    await token.mint(alice, amount, { from: owner });
    await token.approve(harness.address, amount, { from: alice });

    await harness.safeTransferFromExact(token.address, alice, bob, amount, { from: owner });

    assert.equal((await token.balanceOf(bob)).toString(), amount.toString());
    assert.equal((await token.balanceOf(alice)).toString(), "0");
  });
});
