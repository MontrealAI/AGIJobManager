# v0.9.6 validation

Application commit: `2b1169ceef161cdc6667aead23b5ca89633f8579`

Application tree: `cbc5566bf01f9b025a3614b8a4119533d6737464`

The tag pins this application commit. The later publication commit changes only release evidence and tooling. Packaging checks the exact tree, source ancestry, change inventory and preservation of historical releases and deployment records. Publication requires every job in all five recorded source workflows to succeed, including the emitted checkout marker in each job log. See `SOURCE_CI.json` for the run links.

## Qualification

| Check | Scope and result |
| --- | --- |
| Contract and console regressions | 482 passed locally; also required across four source-CI shards |
| UI unit suite | 178 passed; source CI also runs property tests |
| Deployment/preflight/verifier/readiness | 94 cases required by source security CI |
| Deployment and bytecode limit | 10 cases; manager runtime 24,359 bytes, leaving 217 bytes below EIP-170 |
| Foundry unit/fuzz/invariant suite | 37 cases under CI profiles; warning-free compilation required |
| Native Circle USDC fork | 8 passed locally and required in source CI |
| ENS and legacy cutover | 23 passed; executed source hashes match the checked-in report |
| Documentation and interfaces | Generated references, ABI parity, relative links and ENS checks pass |
| Standalone release console | 35 release checks pass, including fail-closed transaction context and embedded source terms |
| Browser and accessibility | Source CI requires wallet/RPC smoke, UI journeys, accessibility and security-header checks |
| Single-file distribution | Safety checks, deterministic rebuild and committed-artifact parity required by source UI CI |

Browser evidence comes from GitHub Actions; no successful local Chromium run is claimed. All chain transactions in qualification execute on disposable local networks or isolated mainnet forks. The cutover checks preserve the recorded legacy inventory and simulate its outstanding original-asset job's exit. These checks do not establish access to a production key or namespace owner.

The exact-bond regressions cover unset/fixed/zero bonds, changed owner defaults, actual later-voter debits, cleared terminal collateral and unknown/deleted jobs. The settings-event regression checks all three emitted values and preserves the first-vote amount. The stateful invariant handler checks concurrent jobs and all five reserve classes through settlement, pauses, restricted recipients, retries and owner transitions.

## Static review

Slither 0.11.6 runs all 102 enabled detectors, with separate medium/high and reentrancy reports. The full scan retains **115 reviewed observations: 0 high, 9 medium, 36 low and 70 informational**. Seven location-derived identifiers moved by one line after the settings event was added. Each full detector description was compared with the prior raw report and retains its review rationale and evidence; the other 108 identifiers are unchanged. The source-bound baseline records the inspected manager and root lockfile hashes.

The verifier rejects changed sources, missing reports, new observations, severity changes or missing dispositions. The current review is in `source/docs/qualification/BUYER_ECONOMICS_FOLLOWUP.md` and `source/scripts/security/slither-reviewed-findings.json`; the earlier buyer-protection review is preserved as historical evidence. This is internal review, not an independent audit or a zero-finding claim.

## Operational limits

The 8% default shared reviewer budget and 30%/10% wallet shares are unchanged. Bonding does not prove profitable honest participation: review costs can exceed rewards, visible votes permit herding or bribery, and capped dispute bonds may inadequately deter delay on large jobs. Reviewers and moderators judge off-chain quality; hidden common control and explicit admission exceptions remain trust assumptions. Neutral timeout can leave honest work unpaid. Owner pauses can delay exits indefinitely; USDC issuer restrictions can delay receipt of reserved payments.

A production instance still needs a fresh manager, verified library links, accepted ownership, real recipient wallets, intended ENS roots, NFT configuration and an operational rehearsal with the actual signing setup. Existing jobs and deployments remain unchanged. No public Ethereum transaction was authorized or broadcast as part of this release.
