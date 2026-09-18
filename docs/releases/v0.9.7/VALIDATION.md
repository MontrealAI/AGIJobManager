# v0.9.7 validation

Application commit: `e947b5f3b599e1e13f2076e807d80309ea3b3193`

Application tree: `715b7f0751da0803f8731402c57a4d73190c5758`

The tag pins this application commit. The later publication commit changes only release evidence and tooling. Packaging checks the exact tree, source ancestry, change inventory and preservation of historical releases and deployment records. Publication requires every job in all five recorded source workflows to succeed, including the emitted checkout marker in each job log. See `SOURCE_CI.json` for the run links.

## Qualification

| Check | Scope and result |
| --- | --- |
| Contract and console regressions | 489 passed locally; also required across four source-CI shards |
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

Browser evidence comes from GitHub Actions; no successful local Chromium run is claimed. All chain transactions in qualification execute on disposable local networks or isolated mainnet forks. The cutover checks preserve the recorded legacy inventory and simulate its outstanding original-asset job's exit. They do not establish production signing or namespace control.

Seven new administrative-console regressions cover owner backstop access, moderator isolation, ordinary moderator decisions, owner-without-moderator rejection, malformed role values, proposed-owner acceptance and rejected simulation. Existing accounting, pause, NFT, dispute and payment-claim regressions continue to cover the unchanged contract rules.

Creation/runtime bytecode, ABI and link references were compared for all 12 production contract/library artifacts against the v0.9.6 baseline and are identical. The sole production Solidity edit changes the wallet-rotation NatSpec comment; no executable behavior changes. A verified v0.9.6 manager remains compatible with the v0.9.7 console.

## Static review

Slither 0.11.6 runs all 102 enabled detectors, with separate medium/high and reentrancy reports. The clean full scan retains **115 reviewed observations: 0 high, 9 medium, 36 low and 70 informational**. All finding identifiers, severities and confidence values match v0.9.6; existing rationales and evidence remain unchanged. The source-bound baseline updates only the inspected manager-comment and root package-version hashes. The strict verifier and its 11 tests pass.

The verifier rejects changed sources, missing reports, new observations, severity changes or missing dispositions. See `source/docs/qualification/OPERATIONS_V097.md` and `source/scripts/security/slither-reviewed-findings.json`. This is internal review, not an independent audit or a zero-finding claim.

## Operational limits

The default 8% shared reviewer budget and 30%/10% wallet shares are unchanged. Bonding does not prove profitable honest participation: review costs can exceed rewards, visible votes permit herding or bribery, and capped dispute bonds may inadequately deter delay on large jobs. Reviewers and moderators judge off-chain quality; hidden common control and explicit admission exceptions remain trust assumptions. Neutral timeout can leave honest work unpaid. Owner pauses can delay exits indefinitely; USDC issuer restrictions can delay receipt of reserved payments.

Production activation requires a verified compatible manager and all eight library links, accepted ownership, reviewed recipients, intended ENS roots, NFT policy, actual signing rehearsal and operating review/arbitration arrangements. A fresh manager requires NFTs but has an empty collection registry. The release does not supply or complete those choices. Existing jobs, deployments and historical evidence remain unchanged. No public Ethereum transaction was authorized or broadcast as part of this release.
