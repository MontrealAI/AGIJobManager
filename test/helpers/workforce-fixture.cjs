const crypto = require("node:crypto");
const {signAttestation} = require("../../scripts/economics/workforce.cjs");
const {digest} = require("../../scripts/economics/computer-work.cjs");
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
module.exports = { fixture };
