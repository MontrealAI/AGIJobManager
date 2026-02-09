const assert = require("assert");

const LibraryHarness = artifacts.require("LibraryHarness");
const MockENSRegistry = artifacts.require("MockENSRegistry");
const MockResolver = artifacts.require("MockResolver");
const MockNameWrapper = artifacts.require("MockNameWrapper");

const { toBN } = web3.utils;

function makeRng(seed) {
  let value = seed;
  return (max) => {
    value = (value * 1103515245 + 12345) % 0x80000000;
    return value % max;
  };
}

contract("Library invariants", (accounts) => {
  const [claimant] = accounts;
  let harness;

  beforeEach(async () => {
    harness = await LibraryHarness.new();
  });

  it("enforces validator bond bounds", async () => {
    const rand = makeRng(1337);

    for (let i = 0; i < 30; i += 1) {
      const payout = toBN(rand(1_000_000) + 1);
      const bps = toBN(rand(10_001));
      const minBond = toBN(rand(10_000));
      const maxBond = minBond.add(toBN(rand(10_000)));

      const bond = await harness.computeValidatorBond(payout, bps, minBond, maxBond);
      if (bps.isZero() && minBond.isZero() && maxBond.isZero()) {
        assert.strictEqual(bond.toString(), "0");
        continue;
      }
      assert(toBN(bond).lte(payout));
      assert(toBN(bond).lte(maxBond));
      if (payout.gte(minBond)) {
        assert(toBN(bond).gte(minBond));
      }
    }
  });

  it("enforces agent bond bounds", async () => {
    const rand = makeRng(2024);

    for (let i = 0; i < 30; i += 1) {
      const payout = toBN(rand(1_000_000) + 1);
      const duration = toBN(rand(10_000));
      const bps = toBN(rand(10_001));
      const minBond = toBN(rand(10_000));
      const maxBond = minBond.add(toBN(rand(10_000)));
      const durationLimit = toBN(rand(20_000) + 1);

      const bond = await harness.computeAgentBond(
        payout,
        duration,
        bps,
        minBond,
        maxBond,
        durationLimit
      );
      if (bps.isZero() && minBond.isZero() && maxBond.isZero()) {
        assert.strictEqual(bond.toString(), "0");
        continue;
      }
      assert(toBN(bond).lte(payout));
      assert(toBN(bond).lte(maxBond));
      if (payout.gte(minBond)) {
        assert(toBN(bond).gte(minBond));
      }
    }
  });

  it("computes reasonable reputation points", async () => {
    const repZero = await harness.computeReputationPoints(1000, 100, 50, 10, false);
    assert.strictEqual(repZero.toString(), "0");

    const repSmall = await harness.computeReputationPoints(
      toBN("1000000000000000000"),
      100,
      80,
      10,
      true
    );
    assert(toBN(repSmall).lte(toBN("64")));

    const rand = makeRng(88);
    for (let i = 0; i < 25; i += 1) {
      const payout = toBN(rand(1_000_000_000));
      const duration = toBN(rand(10_000) + 1);
      const assignedAt = toBN(rand(1000));
      const completionRequestedAt = assignedAt.add(toBN(rand(2000)));
      await harness.computeReputationPoints(payout, duration, completionRequestedAt, assignedAt, true);
    }
  });

  it("verifies ENS ownership via resolver and name wrapper", async () => {
    const ens = await MockENSRegistry.new();
    const resolver = await MockResolver.new();
    const nameWrapper = await MockNameWrapper.new();
    const rootNode = web3.utils.keccak256("root");
    const subdomain = "worker";
    const labelHash = web3.utils.keccak256(subdomain);
    const subnode = web3.utils.soliditySha3(
      { t: "bytes32", v: rootNode },
      { t: "bytes32", v: labelHash }
    );

    const missing = await harness.verifyENSOwnership(
      ens.address,
      nameWrapper.address,
      claimant,
      subdomain,
      rootNode
    );
    assert.strictEqual(missing, false);

    await ens.setResolver(subnode, resolver.address);
    await resolver.setAddr(subnode, claimant);
    const viaResolver = await harness.verifyENSOwnership(
      ens.address,
      "0x0000000000000000000000000000000000000000",
      claimant,
      subdomain,
      rootNode
    );
    assert.strictEqual(viaResolver, true);

    await nameWrapper.setOwner(toBN(subnode), claimant);
    const viaWrapper = await harness.verifyENSOwnership(
      ens.address,
      nameWrapper.address,
      claimant,
      subdomain,
      rootNode
    );
    assert.strictEqual(viaWrapper, true);
  });
});
