# v1.5.0 — Action-bound admission assurance

The v1.4.0 audit found that qualification scoped the participant and economics without binding the exact review decision or delivered bytes. Its job-ID check also rejected the contract's valid first job, zero. This release addresses those gaps without changing on-chain settlement.

## Download

- [AGIJobManager-v1.5.0-COMPLETE.zip](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.5.0/AGIJobManager-v1.5.0-COMPLETE.zip): extract and open `START_HERE.md`.
- [Standalone USDC console](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.5.0/agijobmanager-usdc.html).
- [Checksums](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.5.0/SHA256SUMS.txt) and [manifest](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.5.0/RELEASE_MANIFEST.json).

## Changes

- **Exact commitments:** schema v2 binds an Agent application or a reviewer's approve/reject decision, completion URI and delivered-byte SHA-256. The observed commitment must match the signature.
- **Fixed reviewer economics:** the scoped reviewer's non-absent ballot must equal that decision in every modeled outcome, including zero-weight stresses. A packet cannot model a different vote when doing so makes an outcome profitable.
- **Bounded preparation:** a policy requires 1–100 maximum preparation attempts. The verifier returns that ceiling; the integrating runner must durably enforce it and include all allowed attempts in modeled costs. It is not a provider-spend meter.
- **Canonical completion evidence:** both RPCs read the completion URI from the same canonical block along with current terms; disagreement fails closed. The runner independently hashes consumed bytes.
- **First-job compatibility:** canonical unsigned uint256 job IDs include zero; overflow is rejected.
- **Migration guidance:** legacy v1 stays available for offline clients. Action-sensitive signing integrations must require v2 explicitly, update the issuer and preserve outstanding obligations during policy migration.

Read `source/docs/OPERATIONS/QUALIFIED_ADMISSION.md` and `source/docs/qualification/V150_BOUND_ADMISSION.md`. Existing lifecycle, screen and settlement tools remain available.

## Qualification and limits

Frozen source: `989b4772bdf8c07a9db91c383d30090491809417`, tree `1bb6316970ba9f855ec979f4a2481c4cedf3cfce`; source PR [#1542](https://github.com/MontrealAI/AGIJobManager/pull/1542). Local checks: **600 contract/tool cases**, including **11 new regressions**, and **23 mainnet-fork cases**. Documentation, lint, generated UI and 35 standalone-console checks passed. Publication requires all five exact-source workflows, all eight required jobs and actual checkout markers, preserved historical records, deterministic packaging and uploaded asset digests. See `VALIDATION.md`.

All Solidity sources, ABI/bytecode inputs, eight linked libraries, payout rules, dependency resolutions, legal notices and historical releases are unchanged. Existing managers and jobs retain their behavior. No deployment or public-chain transaction occurs.

A trusted signature authenticates an assertion; it does not prove customer demand, employer value, probabilities, independent control, actual cost, throughput or savings. No software-only release merits a universal “10/10” or establishes production qualification. The public verifier is not a signing service, and conditional admission is not guaranteed profitability or loss-free custody.

**Private AGI Agent, AGI Node and Fleet implementations, configurations and artifacts are excluded from GitHub and this public archive.**
