const assert = require("assert");

const UtilsHarness = artifacts.require("UtilsHarness");
const BondMath = artifacts.require("BondMath");
const ENSOwnership = artifacts.require("ENSOwnership");
const ReputationMath = artifacts.require("ReputationMath");
const TransferUtils = artifacts.require("TransferUtils");
const UriUtils = artifacts.require("UriUtils");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const RevertingENSRegistry = artifacts.require("RevertingENSRegistry");
const RevertingNameWrapper = artifacts.require("RevertingNameWrapper");
const RevertingResolver = artifacts.require("RevertingResolver");
const MalformedENSRegistry = artifacts.require("MalformedENSRegistry");
const MalformedNameWrapper = artifacts.require("MalformedNameWrapper");
const MalformedResolver = artifacts.require("MalformedResolver");
const MalformedApprovalNameWrapper = artifacts.require("MalformedApprovalNameWrapper");

const { rootNode, subnode, setNameWrapperOwnership, setResolverOwnership } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");

const { toBN, toWei, soliditySha3 } = web3.utils;

contract("Utility library invariants", (accounts) => {
  const [owner, claimant, other] = accounts;
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

  it("computes validator bonds within bounds", async () => {
    const payout = toBN(toWei("5"));
    const minBond = toBN(toWei("1"));
    const maxBond = toBN(toWei("3"));
    const bps = toBN("2000");

    const bond = await harness.computeValidatorBond.call(payout, bps, minBond, maxBond);
    assert.ok(bond.lte(payout));
    assert.ok(bond.lte(maxBond));
    assert.ok(bond.gte(minBond));

    const uncapped = await harness.computeValidatorBond.call(payout, bps, 0, 0);
    assert.equal(uncapped.toString(), payout.muln(20).divn(100).toString(), "maxBond=0 should be uncapped");
  });

  it("computes agent bonds within bounds and monotonic with duration", async () => {
    const payout = toBN(toWei("50"));
    const minBond = toBN(toWei("1"));
    const maxBond = toBN(toWei("10"));
    const shortBond = await harness.computeAgentBond.call(payout, 100, 500, minBond, maxBond, 10000);
    const longBond = await harness.computeAgentBond.call(payout, 10000, 500, minBond, maxBond, 10000);
    assert.ok(longBond.gte(shortBond));
    assert.ok(longBond.lte(maxBond));
    assert.ok(longBond.lte(payout));
  });

  it("computes reputation points deterministically and bounded", async () => {
    const points = await harness.computeReputationPoints.call(toBN(toWei("2")), 3600, 2000, 0, true);
    assert.ok(points.lt(toBN("1000")));

    const early = await harness.computeReputationPoints.call(toBN(toWei("2")), 10000, 1000, 0, true);
    const late = await harness.computeReputationPoints.call(toBN(toWei("2")), 10000, 9000, 0, true);
    assert.ok(early.gte(late), "faster completion should not reduce reputation");

    const zeroPoints = await harness.computeReputationPoints.call(toBN(toWei("2")), 3600, 2000, 0, false);
    assert.equal(zeroPoints.toString(), "0");
  });

  it("verifies ENS ownership for wrapped and resolver-backed records", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    const root = rootNode("club-root");
    const label = "alice";

    const notOwned = await harness.verifyENSOwnership.call(ens.address, nameWrapper.address, claimant, label, root);
    assert.equal(notOwned, false);

    await setNameWrapperOwnership(nameWrapper, root, label, claimant);
    const wrappedOwned = await harness.verifyENSOwnership.call(ens.address, nameWrapper.address, claimant, label, root);
    assert.equal(wrappedOwned, true);

    await setResolverOwnership(ens, resolver, root, label, other);
    const resolverOwned = await harness.verifyENSOwnership.call(
      ens.address,
      "0x0000000000000000000000000000000000000000",
      other,
      label,
      root
    );
    assert.equal(resolverOwned, true);
  });

  it("accepts name-wrapper direct owner, approved address and operator approvals", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const root = rootNode("club-root");
    const label = "alice";
    const node = subnode(root, label);

    await nameWrapper.setOwner(web3.utils.toBN(node), claimant);
    assert.equal(await harness.verifyENSOwnership.call(ens.address, nameWrapper.address, claimant, label, root), true);

    await nameWrapper.setOwner(web3.utils.toBN(node), other);
    await nameWrapper.setApprovalForAll(claimant, true, { from: other });
    assert.equal(await harness.verifyENSOwnership.call(ens.address, nameWrapper.address, claimant, label, root), true);
  });

  it("fails closed for reverting or malformed ENS components", async () => {
    const root = rootNode("club-root");

    const revertingEns = await RevertingENSRegistry.new({ from: owner });
    const revertingWrapper = await RevertingNameWrapper.new({ from: owner });
    const revertingResolver = await RevertingResolver.new({ from: owner });
    await revertingEns.setResolverAddress(revertingResolver.address, { from: owner });
    await revertingEns.setRevertResolver(true, { from: owner });
    await revertingWrapper.setRevertOwnerOf(true, { from: owner });

    const resA = await harness.verifyENSOwnership.call(revertingEns.address, revertingWrapper.address, claimant, "alice", root);
    assert.equal(resA, false, "reverting external calls must fail closed");

    await revertingEns.setRevertResolver(false, { from: owner });
    await revertingResolver.setRevertAddr(true, { from: owner });
    const resB = await harness.verifyENSOwnership.call(revertingEns.address, revertingWrapper.address, claimant, "alice", root);
    assert.equal(resB, false, "reverting resolver should fail closed");

    const malformedEns = await MalformedENSRegistry.new({ from: owner });
    const malformedWrapper = await MalformedNameWrapper.new({ from: owner });
    const malformedResolver = await MalformedResolver.new({ from: owner });
    await malformedEns.setResolverAddress(malformedResolver.address, { from: owner });

    const resC = await harness.verifyENSOwnership.call(malformedEns.address, malformedWrapper.address, claimant, "alice", root);
    assert.equal(resC, false, "short returndata should fail closed");
  });

  it("rejects malformed bool approvals and invalid labels before external calls", async () => {
    const malformedApproval = await MalformedApprovalNameWrapper.new({ from: owner });
    const root = rootNode("club-root");
    const node = subnode(root, "alice");
    await malformedApproval.setOwnerValue(other, { from: owner });

    const approved = await harness.verifyENSOwnership.call(
      "0x0000000000000000000000000000000000000000",
      malformedApproval.address,
      claimant,
      "alice",
      root
    );
    assert.equal(approved, false, "isApprovedForAll returning 2 should fail closed");

    const revertingEns = await RevertingENSRegistry.new({ from: owner });
    await revertingEns.setRevertResolver(true, { from: owner });
    await expectCustomError(
      harness.verifyENSOwnership.call(revertingEns.address, malformedApproval.address, claimant, "alice.bob", root),
      "InvalidENSLabel"
    );
  });

  it("verifies merkle ownership path deterministically", async () => {
    const leaf = soliditySha3({ type: "address", value: claimant });
    const ok = await harness.verifyMerkleOwnership.call(claimant, [], leaf);
    const bad = await harness.verifyMerkleOwnership.call(other, [], leaf);
    assert.equal(ok, true);
    assert.equal(bad, false);
  });
});
