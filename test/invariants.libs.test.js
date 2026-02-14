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
const InvalidBoolNameWrapper = artifacts.require("InvalidBoolNameWrapper");

const { rootNode, subnode, setNameWrapperOwnership, setResolverOwnership } = require("./helpers/ens");

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

});
