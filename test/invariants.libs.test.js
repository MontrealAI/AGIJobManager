const assert = require("assert");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const UtilsHarness = artifacts.require("UtilsHarness");
const BondMath = artifacts.require("BondMath");
const ENSOwnership = artifacts.require("ENSOwnership");
const ReputationMath = artifacts.require("ReputationMath");
const TransferUtils = artifacts.require("TransferUtils");
const UriUtils = artifacts.require("UriUtils");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");
const InvalidBoolNameWrapper = artifacts.require("InvalidBoolNameWrapper");
const RevertingENSRegistry = artifacts.require("RevertingENSRegistry");
const RevertingNameWrapper = artifacts.require("RevertingNameWrapper");
const RevertingResolver = artifacts.require("RevertingResolver");
const MalformedENSRegistry = artifacts.require("MalformedENSRegistry");
const MalformedNameWrapper = artifacts.require("MalformedNameWrapper");
const MalformedResolver = artifacts.require("MalformedResolver");

const { rootNode, subnode, setNameWrapperOwnership, setResolverOwnership } = require("./helpers/ens");
const { expectCustomError } = require("./helpers/errors");

const { toBN, toWei } = web3.utils;

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
    assert.ok(bond.lte(payout), "bond should not exceed payout");
    assert.ok(bond.lte(maxBond), "bond should not exceed max bond");
    assert.ok(bond.gte(minBond), "bond should be at least the min bond");

    const zeroBond = await harness.computeValidatorBond.call(payout, 0, 0, 0);
    assert.equal(zeroBond.toString(), "0", "zero params should return zero bond");
  });


  it("keeps validator bonds monotonic and overflow-safe at uint256 boundaries", async () => {
    const maxUint = toBN("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

    const high = await harness.computeValidatorBond.call(maxUint, 10_000, 0, maxUint);
    assert.equal(high.toString(), maxUint.toString(), "100% bps should cap at payout even at max uint");

    const low = await harness.computeValidatorBond.call(toBN(toWei("10")), 500, 0, maxUint);
    const medium = await harness.computeValidatorBond.call(toBN(toWei("10")), 1500, 0, maxUint);
    assert.ok(medium.gte(low), "higher bps should not reduce validator bond");
  });

  it("computes agent bonds within bounds across varied inputs", async () => {
    const durationLimit = toBN("10000");
    for (let i = 1; i <= 30; i += 1) {
      const payout = toBN(toWei(`${i}`));
      const duration = toBN(1000 + i);
      const bps = toBN(100 + i);
      const minBond = toBN(toWei("1"));
      const maxBond = toBN(toWei("50"));

      const bond = await harness.computeAgentBond.call(
        payout,
        duration,
        bps,
        minBond,
        maxBond,
        durationLimit
      );
      assert.ok(bond.lte(payout), "bond should not exceed payout");
      assert.ok(bond.lte(maxBond), "bond should not exceed max bond");
      if (payout.gte(minBond)) {
        assert.ok(bond.gte(minBond), "bond should be at least the min bond when payout allows");
      }
    }
  });

  it("computes reputation points without overflow for small payouts", async () => {
    const points = await harness.computeReputationPoints.call(
      toBN(toWei("2")),
      toBN("3600"),
      toBN("2000"),
      toBN("0"),
      true
    );
    assert.ok(points.lt(toBN("1000")), "reputation points should be bounded for small payouts");

    const zeroPoints = await harness.computeReputationPoints.call(
      toBN(toWei("2")),
      toBN("3600"),
      toBN("2000"),
      toBN("0"),
      false
    );
    assert.equal(zeroPoints.toString(), "0", "ineligible reputation should return zero");
  });

  it("verifies ENS ownership for wrapped and resolver-backed records", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const resolver = await MockResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    const root = rootNode("club-root");
    const label = "alice";
    const node = subnode(root, label);

    const notOwned = await harness.verifyENSOwnership.call(
      ens.address,
      nameWrapper.address,
      claimant,
      label,
      root
    );
    assert.equal(notOwned, false, "unowned records should return false");

    const zeroRoot = await harness.verifyENSOwnership.call(
      ens.address,
      nameWrapper.address,
      claimant,
      label,
      "0x" + "00".repeat(32)
    );
    assert.equal(zeroRoot, false, "zero root nodes should fail closed");

    await setNameWrapperOwnership(nameWrapper, root, label, claimant);
    const wrappedOwned = await harness.verifyENSOwnership.call(
      ens.address,
      nameWrapper.address,
      claimant,
      label,
      root
    );
    assert.equal(wrappedOwned, true, "wrapped ownership should be true");

    await setResolverOwnership(ens, resolver, root, label, other);
    const resolverOwned = await harness.verifyENSOwnership.call(
      ens.address,
      "0x0000000000000000000000000000000000000000",
      other,
      label,
      root
    );
    assert.equal(resolverOwned, true, "resolver ownership should be true");
  });


  it("validates ENS labels before any external ENS staticcall", async () => {
    const ens = await RevertingENSRegistry.new({ from: owner });
    const wrapper = await RevertingNameWrapper.new({ from: owner });

    await ens.setRevertResolver(true, { from: owner });
    await wrapper.setRevertOwnerOf(true, { from: owner });

    await expectCustomError(
      harness.verifyENSOwnership(ens.address, wrapper.address, claimant, "alice.bob", rootNode("club-root")),
      "InvalidENSLabel"
    );
  });

  it("verifies merkle ownership for known proofs only", async () => {
    const leaves = [claimant, other].map((addr) => Buffer.from(web3.utils.soliditySha3(addr).slice(2), "hex"));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    const proof = tree.getHexProof(Buffer.from(web3.utils.soliditySha3(claimant).slice(2), "hex"));
    const badProof = tree.getHexProof(Buffer.from(web3.utils.soliditySha3(other).slice(2), "hex"));

    const ok = await harness.verifyMerkleOwnership.call(claimant, proof, root);
    assert.equal(ok, true, "known valid proof should verify");

    const bad = await harness.verifyMerkleOwnership.call(claimant, badProof, root);
    assert.equal(bad, false, "proof for a different claimant should not verify");
  });

  it("accepts name-wrapper operator approvals without reverting", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });
    const root = rootNode("club-root");
    const label = "alice";
    const node = subnode(root, label);

    await nameWrapper.setOwner(web3.utils.toBN(node), other);
    await nameWrapper.setApprovalForAll(claimant, true, { from: other });

    const approved = await harness.verifyENSOwnership.call(
      ens.address,
      nameWrapper.address,
      claimant,
      label,
      root
    );
    assert.equal(approved, true, "approved operator should pass ownership check");
  });


  it("accepts owner/getApproved/isApprovedForAll authorization modes", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const wrapper = await MockNameWrapper.new({ from: owner });
    const root = rootNode("club-root");
    const label = "agent1";
    const node = subnode(root, label);
    const nodeId = web3.utils.toBN(node);

    await wrapper.setOwner(nodeId, other);
    await wrapper.setApproved(nodeId, claimant);
    let ok = await harness.verifyENSOwnership.call(ens.address, wrapper.address, claimant, label, root);
    assert.equal(ok, true, "getApproved claimant should pass");

    await wrapper.setApproved(nodeId, "0x0000000000000000000000000000000000000000");
    await wrapper.setApprovalForAll(claimant, true, { from: other });
    ok = await harness.verifyENSOwnership.call(ens.address, wrapper.address, claimant, label, root);
    assert.equal(ok, true, "isApprovedForAll claimant should pass");

    await wrapper.setApprovalForAll(claimant, false, { from: other });
    ok = await harness.verifyENSOwnership.call(ens.address, wrapper.address, claimant, label, root);
    assert.equal(ok, false, "non-owner/non-approved claimant should fail");
  });

  it("fails closed on malformed bool return values from wrappers", async () => {
    const ens = await MockENSRegistry.new({ from: owner });
    const wrapper = await InvalidBoolNameWrapper.new({ from: owner });
    const root = rootNode("club-root");

    await wrapper.setOwnerValue(other, { from: owner });
    await wrapper.setApprovedValue("0x0000000000000000000000000000000000000000", { from: owner });

    const ok = await harness.verifyENSOwnership.call(ens.address, wrapper.address, claimant, "agent2", root);
    assert.equal(ok, false, "invalid bool encoding should fail closed");
  });

  it("fails closed (no revert) on reverting ENS/resolver/name-wrapper calls for valid labels", async () => {
    const ens = await RevertingENSRegistry.new({ from: owner });
    const wrapper = await RevertingNameWrapper.new({ from: owner });
    const resolver = await RevertingResolver.new({ from: owner });
    const root = rootNode("club-root");

    await ens.setResolverAddress(resolver.address, { from: owner });
    await ens.setRevertResolver(true, { from: owner });
    await wrapper.setRevertOwnerOf(true, { from: owner });

    let ok = await harness.verifyENSOwnership.call(ens.address, wrapper.address, claimant, "alice", root);
    assert.equal(ok, false, "reverting ownerOf/resolver should fail closed");

    await ens.setRevertResolver(false, { from: owner });
    await resolver.setRevertAddr(true, { from: owner });
    ok = await harness.verifyENSOwnership.call(ens.address, "0x0000000000000000000000000000000000000000", claimant, "alice", root);
    assert.equal(ok, false, "reverting resolver.addr should fail closed");
  });

  it("fails closed on malformed ENS/resolver/name-wrapper return data", async () => {
    const ens = await MalformedENSRegistry.new({ from: owner });
    const wrapper = await MalformedNameWrapper.new({ from: owner });
    const resolver = await MalformedResolver.new({ from: owner });
    const root = rootNode("club-root");
    await ens.setResolverAddress(resolver.address, { from: owner });

    let ok = await harness.verifyENSOwnership.call(ens.address, wrapper.address, claimant, "alice", root);
    assert.equal(ok, false, "malformed ownerOf return data should fail closed");

    ok = await harness.verifyENSOwnership.call(ens.address, "0x0000000000000000000000000000000000000000", claimant, "alice", root);
    assert.equal(ok, false, "malformed resolver.addr return data should fail closed");
  });

  it("keeps bond math monotonic around AGIJobManager-like boundaries", async () => {
    const payout = toBN(toWei("100"));
    const bps = toBN("500");
    const minBond = toBN(toWei("1"));
    const maxBond = toBN(toWei("25"));
    const durationLimit = toBN("10000000");

    const zeroPayout = await harness.computeAgentBond.call(0, 1000, bps, minBond, maxBond, durationLimit);
    assert.equal(zeroPayout.toString(), "0", "payout=0 should never force positive bond");

    const shortDuration = await harness.computeAgentBond.call(payout, 1000, bps, minBond, maxBond, durationLimit);
    const longDuration = await harness.computeAgentBond.call(payout, 1_000_000, bps, minBond, maxBond, durationLimit);
    assert.ok(longDuration.gte(shortDuration), "longer duration should not reduce required agent bond");

    const lowPayout = await harness.computeValidatorBond.call(toBN(toWei("10")), bps, minBond, maxBond);
    const highPayout = await harness.computeValidatorBond.call(toBN(toWei("20")), bps, minBond, maxBond);
    assert.ok(highPayout.gte(lowPayout), "higher payout should not reduce validator bond");
  });

  it("keeps reputation math deterministic and bounded on boundary timestamps", async () => {
    const payout = toBN(toWei("5000"));
    const duration = toBN("10000000");
    const assignedAt = toBN("1700000000");

    const ineligible = await harness.computeReputationPoints.call(
      payout,
      duration,
      assignedAt.addn(3600),
      assignedAt,
      false
    );
    assert.equal(ineligible.toString(), "0", "repEligible=false must always be zero");

    const onTimeA = await harness.computeReputationPoints.call(
      payout,
      duration,
      assignedAt.addn(3600),
      assignedAt,
      true
    );
    const onTimeB = await harness.computeReputationPoints.call(
      payout,
      duration,
      assignedAt.addn(3600),
      assignedAt,
      true
    );
    assert.equal(onTimeA.toString(), onTimeB.toString(), "same inputs must produce deterministic reputation");

    const late = await harness.computeReputationPoints.call(
      payout,
      duration,
      assignedAt.add(duration).addn(1),
      assignedAt,
      true
    );
    assert.ok(onTimeA.gte(late), "slower completion should not increase reputation points");
  });

});
