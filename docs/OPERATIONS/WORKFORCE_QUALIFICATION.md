# Workforce operational qualification

The native workforce must prove useful work, independent validation, recoverable operation and realized economics before production. `workforce:qualify` checks signed evidence for an exact source and two exact runtimes. Missing evidence produces explicit blocking reasons and exit status 2; malformed policy exits nonzero. It never grants wallet authority or manufactures commissioning results.

```sh
npm run workforce:qualify -- policy.json evidence.json
```

## Evidence contract

Policy schema `agi-workforce-policy/v1` contains `runtimeSha256` (`agent`, `reviewer`), `sourceSha256`, `securityScopeSha256`, `allowedSpecSha256`, `controllers`, `limits` and `expiresAt` (Unix seconds). Hashes are lowercase SHA-256. Controllers `agent`, `reviewer`, `oracle`, `auditor` each supply an `id`, `organization` and Ed25519 PEM `publicKey`. Keys and declared organizations must differ. Organizational strings and signatures do not prove actual independent control; check ownership and conflicts separately.

Limits are `minimumValidReviews`, `minimumInvalidReviews`, `minimumUsefulJobs`, `minimumSettledJobs`, `maximumFalseAcceptanceUpper95`, `maximumHumanSecondsPerJob`, `minimumNetUSDC` (decimal string), and `maximumEvidenceAgeSeconds`. Set acceptance thresholds before collecting evidence; no universal sample size or cost allowance is implied. The allowed specification hashes bound production jobs, including original inputs, deliverables and runtimes. Fresh jobs require explicit policy scope and signed grants.

Each evidence entry contains `{body, signature}`. The body has schema `agi-workforce-attestation/v1`, `kind`, `role`, `policySha256`, `sourceSha256`, `issuedAt`, `expiresAt` and `payload`. Signature is canonical base64 Ed25519 over the canonical UTF-8 body. The exported `signAttestation`, `verifyAttestation`, `validatePolicy` and `qualifyWorkforce` functions provide the exact serialization and validation. Sign only in the controller's separate account after verifying original evidence.

| Evidence entry | Signer and kind | Required observations |
| --- | --- | --- |
| `agent`, `reviewer` | Corresponding controller; `commissioning` | Exact runtime; distinct physical machine hashes; `darwin`/`arm64`; OS build, OpenClaw/provider; successful capture, keyboard, pointer, account isolation, live-model, artifact round trip, permissions and cleanup rehearsals; different before/after boot and trace hashes; recovered service without replaying interrupted input |
| `validation` | Independent oracle; `validation` | Frozen `plan`, complete observed `ledger`, independent `outcomeEvidenceSha256`, `costEvidenceSha256`, `settlementEvidenceSha256`; runtime match; held-out cases for both roles; valid and deliberately flawed deliveries; bounded false acceptance; useful delivered work; reconciled costs and actual positive cash settlements |
| `security` | Independent auditor; `security` | `reportSha256`, exact `scopeSha256` and `sourceSha256`, `status: reviewed`, `openCritical: 0`, `openHigh: 0`, `retestEvidenceSha256` |

The executable contract is `scripts/economics/workforce.cjs`; `test/workforceQualification.test.js` contains **synthetic unit fixtures**, not operational certificates. Do not reuse test identities, claims or outcomes as production evidence. The separate private package vendors this module byte-for-byte.

## Real-machine commissioning

Use the private native guide to configure separate Standard Mac accounts, normal OpenClaw device approvals, permissions, actual provider access, recipient public keys and conservative budget reservations. The native runner never needs the operator grant private key or wallet. Record the app code-signature check and installation hash, hardware identity hash, OS build, source/runtime descriptors and gateway/provider identity.

Perform a visible scratch-document rehearsal: capture the unlocked display, type a random challenge, move/click and verify resulting text, save a declared artifact, reopen it in the independent reviewer environment, and prove cleanup. Exercise a real live model through the pinned no-tool planner; merely reading a model name is insufficient. Include permission revocation, stale frames, disconnection and a billed failed task.

For recovery, interrupt during a controlled task, retain its journal, reboot the Mac, log in normally and verify the service returns, the interrupted job is retained and the original execution is closed without replaying uncertain input. Record before/after boot hashes and encrypted trace hashes. Start-after-login cannot unlock FileVault or grant TCC permissions. A `doctor` or `commission-record` report deliberately leaves unperformed checks false.

## Independent quality and economics

The bundled reconciliation corpus is a repeatable commissioning fixture with held-out partitions and plausible invalid deliveries. It is not representative proof of every employer's work. Freeze additional real customer jobs spanning the intended applications, account actions, file formats and failure modes. The Node must inspect actual files and original inputs; evaluate its approvals against independently established outcomes. Keep the evaluation partition hidden and unchanged. Related-task correlation limits binomial confidence intervals.

Record every planned engagement, failure, timeout, refusal and abstention. Reconcile actual model/tool/hosting costs with provider bills, and actual settlements with finalized receipts and retained deposits. The gate includes calibration and evaluation costs in realized net results. Estimated employer value does not substitute for cash. Unbilled work leaves net economics unknown and blocks qualification. The pilot corpus has zero settlement receipts by construction and cannot pass the settled-work requirement by itself.

Time all human exceptions, including setup assistance, supervision, retries, moderation and recovery. Preserve the original records and include allocated overhead; local timers cannot detect omitted off-system time. Compare total supervision and realized net economics against the previously frozen limits before expanding scope.

## Independent assurance and deployment boundary

Give an independent reviewer the exact public and private source, dependency locks, installation/transport pins, tests, threat model and proposed account/grant/recipient configuration. Hash the agreed scope; retain the report and retest evidence. Review encrypted-envelope recipients and authenticity, desktop prompt injection, same-account access, no-tool planner assumptions, authorization, state/queue tampering, costs, recovery and the public/private publication boundary. A static scan alone is not an independent assurance report.

Native production mode requires all four valid attestations and the exact current source/runtime/specification scope. Pilot mode still requires a bounded operator-signed grant, immutable inputs and encrypted transport, and must be used only for deliberately authorized rehearsals. This gate checks consistency of signed claims, not physical truth. A compromised controller, shared ownership, unrecorded costs or fabricated oracle evidence defeats its premises.

The permissionless public contract and manual console do not enforce this gate. The private native runner is a separate workflow; automatic encrypted job posting, completion submission and on-chain voting are not implemented. The existing public wallet engine retains its own schema 6/7 admission and recovery logic. Software release tests do not close the real-machine, observed-business-evidence or external-review requirements.
