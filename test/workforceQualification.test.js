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
function fixture() {
  const now = 1800000000,
    h = "a".repeat(64),
    keys = Object.fromEntries(
      ["agent", "reviewer", "oracle", "auditor"].map((r) => [
        r,
        crypto.generateKeyPairSync("ed25519"),
      ]),
    );
  const policy = {
    schema: "agi-workforce-policy/v1",
    runtimeSha256: { agent: "b".repeat(64), reviewer: "c".repeat(64) },
    sourceSha256: h,
    securityScopeSha256: h,
    allowedSpecSha256: [h],
    controllers: Object.fromEntries(
      Object.entries(keys).map(([r, k]) => [
        r,
        {
          id: r,
          organization: r + "-independent-controller",
          publicKey: k.publicKey.export({ type: "spki", format: "pem" }),
        },
      ]),
    ),
    limits: {
      minimumValidReviews: 10,
      minimumInvalidReviews: 10,
      minimumUsefulJobs: 2,
      minimumSettledJobs: 2,
      maximumFalseAcceptanceUpper95: 0.3,
      maximumHumanSecondsPerJob: 10,
      minimumNetUSDC: "0",
      maximumEvidenceAgeSeconds: 86400,
    },
    expiresAt: now + 86400,
  };
  const plan = { schemaVersion: 1, cases: [] };
  for (const partition of ["calibration", "evaluation"])
    for (const role of ["agent", "reviewer"])
      for (let i = 0; i < (role === "agent" ? 2 : 20); i++)
        plan.cases.push({
          id: partition + "-" + role + "-" + i,
          partition,
          group: partition + "-" + role + "-" + i,
          role,
          expectedValid: role === "agent" || i % 2 === 0,
          specSha256: h,
          runtimeSha256: policy.runtimeSha256[role],
        });
  const ledger = {
    schemaVersion: 1,
    measurementKind: "observed",
    planSha256: digest(plan),
    engagements: plan.cases.map((c) => ({
      caseId: c.id,
      specSha256: c.specSha256,
      runtimeSha256: c.runtimeSha256,
      evidenceSha256: h,
      status: "complete",
      verdict:
        c.role === "agent" ? null : c.expectedValid ? "approve" : "reject",
      outcomeVerified: true,
      useful: c.role === "agent",
      elapsedMs: 100,
      humanSeconds: 0,
      toolCalls: 2,
      receiptsUSDC: "2",
      depositsUSDC: "0",
      costUSDC: "1",
      realizedValueUSDC: "0",
      observationSource: "runtime-and-independent-oracle",
      traceSha256: h,
    })),
  };
  const payloads = {};
  for (const role of ["agent", "reviewer"])
    payloads[role] = {
      runtimeSha256: policy.runtimeSha256[role],
      machineSha256: (role === "agent" ? "d" : "e").repeat(64),
      platform: "darwin",
      arch: "arm64",
      osBuild: "fixture",
      openclawVersion: "fixture",
      provider: "fixture",
      checks: Object.fromEntries(
        [
          "capture",
          "keyboard",
          "pointer",
          "accountScope",
          "liveModel",
          "artifactRoundTrip",
          "permissions",
          "cleanup",
        ].map((k) => [k, true]),
      ),
      restart: {
        beforeBootSha256: "1".repeat(64),
        afterBootSha256: "2".repeat(64),
        beforeTraceSha256: "3".repeat(64),
        afterTraceSha256: "4".repeat(64),
        interruptedWorkNotReplayed: true,
        serviceRecovered: true,
      },
    };
  payloads.validation = {
    plan,
    ledger,
    outcomeEvidenceSha256: h,
    costEvidenceSha256: h,
    settlementEvidenceSha256: h,
  };
  payloads.security = {
    reportSha256: h,
    scopeSha256: h,
    sourceSha256: h,
    status: "reviewed",
    openCritical: 0,
    openHigh: 0,
    retestEvidenceSha256: h,
  };
  const evidence = {},
    resign = () => {
      for (const k of Object.keys(payloads)) {
        const role =
          k === "validation" ? "oracle" : k === "security" ? "auditor" : k;
        evidence[k] = signAttestation(
          {
            schema: "agi-workforce-attestation/v1",
            kind: ["agent", "reviewer"].includes(k)
              ? "commissioning"
              : k === "security"
                ? "security-review"
                : "validation",
            role,
            policySha256: digest(policy),
            sourceSha256: h,
            issuedAt: now - 10,
            expiresAt: now + 3600,
            payload: payloads[k],
          },
          keys[role].privateKey,
        );
      }
    };
  resign();
  return { now, policy, evidence, payloads, resign };
}
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
