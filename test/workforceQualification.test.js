const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  qualifyWorkforce,
  signAttestation,
  validatePolicy,
} = require("../scripts/economics/workforce.cjs");
const {
  digest,
  checkRuntime,
} = require("../scripts/economics/computer-work.cjs");
const fs = require("node:fs");
const {fixture} = require("./helpers/workforce-fixture.cjs");
describe("Workforce operational qualification", function () {
  it("accepts only a complete signed synthetic test fixture (not deployment evidence)", () => {
    const f = fixture();
    assert.equal(
      qualifyWorkforce(f.policy, f.evidence, { now: f.now }).eligible,
      true,
    );
  });
  it("returns actionable missing-evidence gates without inventing readiness", () => {
    const f = fixture(),
      r = qualifyWorkforce(f.policy, {}, { now: f.now });
    assert.equal(r.eligible, false);
    assert.deepEqual(
      r.reasons.map((x) => x.gate),
      ["agent", "reviewer", "validation", "security"],
    );
  });
  for (const [label, mutate] of [
    [
      "reused controller keys",
      (f) =>
        (f.policy.controllers.oracle.publicKey =
          f.policy.controllers.agent.publicKey),
    ],
    [
      "common organizational control",
      (f) =>
        (f.policy.controllers.reviewer.organization =
          f.policy.controllers.agent.organization),
    ],
  ])
    it("rejects " + label, () => {
      const f = fixture();
      mutate(f);
      assert.throws(
        () => validatePolicy(f.policy),
        /INDEPENDENT_CONTROL_REQUIRED/,
      );
    });
  for (const [label, mutate, gate] of [
    [
      "forged evidence",
      (f) => (f.evidence.agent.body.payload.checks.capture = false),
      "agent",
    ],
    [
      "expired commissioning",
      (f) => (f.evidence.agent.body.expiresAt = f.now - 1),
      "agent",
    ],
    [
      "unperformed input rehearsal",
      (f) => (f.payloads.agent.checks.keyboard = false),
      "agent",
    ],
    [
      "same boot before and after restart",
      (f) =>
        (f.payloads.agent.restart.afterBootSha256 =
          f.payloads.agent.restart.beforeBootSha256),
      "agent",
    ],
    [
      "Linux fixture relabeled as a Mac",
      (f) => (f.payloads.agent.platform = "linux"),
      "agent",
    ],
    [
      "same physical machine",
      (f) =>
        (f.payloads.reviewer.machineSha256 = f.payloads.agent.machineSha256),
      "independence",
    ],
    [
      "unreconciled provider bills",
      (f) => (f.payloads.validation.ledger.engagements[0].costUSDC = null),
      "validation",
    ],
    [
      "synthetic results claimed as qualification",
      (f) => (f.payloads.validation.ledger.measurementKind = "synthetic"),
      "validation",
    ],
    [
      "held-out contamination",
      (f) => {
        f.payloads.validation.plan.cases.at(-1).group =
          f.payloads.validation.plan.cases[0].group;
        f.payloads.validation.ledger.planSha256 = digest(
          f.payloads.validation.plan,
        );
      },
      "validation",
    ],
    [
      "missing failed jobs",
      (f) => f.payloads.validation.ledger.engagements.pop(),
      "validation",
    ],
    [
      "false acceptance limit exceeded",
      (f) =>
        f.payloads.validation.ledger.engagements
          .filter((x) => x.caseId.startsWith("evaluation-reviewer"))
          .forEach((x) => (x.verdict = "approve")),
      "validation",
    ],
    [
      "excessive founder intervention",
      (f) =>
        (f.payloads.validation.ledger.engagements.at(-1).humanSeconds = 10000),
      "validation",
    ],
    [
      "estimated value replacing cash",
      (f) =>
        (f.payloads.validation.ledger.engagements[0].realizedValueUSDC = "100"),
      "validation",
    ],
    [
      "no actual paid settlements",
      (f) =>
        f.payloads.validation.ledger.engagements.forEach((x) => {
          x.receiptsUSDC = "0";
          x.costUSDC = "0";
        }),
      "validation",
    ],
    [
      "calibration losses excluded from total cost",
      (f) => (f.payloads.validation.ledger.engagements[0].costUSDC = "10000"),
      "validation",
    ],
    [
      "wrong external review scope",
      (f) => (f.payloads.security.scopeSha256 = "e".repeat(64)),
      "security",
    ],
    [
      "negative realized economics",
      (f) =>
        f.payloads.validation.ledger.engagements.forEach(
          (x) => (x.costUSDC = "100"),
        ),
      "validation",
    ],
    [
      "outstanding high severity finding",
      (f) => (f.payloads.security.openHigh = 1),
      "security",
    ],
    [
      "review of different source",
      (f) => (f.payloads.security.sourceSha256 = "f".repeat(64)),
      "security",
    ],
  ])
    it("blocks " + label, () => {
      const f = fixture();
      mutate(f);
      if (label !== "forged evidence" && label !== "expired commissioning")
        f.resign();
      const r = qualifyWorkforce(f.policy, f.evidence, { now: f.now });
      assert.equal(r.eligible, false);
      assert(r.reasons.some((x) => x.gate === gate));
    });
  it("supports a native installation identity without calling it a Docker image", () => {
    const s = JSON.parse(fs.readFileSync("examples/computer-work-v2.json")),
      r = {
        schemaVersion: 2,
        adapter: "openclaw-native/v1",
        model: "test",
        openclawVersion: "test",
        policySha256: "a".repeat(64),
        installationSha256: "b".repeat(64),
        capabilities: ["desktop"],
        scope: "dedicated-account",
        resources: ["dedicated-account:test"],
        maxTaskSeconds: 600,
      };
    s.environment.runtimeSha256.agent = digest(r);
    s.environment.capabilities.agent = ["desktop"];
    s.authority.agent = { scope: "dedicated-account", resources: r.resources };
    assert.equal(checkRuntime(s, r, "agent", 1).environmentSha256, digest(r));
    r.adapter = "unknown";
    assert.throws(() => checkRuntime(s, r, "agent", 1));
  });
});
