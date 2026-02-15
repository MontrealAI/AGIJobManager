const { expectRevert } = require("@openzeppelin/test-helpers");

const UtilsHarness = artifacts.require("UtilsHarness");
const MockERC20 = artifacts.require("MockERC20");
const ERC20NoReturn = artifacts.require("ERC20NoReturn");
const FailingERC20 = artifacts.require("FailingERC20");
const FeeOnTransferToken = artifacts.require("FeeOnTransferToken");
const MalformedReturnERC20 = artifacts.require("MalformedReturnERC20");
const RevertingBalanceOfERC20 = artifacts.require("RevertingBalanceOfERC20");
const InvalidBoolReturnERC20 = artifacts.require("InvalidBoolReturnERC20");
const RevertingERC20 = artifacts.require("RevertingERC20");
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
    it("accepts non-empty URIs with schemes and path-like values", async () => {
      await harness.requireValidUri("ipfs://bafy123/metadata.json");
      await harness.requireValidUri("ens://job-42.agi.eth");
      await harness.requireValidUri("QmHashNoScheme");
    });

    it("rejects empty URIs and whitespace characters", async () => {
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
      const out = await harness.applyBaseIpfs("ipfs://bafy/job.json", "https://gateway/ipfs");
      assert.equal(out, "ipfs://bafy/job.json");

      const twice = await harness.applyBaseIpfs(out, "https://gateway/ipfs");
      assert.equal(twice, "ipfs://bafy/job.json", "scheme-qualified URIs should be idempotent");
    });

    it("keeps URI unchanged when baseIpfsUrl is empty", async () => {
      const out = await harness.applyBaseIpfs("bafy/job.json", "");
      assert.equal(out, "bafy/job.json");
    });
    it("handles edge-case baseIpfsUrl values without reverting", async () => {
      let out = await harness.applyBaseIpfs("bafy/job.json", "/");
      assert.equal(out, "/bafy/job.json");

      out = await harness.applyBaseIpfs("bafy/job.json", "ipfs://");
      assert.equal(out, "ipfs://bafy/job.json");

      out = await harness.applyBaseIpfs("bafy/job.json", "weird://base?x=1#frag");
      assert.equal(out, "weird://base?x=1#frag/bafy/job.json");

      out = await harness.applyBaseIpfs("", "ipfs://base");
      assert.equal(out, "ipfs://base/");

      out = await harness.applyBaseIpfs("https://gateway/ipfs/bafy/job.json", "https://gateway/ipfs");
      assert.equal(out, "https://gateway/ipfs/bafy/job.json");
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

    it("reverts when token transfer/transferFrom calls revert", async () => {
      const token = await RevertingERC20.new({ from: owner });

      await expectRevert.unspecified(
        harness.safeTransfer(token.address, recipient, web3.utils.toWei("1"), { from: owner })
      );

      await expectRevert.unspecified(
        harness.safeTransferFromExact(token.address, owner, recipient, web3.utils.toWei("1"), { from: owner })
      );
    });

    it("reverts on fee-on-transfer under-delivery for safeTransferFromExact", async () => {
      const token = await FeeOnTransferToken.new(web3.utils.toWei("100"), 1000, { from: owner });
      await token.approve(harness.address, web3.utils.toWei("10"), { from: owner });

      await expectRevert.unspecified(
        harness.safeTransferFromExact(token.address, owner, recipient, web3.utils.toWei("10"), { from: owner })
      );
    });


    it("rejects non-contract token addresses", async () => {
      await expectRevert.unspecified(
        harness.safeTransfer("0x0000000000000000000000000000000000000001", recipient, 1, { from: owner })
      );

      await expectRevert.unspecified(
        harness.safeTransferFromExact("0x0000000000000000000000000000000000000001", owner, recipient, 1, { from: owner })
      );
    });



    it("reverts when balanceOf staticcalls revert during exact-transfer checks", async () => {
      const token = await RevertingBalanceOfERC20.new({ from: owner });
      await token.mint(owner, web3.utils.toWei("10"), { from: owner });
      await token.approve(harness.address, web3.utils.toWei("2"), { from: owner });

      await expectRevert.unspecified(
        harness.safeTransferFromExact(token.address, owner, recipient, web3.utils.toWei("2"), { from: owner })
      );
    });


    it("reverts on invalid bool word returns (not 0/1)", async () => {
      const token = await InvalidBoolReturnERC20.new({ from: owner });
      await token.mint(owner, web3.utils.toWei("10"), { from: owner });
      await token.approve(harness.address, web3.utils.toWei("10"), { from: owner });

      await expectRevert.unspecified(
        harness.safeTransfer(token.address, recipient, web3.utils.toWei("1"), { from: owner })
      );

      await expectRevert.unspecified(
        harness.safeTransferFromExact(token.address, owner, recipient, web3.utils.toWei("1"), { from: owner })
      );
    });

    it("reverts on malformed ERC20 return data", async () => {
      const token = await MalformedReturnERC20.new({ from: owner });
      await token.mint(owner, web3.utils.toWei("10"), { from: owner });
      await token.approve(harness.address, web3.utils.toWei("10"), { from: owner });

      await expectRevert.unspecified(
        harness.safeTransfer(token.address, recipient, web3.utils.toWei("1"), { from: owner })
      );

      await expectRevert.unspecified(
        harness.safeTransferFromExact(token.address, owner, recipient, web3.utils.toWei("1"), { from: owner })
      );
    });
  });
});
