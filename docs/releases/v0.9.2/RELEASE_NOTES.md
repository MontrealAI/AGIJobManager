# v0.9.2 — ENS correction and USDC cutover qualification

v0.9.2 includes the ENS resolver correction discovered during the real-mainnet fork rehearsal, qualifies the new USDC settlement paths beside the existing legacy deployment, and corrects deployment instructions and release evidence.

## Corrections and qualification

- Use the deployed ENS PublicResolver's `approve(bytes32,address,bool)` API. Test real employer/agent delegated writes, outsider rejection and terminal revocation. The frozen v0.9.1 ENS helper does not contain this correction.
- Require an explicit ENS jobs root and reject the reserved legacy root for a fresh mainnet USDC deployment. The rehearsed dedicated root is owned directly by the new helper; default instructions no longer prescribe blanket authority over legacy names.
- Require successful ENS events and actual record/permission checks. A successful job transaction with a failed best-effort ENS hook does not pass wiring qualification.
- Rehearse exact USDC allocation, micro-unit rounding, separate bonds, disputed payouts/refunds, blocked transfers and atomic retry, reserve isolation, emergency controls and ownership handover.
- Preserve the recorded legacy jobs, original-token balances/allowances, reserves, ownership, ENS records and completion NFTs while operating the new system. Exercise an existing legacy job's exit separately on its original asset and manager.
- Bind qualification to the source and runtime dependencies. Every required CI job records its actual checked-out commit; publication validates that evidence directly from the job logs.
- Refresh the versioned console, current guides and reproducible release package. Preserve earlier release and deployment records.

## Compatibility and deployment

The manager and its five linked library sources are unchanged from v0.9.1. The successful-job default remains **8% validators / 30% first wallet / 10% second wallet / 52% agent**, with bonds separate and posting-time validator terms.

The project already has a legacy Ethereum mainnet deployment at `0xB3AAeb69b630f0299791679c063d68d6687481d1`. Its deployment history does not qualify the newer USDC manager. Deploy the USDC system separately with paused intake, a corrected ENS helper and a distinct namespace. Preserve legacy exits and wiring. Publishing this release does not deploy, upgrade, repoint or migrate any live contract or funds.

## Evidence and limits

All five exact-source workflows must pass: contracts, UI, documentation, security, and actual-USDC/ENS mainnet forks. The cutover suite has 12 scenarios in addition to the eight original actual-USDC fork cases. See [validation](https://github.com/MontrealAI/AGIJobManager/blob/main/docs/releases/v0.9.2/VALIDATION.md) and the [cutover evidence](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.2/docs/qualification/USDC_CUTOVER.md).

Complete root, deployment and UI dependency audits report zero known advisories at qualification. Static analysis retains 116 individually reviewed observations: 0 high, 7 medium, 36 low, 71 informational and 2 optimization. Existing documented UI deprecations and local lint exceptions remain visible. This is internal review and automated evidence, not a claim of flawlessness or an independent audit.

The fork uses pinned historical state and local signer impersonation. Actual recipient addresses, signing access, intended configuration, live deployment/source verification and instance checks remain prerequisites for production activation. ENS hooks remain best-effort; the short-metadata lifecycle does not establish that every maximum-length URI fits the hook gas budget. The manager has only 167 bytes of runtime-size headroom under the qualified compiler profile.

## Downloads

- **AGIJobManager-v0.9.2-COMPLETE.zip** — frozen source, USDC console, guides and release evidence.
- **agijobmanager-usdc.html** — standalone USDC console.
- **RELEASE_MANIFEST.json** — source identity and per-file SHA-256 inventory.
- **SHA256SUMS.txt** — asset checksums.

The archive must reproduce byte-for-byte. The publisher checks all uploaded asset digests and refuses to move tags or replace published releases.
