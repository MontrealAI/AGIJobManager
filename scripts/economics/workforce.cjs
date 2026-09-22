"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const { canonical, digest } = require("./computer-work.cjs");
const { capabilityReport } = require("./capability-report.cjs");
const hash = (x) => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
const need = (v, c) => {
  if (!v) throw Error("WORKFORCE_" + c);
};
const text = (x) =>
  typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(x);
const keys = (x, fields) =>
  need(
    x &&
      typeof x === "object" &&
      !Array.isArray(x) &&
      Object.keys(x).sort().join("|") === [...fields].sort().join("|"),
    "FIELDS",
  );
const integer = (x, min, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(x) && x >= min && x <= max;
function publicKey(pem) {
  const key = crypto.createPublicKey(pem);
  need(key.asymmetricKeyType === "ed25519", "KEY_TYPE");
  return key;
}
function keyId(pem) {
  return crypto
    .createHash("sha256")
    .update(publicKey(pem).export({ type: "spki", format: "der" }))
    .digest("hex");
}
function validatePolicy(p) {
  keys(p, [
    "schema",
    "runtimeSha256",
    "sourceSha256",
    "securityScopeSha256",
    "allowedSpecSha256",
    "controllers",
    "limits",
    "expiresAt",
  ]);
  need(
    p.schema === "agi-workforce-policy/v1" &&
      hash(p.sourceSha256) &&
      hash(p.securityScopeSha256),
    "POLICY",
  );
  need(
    Array.isArray(p.allowedSpecSha256) &&
      p.allowedSpecSha256.length > 0 &&
      p.allowedSpecSha256.length <= 1024 &&
      p.allowedSpecSha256.every(hash) &&
      new Set(p.allowedSpecSha256).size === p.allowedSpecSha256.length,
    "JOB_SCOPE",
  );
  keys(p.runtimeSha256, ["agent", "reviewer"]);
  need(Object.values(p.runtimeSha256).every(hash), "RUNTIME");
  keys(p.controllers, ["agent", "reviewer", "oracle", "auditor"]);
  const ids = new Set(),
    orgs = new Set();
  for (const role of ["agent", "reviewer", "oracle", "auditor"]) {
    const c = p.controllers[role];
    keys(c, ["id", "organization", "publicKey"]);
    need(text(c.id) && text(c.organization), "CONTROLLER");
    const id = keyId(c.publicKey);
    need(
      !ids.has(id) && !orgs.has(c.organization),
      "INDEPENDENT_CONTROL_REQUIRED",
    );
    ids.add(id);
    orgs.add(c.organization);
  }
  keys(p.limits, [
    "minimumValidReviews",
    "minimumInvalidReviews",
    "minimumUsefulJobs",
    "minimumSettledJobs",
    "maximumFalseAcceptanceUpper95",
    "maximumHumanSecondsPerJob",
    "minimumNetUSDC",
    "maximumEvidenceAgeSeconds",
  ]);
  const l = p.limits;
  need(
    integer(l.minimumValidReviews, 1, 100000) &&
      integer(l.minimumInvalidReviews, 1, 100000) &&
      integer(l.minimumUsefulJobs, 1, 100000) &&
      integer(l.minimumSettledJobs, 1, 100000),
    "SAMPLE_LIMIT",
  );
  need(
    typeof l.maximumFalseAcceptanceUpper95 === "number" &&
      l.maximumFalseAcceptanceUpper95 > 0 &&
      l.maximumFalseAcceptanceUpper95 < 1,
    "ERROR_LIMIT",
  );
  need(
    integer(l.maximumHumanSecondsPerJob, 0) &&
      integer(l.maximumEvidenceAgeSeconds, 60, 7776000) &&
      integer(p.expiresAt, 1),
    "TIME_LIMIT",
  );
  need(
    typeof l.minimumNetUSDC === "string" &&
      /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/.test(l.minimumNetUSDC),
    "CASH",
  );
  return p;
}
function signAttestation(body, privateKey) {
  return {
    body,
    signature: crypto
      .sign(null, Buffer.from(canonical(body)), privateKey)
      .toString("base64"),
  };
}
function verifyAttestation(a, p, kind, role, now) {
  keys(a, ["body", "signature"]);
  const b = a.body;
  keys(b, [
    "schema",
    "kind",
    "role",
    "policySha256",
    "sourceSha256",
    "issuedAt",
    "expiresAt",
    "payload",
  ]);
  need(
    b.schema === "agi-workforce-attestation/v1" &&
      b.kind === kind &&
      b.role === role &&
      b.policySha256 === digest(p) &&
      b.sourceSha256 === p.sourceSha256,
    "ATTESTATION_SCOPE",
  );
  need(
    integer(b.issuedAt, 1) &&
      integer(b.expiresAt, b.issuedAt) &&
      b.issuedAt <= now &&
      b.expiresAt > now &&
      now - b.issuedAt <= p.limits.maximumEvidenceAgeSeconds,
    "ATTESTATION_TIME",
  );
  need(
    typeof a.signature === "string" &&
      Buffer.from(a.signature, "base64").toString("base64") === a.signature &&
      Buffer.from(a.signature, "base64").length === 64,
    "SIGNATURE",
  );
  need(
    crypto.verify(
      null,
      Buffer.from(canonical(b)),
      publicKey(p.controllers[role].publicKey),
      Buffer.from(a.signature, "base64"),
    ),
    "SIGNATURE",
  );
  return b.payload;
}
function checkMachine(m, expected) {
  keys(m, [
    "runtimeSha256",
    "machineSha256",
    "platform",
    "arch",
    "osBuild",
    "openclawVersion",
    "provider",
    "checks",
    "restart",
  ]);
  need(
    m.runtimeSha256 === expected &&
      hash(m.machineSha256) &&
      m.platform === "darwin" &&
      m.arch === "arm64" &&
      typeof m.osBuild === "string" &&
      m.osBuild.length > 0 &&
      typeof m.openclawVersion === "string" &&
      m.openclawVersion.length > 0 &&
      text(m.provider),
    "MACHINE",
  );
  keys(m.checks, [
    "capture",
    "keyboard",
    "pointer",
    "accountScope",
    "liveModel",
    "artifactRoundTrip",
    "permissions",
    "cleanup",
  ]);
  need(
    Object.values(m.checks).every((v) => v === true),
    "COMMISSIONING_CHECKS",
  );
  keys(m.restart, [
    "beforeBootSha256",
    "afterBootSha256",
    "beforeTraceSha256",
    "afterTraceSha256",
    "interruptedWorkNotReplayed",
    "serviceRecovered",
  ]);
  const r = m.restart;
  need(
    [
      r.beforeBootSha256,
      r.afterBootSha256,
      r.beforeTraceSha256,
      r.afterTraceSha256,
    ].every(hash) &&
      r.beforeBootSha256 !== r.afterBootSha256 &&
      r.beforeTraceSha256 !== r.afterTraceSha256 &&
      r.interruptedWorkNotReplayed === true &&
      r.serviceRecovered === true,
    "RESTART_EVIDENCE",
  );
  return m;
}
const cash = (x) => {
  need(
    typeof x === "string" && /^-?(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/.test(x),
    "CASH",
  );
  const negative = x[0] === "-";
  const [a, b = ""] = (negative ? x.slice(1) : x).split(".");
  const n = BigInt(a) * 1000000n + BigInt(b.padEnd(6, "0"));
  return negative ? -n : n;
};
function qualifyWorkforce(
  policy,
  evidence,
  { now = Math.floor(Date.now() / 1000) } = {},
) {
  validatePolicy(policy);
  need(integer(now, 1), "NOW");
  need(
    evidence && typeof evidence === "object" && !Array.isArray(evidence),
    "EVIDENCE",
  );
  const reasons = [],
    accepted = {},
    run = (name, fn) => {
      try {
        accepted[name] = fn();
      } catch (e) {
        reasons.push({
          gate: name,
          code: /^WORKFORCE_|^CAPABILITY_/.test(e.message)
            ? e.message
            : "WORKFORCE_INVALID_EVIDENCE",
        });
      }
    };
  if (policy.expiresAt <= now)
    reasons.push({ gate: "policy", code: "WORKFORCE_POLICY_EXPIRED" });
  for (const role of ["agent", "reviewer"])
    run(role, () =>
      checkMachine(
        verifyAttestation(evidence[role], policy, "commissioning", role, now),
        policy.runtimeSha256[role],
      ),
    );
  if (
    accepted.agent &&
    accepted.reviewer &&
    accepted.agent.machineSha256 === accepted.reviewer.machineSha256
  )
    reasons.push({
      gate: "independence",
      code: "WORKFORCE_DISTINCT_MACHINES_REQUIRED",
    });
  run("validation", () => {
    const v = verifyAttestation(
      evidence.validation,
      policy,
      "validation",
      "oracle",
      now,
    );
    keys(v, [
      "plan",
      "ledger",
      "outcomeEvidenceSha256",
      "costEvidenceSha256",
      "settlementEvidenceSha256",
    ]);
    need(
      [
        v.outcomeEvidenceSha256,
        v.costEvidenceSha256,
        v.settlementEvidenceSha256,
      ].every(hash),
      "EVIDENCE_FILES",
    );
    need(v.ledger.measurementKind === "observed", "OBSERVED_REQUIRED");
    need(
      v.plan.cases.every(
        (c) => c.runtimeSha256 === policy.runtimeSha256[c.role],
      ),
      "RUNTIME",
    );
    const r = capabilityReport(v.plan, v.ledger),
      a = r.totals["evaluation:agent"],
      n = r.totals["evaluation:reviewer"],
      l = policy.limits;
    need(a && n, "HELD_OUT_ROLES");
    need(
      n.validDeliveries >= l.minimumValidReviews &&
        n.invalidDeliveries >= l.minimumInvalidReviews &&
        a.useful >= l.minimumUsefulJobs,
      "SAMPLE_LIMIT",
    );
    need(
      n.falseAcceptanceInterval95 &&
        n.falseAcceptanceInterval95.upper <= l.maximumFalseAcceptanceUpper95,
      "FALSE_ACCEPTANCE_LIMIT",
    );
    need(
      Object.values(r.totals).every((x) => x.unreconciledCosts === 0),
      "UNRECONCILED_COSTS",
    );
    need(
      a.humanSeconds / a.engagements <= l.maximumHumanSecondsPerJob &&
        n.humanSeconds / n.engagements <= l.maximumHumanSecondsPerJob,
      "SUPERVISION_LIMIT",
    );
    need(
      Object.values(r.totals).reduce((sum, x) => sum + cash(x.netUSDC), 0n) >=
        cash(l.minimumNetUSDC),
      "ECONOMICS_LIMIT",
    );
    const cases = new Map(v.plan.cases.map((c) => [c.id, c]));
    need(
      v.ledger.engagements.filter(
        (x) =>
          cases.get(x.caseId).role === "agent" &&
          x.status === "complete" &&
          x.useful &&
          x.outcomeVerified &&
          cash(x.receiptsUSDC) > cash(x.depositsUSDC),
      ).length >= l.minimumSettledJobs,
      "USEFUL_SETTLEMENTS_REQUIRED",
    );
    // The oracle must explicitly reconcile actual settlements; attributed value is not cash.
    need(
      v.ledger.engagements.every(
        (x) => x.realizedValueUSDC === "0" || cash(x.realizedValueUSDC) === 0n,
      ),
      "CASH_SETTLEMENTS_REQUIRED",
    );
    return r;
  });
  run("security", () => {
    const s = verifyAttestation(
      evidence.security,
      policy,
      "security-review",
      "auditor",
      now,
    );
    keys(s, [
      "reportSha256",
      "scopeSha256",
      "sourceSha256",
      "status",
      "openCritical",
      "openHigh",
      "retestEvidenceSha256",
    ]);
    need(
      [s.reportSha256, s.scopeSha256, s.retestEvidenceSha256].every(hash) &&
        s.sourceSha256 === policy.sourceSha256 &&
        s.scopeSha256 === policy.securityScopeSha256 &&
        s.status === "reviewed" &&
        s.openCritical === 0 &&
        s.openHigh === 0,
      "SECURITY_REVIEW_REQUIRED",
    );
    return s;
  });
  return {
    schema: "agi-workforce-qualification/v1",
    eligible: reasons.length === 0,
    policySha256: digest(policy),
    evidenceSha256: digest(evidence),
    evaluatedAt: now,
    reasons,
    limits: policy.limits,
    validation: accepted.validation ?? null,
    assurance:
      "Signatures establish statements by the configured trust roots, not truthful measurements or genuine organizational independence. This report grants no account, transaction or spending authority.",
  };
}
if (require.main === module) {
  try {
    need(
      process.argv.length === 4,
      "USAGE: workforce.cjs policy.json evidence.json",
    );
    const read = (f) => {
      const s = fs.lstatSync(f);
      need(s.isFile() && !s.isSymbolicLink() && s.size <= 67108864, "FILE");
      return JSON.parse(fs.readFileSync(f));
    };
    const r = qualifyWorkforce(read(process.argv[2]), read(process.argv[3]));
    console.log(JSON.stringify(r, null, 2));
    if (!r.eligible) process.exitCode = 2;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = {
  validatePolicy,
  qualifyWorkforce,
  signAttestation,
  verifyAttestation,
  keyId,
};
