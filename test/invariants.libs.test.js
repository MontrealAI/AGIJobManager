const assert = require("assert");

const LibraryHarness = artifacts.require("LibraryHarness");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { toBN, toWei, soliditySha3, keccak256 } = web3.utils;

contract("Library invariants", (accounts) => {
  const [owner, claimant] = accounts;

  it("computes validator bond within expected bounds", async () => {
    const harness = await LibraryHarness.new({ from: owner });

    const zeroBond = await harness.computeValidatorBond(0, 0, 0, 0);
    assert.strictEqual(zeroBond.toString(), "0");

    for (let i = 0; i < 30; i += 1) {
      const payout = toBN(1 + i).mul(toBN(toWei("1")));
      const bps = 100 + i;
      const minBond = toBN(toWei("1"));
      const maxBond = toBN(toWei("50"));
      const bond = toBN(await harness.computeValidatorBond(payout, bps, minBond, maxBond));
      assert.ok(bond.lte(payout), "bond exceeds payout");
      assert.ok(bond.lte(maxBond), "bond exceeds max");
      if (payout.gte(minBond)) {
        assert.ok(bond.gte(minBond), "bond under min");
      }
    }
  });

  it("computes agent bond within expected bounds", async () => {
    const harness = await LibraryHarness.new({ from: owner });

    const zeroBond = await harness.computeAgentBond(0, 0, 0, 0, 0, 0);
    assert.strictEqual(zeroBond.toString(), "0");

    for (let i = 0; i < 30; i += 1) {
      const payout = toBN(2 + i).mul(toBN(toWei("1")));
      const duration = toBN(100 + i);
      const bps = 200 + i;
      const minBond = toBN(toWei("1"));
      const maxBond = toBN(toWei("40"));
      const durationLimit = toBN("1000");
      const bond = toBN(await harness.computeAgentBond(
        payout,
        duration,
        bps,
        minBond,
        maxBond,
        durationLimit
      ));
      assert.ok(bond.lte(payout), "bond exceeds payout");
      assert.ok(bond.lte(maxBond), "bond exceeds max");
      if (payout.gte(minBond)) {
        assert.ok(bond.gte(minBond), "bond under min");
      }
    }
  });

  it("computes reputation points without overflow and with sane bounds", async () => {
    const harness = await LibraryHarness.new({ from: owner });

    const zeroRep = await harness.computeReputationPoints(10, 10, 10, 10, false);
    assert.strictEqual(zeroRep.toString(), "0");

    const payout = toBN(toWei("1"));
    const rep = toBN(await harness.computeReputationPoints(payout, 1000, 200, 100, true));
    assert.ok(rep.lte(toBN("64")), "reputation is unexpectedly large");
  });

  it("verifies ENS ownership via resolver or name wrapper", async () => {
    const harness = await LibraryHarness.new({ from: owner });
    const registry = await MockENSRegistry.new({ from: owner });
    const resolver = await MockResolver.new({ from: owner });
    const nameWrapper = await MockNameWrapper.new({ from: owner });

    const rootNode = keccak256("root");
    const subdomain = "alice";
    const labelHash = keccak256(subdomain);
    const subnode = soliditySha3(
      { type: "bytes32", value: rootNode },
      { type: "bytes32", value: labelHash }
    );

    const notOwned = await harness.verifyENSOwnership(
      registry.address,
      nameWrapper.address,
      claimant,
      subdomain,
      rootNode
    );
    assert.strictEqual(notOwned, false);

    await registry.setResolver(subnode, resolver.address, { from: owner });
    await resolver.setAddr(subnode, claimant, { from: owner });
    const resolverOwned = await harness.verifyENSOwnership(
      registry.address,
      nameWrapper.address,
      claimant,
      subdomain,
      rootNode
    );
    assert.strictEqual(resolverOwned, true);

    await nameWrapper.setOwner(toBN(subnode), claimant, { from: owner });
    const wrapperOwned = await harness.verifyENSOwnership(
      registry.address,
      nameWrapper.address,
      claimant,
      subdomain,
      rootNode
    );
    assert.strictEqual(wrapperOwned, true);
  });
});
