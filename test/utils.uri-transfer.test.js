const { expectRevert } = require("@openzeppelin/test-helpers");

const UtilsHarness = artifacts.require("UtilsHarness");
const MockERC20 = artifacts.require("MockERC20");
const ERC20NoReturn = artifacts.require("ERC20NoReturn");
const FailingERC20 = artifacts.require("FailingERC20");
const FeeOnTransferToken = artifacts.require("FeeOnTransferToken");
const MockMalformedERC20 = artifacts.require("MockMalformedERC20");
const BondMath = artifacts.require("BondMath");
const ENSOwnership = artifacts.require("ENSOwnership");
const ReputationMath = artifacts.require("ReputationMath");
const TransferUtils = artifacts.require("TransferUtils");
const UriUtils = artifacts.require("UriUtils");

contract("Utility libraries: UriUtils + TransferUtils", (accounts) => {
  const [owner, recipient, spender] = accounts;

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

  describe("UriUtils.requireValidUri", () => {
    it("accepts non-empty URIs used by the system", async () => {
      await harness.requireValidUri("ipfs://bafy123/metadata.json");
      await harness.requireValidUri("https://example.com/job/42.json");
      await harness.requireValidUri("ens://job-42.agi.eth");
      await harness.requireValidUri("QmHashNoScheme");
    });

    it("rejects empty URIs and whitespace/control characters", async () => {
      await expectRevert.unspecified(harness.requireValidUri(""));
      await expectRevert.unspecified(harness.requireValidUri("ipfs://contains space"));
      await expectRevert.unspecified(harness.requireValidUri("ipfs://contains\nnewline"));
      await expectRevert.unspecified(harness.requireValidUri("ipfs://contains\ttab"));
    });
  });

  describe("UriUtils.applyBaseIpfs", () => {
    it("prefixes baseIpfsUrl when no scheme is present", async () => {
      const out = await harness.applyBaseIpfs("bafy/job.json", "https://gateway/ipfs");
      assert.equal(out, "https://gateway/ipfs/bafy/job.json");
    });

    it("keeps URIs unchanged when scheme is already present", async () => {
      const outIpfs = await harness.applyBaseIpfs("ipfs://bafy/job.json", "https://gateway/ipfs");
      assert.equal(outIpfs, "ipfs://bafy/job.json");
      const outHttps = await harness.applyBaseIpfs("https://example.com/a.json", "ipfs://base");
      assert.equal(outHttps, "https://example.com/a.json");
    });

    it("is deterministic and not idempotent on already-prefixed path URIs", async () => {
      const once = await harness.applyBaseIpfs("QmHash", "ipfs://base");
      const twice = await harness.applyBaseIpfs(once, "ipfs://base");
      assert.equal(once, "ipfs://base/QmHash");
      assert.equal(twice, once, "second pass should be stable after scheme exists");
    });
  });

  describe("TransferUtils exact-transfer semantics", () => {
    it("supports standard ERC20 safeTransfer and safeTransferFromExact", async () => {
      const token = await MockERC20.new({ from: owner });
      await token.mint(harness.address, web3.utils.toWei("100"), { from: owner });
      await token.mint(owner, web3.utils.toWei("100"), { from: owner });
      await harness.safeTransfer(token.address, recipient, web3.utils.toWei("5"), { from: owner });
      assert.equal((await token.balanceOf(recipient)).toString(), web3.utils.toWei("5"));

      await token.approve(harness.address, web3.utils.toWei("7"), { from: owner });
      await harness.safeTransferFromExact(token.address, owner, spender, web3.utils.toWei("7"), { from: owner });
      assert.equal((await token.balanceOf(spender)).toString(), web3.utils.toWei("7"));
    });

    it("accepts no-return ERC20 transfers", async () => {
      const token = await ERC20NoReturn.new({ from: owner });
      await token.mint(owner, web3.utils.toWei("10"), { from: owner });
      await token.approve(harness.address, web3.utils.toWei("4"), { from: owner });
      await harness.safeTransferFromExact(token.address, owner, recipient, web3.utils.toWei("4"), { from: owner });
      assert.equal((await token.balanceOf(recipient)).toString(), web3.utils.toWei("4"));
    });

    it("reverts when token transfer/transferFrom returns false", async () => {
      const failing = await FailingERC20.new({ from: owner });
      await failing.mint(owner, web3.utils.toWei("10"), { from: owner });
      await failing.setFailTransfers(true, { from: owner });
      await failing.setFailTransferFroms(true, { from: owner });
      await failing.approve(harness.address, web3.utils.toWei("3"), { from: owner });

      await expectRevert.unspecified(
        harness.safeTransfer(failing.address, recipient, web3.utils.toWei("1"), { from: owner })
      );
      await expectRevert.unspecified(
        harness.safeTransferFromExact(failing.address, owner, recipient, web3.utils.toWei("3"), { from: owner })
      );
    });

    it("reverts on fee-on-transfer under-delivery for safeTransferFromExact", async () => {
      const token = await FeeOnTransferToken.new(web3.utils.toWei("100"), 1000, { from: owner });
      await token.approve(harness.address, web3.utils.toWei("10"), { from: owner });

      await expectRevert.unspecified(
        harness.safeTransferFromExact(token.address, owner, recipient, web3.utils.toWei("10"), { from: owner })
      );
    });

    it("reverts on transfer revert or malformed return data", async () => {
      const token = await MockMalformedERC20.new({ from: owner });
      await token.mint(owner, web3.utils.toWei("10"), { from: owner });
      await token.mint(harness.address, web3.utils.toWei("10"), { from: owner });
      await token.approve(harness.address, web3.utils.toWei("10"), { from: owner });

      await token.setTransferMode(3, { from: owner });
      await expectRevert.unspecified(
        harness.safeTransfer(token.address, recipient, web3.utils.toWei("1"), { from: owner })
      );

      for (const mode of [4, 5, 6]) {
        await token.setTransferFromMode(mode, { from: owner });
        await expectRevert.unspecified(
          harness.safeTransferFromExact(token.address, owner, recipient, web3.utils.toWei("1"), { from: owner })
        );
      }
    });
  });
});
