# v0.9.5 validation

Application commit: `236d8789f0df4a8acae238d7b319bf01074ecef9`

Application tree: `8991843921e5039330c83165b8ab813f5d0308b4`

The release tag points to this application commit. A later publication commit adds only release evidence/tooling. Packaging checks this separation, preserves historical records, binds the exact source tree and produces reproducible assets. Publication requires all five source workflows and every required job to succeed, including an emitted checkout marker matching this commit.

## Contract and operational qualification

| Check | Result |
| --- | --- |
| Contract/console regressions | 471 passed across four shards: 114 + 111 + 118 + 128 |
| Buyer-protection adversarial cases | 31 included in the regression total |
| Exact-deadline/settlement console cases | 6 included in the regression total |
| Deployment/preflight/reverification/readiness | 94 passed |
| Actual deployment and Ethereum limits | 10 passed; manager runtime 24,198 bytes, 378 bytes below EIP-170 |
| Foundry unit/fuzz/invariant suite | 37 passed; CI fuzz and invariant profiles, warnings treated as errors |
| Actual Circle USDC fork | 8 passed at pinned Ethereum state |
| ENS and legacy cutover fork | 23 passed; 73 source/configuration hashes match committed evidence |
| Documentation | Generated references and relative-link/ENS checks pass |
| Documented local lifecycle | Exact 8 / 30 / 10 / 52 distribution; all reserves zero |
| USDC console release checks | 35 pass |
| Wallet/RPC browser smoke | 1 passed in source CI |

The stateful accounting handler exercises multiple jobs, prospective parameter changes, settlement pauses, restricted recipients and claim retry, surplus withdrawal and owner transfers. It requires valid transitions or specific rejected attacks, checks all five reserves against token balances and contributor balances, and closes surviving jobs after each randomized sequence.

The USDC fork exercises real issuer pause/blocklist behavior without broadcasting to Ethereum. The cutover fixture checks real ENS registry/wrapper/resolver behavior, ownership transfer, credential/controller review restrictions, full buyer refunds, neutral arbitration timeout, paused clocks, protected claims, all recorded legacy jobs and a simulated exit of the outstanding original-asset job. Local impersonation is a test fixture, not evidence of live key control.

## Dashboard and browser qualification

The source UI workflow requires 178 unit tests, the six property-test cases, browser journeys, accessibility checks, security headers, generated documentation and single-file safety checks. It rebuilds the standalone artifact twice for determinism and verifies that the committed production artifact matches. The publication gate verifies that every one of these steps completed successfully on the application commit above.

Local Chromium installation could not reach its download endpoint; browser success is established by the exact-source GitHub Actions job, not claimed from the local attempt.

## Static analysis

Slither 0.11.6 runs all 102 enabled detectors, plus separate medium/high and reentrancy scans. The full scan retains 115 individually reviewed observations: **0 high, 9 medium, 36 low, 70 informational, 0 optimization**. The source-bound baseline and internal review are included at `source/scripts/security/slither-reviewed-findings.json` and `source/docs/qualification/buyer-protection-static-review.json`.

Medium observations cover intentional per-voter rounding/remainder arithmetic, deletion of never-voted unassigned jobs, unused metadata tuple components, and guarded ledger updates across an exact inbound token transfer. New claim/self-call and voting paths were reviewed with adversarial tests. The gate rejects changed sources, missing reports, new findings, severity changes or missing dispositions. Findings are not hidden or advertised as zero.

## Limits

This is internal qualification, not an independent audit, formal proof or guarantee against every failure. Work quality depends on reviewers and moderators; unrelated-looking wallets can share a controller, and explicit governance exceptions remain trusted. Unanswered arbitration can leave honest work unpaid. Settlement pauses can delay exits indefinitely; USDC issuer actions can delay payment despite reserved claims.

Production activation is separate. A fresh deployment must establish accepted owner control, both recipient wallets, intended participant roots and job-page namespace, NFT policy, exact linked runtime and explorer verification, source-bound receipts and an operational rehearsal with the actual signing setup. Historical deployments and jobs remain unchanged. No public-chain transaction was authorized or broadcast by this software release.
